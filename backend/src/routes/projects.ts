import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createProjectSchema } from '../schemas/projects.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { config } from '../config.js';
import { computeProjectAlerts } from '../lib/projectAlerts.js';
import { computeSubHealth } from '../lib/projectHealth.js';
import { getMostRecentMeetingDate } from '../lib/projectMeetings.js';
import type { Action, ChangeSignal, Decision, Dependency, Issue, Risk } from '../db/types.js';
import {
  createProject,
  getProjectById,
  listActionsByProject,
  listAllProjects,
  listRisksByProject,
  listDecisionsByProject,
  listIssuesByProject,
  listDependenciesByProject,
  listChangeSignalsByProject,
  listMeetingsByProject,
  listWeeklyReportsByProject,
} from '../db/index.js';

export const projectsRouter = Router();

const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

interface IntelligenceFeedItem {
  type: 'action' | 'risk' | 'issue' | 'decision' | 'dependency' | 'change_signal';
  id: string;
  text: string;
  confidence_type: string | null;
  created_at: string;
}

function buildIntelligenceFeed(
  actions: Action[],
  risks: Risk[],
  issues: Issue[],
  decisions: Decision[],
  dependencies: Dependency[],
  changeSignals: ChangeSignal[],
  limit: number,
): IntelligenceFeedItem[] {
  const isApproved = <T extends { approval_status: string }>(item: T) =>
    item.approval_status === 'approved';

  const items: IntelligenceFeedItem[] = [
    ...actions.filter(isApproved).map((a) => ({
      type: 'action' as const,
      id: a.id,
      text: a.description,
      confidence_type: a.confidence_type,
      created_at: a.created_at,
    })),
    ...risks.filter(isApproved).map((r) => ({
      type: 'risk' as const,
      id: r.id,
      text: r.description,
      confidence_type: r.confidence_type,
      created_at: r.created_at,
    })),
    ...issues.filter(isApproved).map((i) => ({
      type: 'issue' as const,
      id: i.id,
      text: i.description,
      confidence_type: i.confidence_type,
      created_at: i.created_at,
    })),
    ...decisions.filter(isApproved).map((d) => ({
      type: 'decision' as const,
      id: d.id,
      text: d.decision,
      confidence_type: d.confidence_type,
      created_at: d.created_at,
    })),
    ...dependencies.filter(isApproved).map((dep) => ({
      type: 'dependency' as const,
      id: dep.id,
      text: dep.description,
      confidence_type: dep.confidence_type,
      created_at: dep.created_at,
    })),
    ...changeSignals.filter(isApproved).map((c) => ({
      type: 'change_signal' as const,
      id: c.id,
      text: c.description,
      confidence_type: c.confidence_type,
      created_at: c.created_at,
    })),
  ];

  return items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
}

projectsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listAllProjects());
  }),
);

projectsRouter.post(
  '/',
  validateBody(createProjectSchema),
  asyncHandler(async (req, res) => {
    const project = await createProject(req.body);
    res.status(201).json(project);
  }),
);

projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    res.json(project);
  }),
);

projectsRouter.get(
  '/:id/actions',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    res.json(await listActionsByProject(id));
  }),
);

projectsRouter.get(
  '/:id/risks',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    res.json(await listRisksByProject(id));
  }),
);

projectsRouter.get(
  '/:id/decisions',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    res.json(await listDecisionsByProject(id));
  }),
);

projectsRouter.get(
  '/:id/issues',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    res.json(await listIssuesByProject(id));
  }),
);

projectsRouter.get(
  '/:id/dependencies',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    res.json(await listDependenciesByProject(id));
  }),
);

projectsRouter.get(
  '/:id/change-signals',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    res.json(await listChangeSignalsByProject(id));
  }),
);

// Drill-down data source for the dashboard: unlike the endpoints above,
// nothing here filters by approval_status — a PM browsing into a tile
// should be able to see pending/rejected records too, not just what the
// dashboard summary shows. Also backs "source meeting" resolution.
projectsRouter.get(
  '/:id/meetings',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');
    res.json(await listMeetingsByProject(id));
  }),
);

projectsRouter.get(
  '/:id/dashboard',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');

    const [actions, risks, issues, decisions, dependencies, changeSignals, meetings] =
      await Promise.all([
        listActionsByProject(id),
        listRisksByProject(id),
        listIssuesByProject(id),
        listDecisionsByProject(id),
        listDependenciesByProject(id),
        listChangeSignalsByProject(id),
        listMeetingsByProject(id),
      ]);

    const isApproved = <T extends { approval_status: string }>(item: T) =>
      item.approval_status === 'approved';

    // Same "what needs attention" logic as GET /:id/alerts and the weekly
    // report — shared helper so the three never drift apart.
    const { overdueActions, pendingDecisions } = computeProjectAlerts(actions, risks, decisions);

    const subHealth = computeSubHealth(risks, dependencies, changeSignals, overdueActions.length);

    // "New since last meeting" — the project's most recent meeting_date is
    // the cutoff. No meetings yet → since is null, counts are 0 (disclosed
    // simplification, not silently wrong).
    const since = getMostRecentMeetingDate(meetings);
    const isNewSinceLastMeeting = (createdAt: string) => since !== null && createdAt >= since;
    const newSinceLastMeeting = {
      since,
      actions: actions.filter((a) => isApproved(a) && isNewSinceLastMeeting(a.created_at)).length,
      risks: risks.filter((r) => isApproved(r) && isNewSinceLastMeeting(r.created_at)).length,
      decisions: decisions.filter((d) => isApproved(d) && isNewSinceLastMeeting(d.created_at)).length,
      issues: issues.filter((i) => isApproved(i) && isNewSinceLastMeeting(i.created_at)).length,
    };

    const topRisks = risks
      .filter(isApproved)
      .sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity ?? ''] ?? -1) - (SEVERITY_RANK[a.severity ?? ''] ?? -1) ||
          (a.created_at < b.created_at ? 1 : -1),
      )
      .slice(0, 5);

    const openIssues = issues.filter(
      (i) => isApproved(i) && (i.status === 'open' || i.status === 'investigating'),
    );

    const openDependencies = dependencies.filter((d) => isApproved(d) && d.status !== 'complete');

    const openChangeSignals = changeSignals.filter((c) => isApproved(c) && c.status === 'open');

    const recentIntelligence = buildIntelligenceFeed(
      actions,
      risks,
      issues,
      decisions,
      dependencies,
      changeSignals,
      15,
    );

    res.json({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        health: project.health,
        start_date: project.start_date,
        target_date: project.target_date,
      },
      sub_health: subHealth,
      new_since_last_meeting: newSinceLastMeeting,
      counts: {
        actions: actions.filter(isApproved).length,
        risks: risks.filter(isApproved).length,
        issues: issues.filter(isApproved).length,
        decisions: decisions.filter(isApproved).length,
        dependencies: dependencies.filter(isApproved).length,
        change_signals: changeSignals.filter(isApproved).length,
      },
      overdue_actions: overdueActions,
      top_risks: topRisks,
      decisions_needing_attention: pendingDecisions,
      open_issues: openIssues,
      open_dependencies: openDependencies,
      change_signals: openChangeSignals,
      recent_intelligence: recentIntelligence,
    });
  }),
);

projectsRouter.get(
  '/:id/alerts',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');

    const [actions, risks, decisions] = await Promise.all([
      listActionsByProject(id),
      listRisksByProject(id),
      listDecisionsByProject(id),
    ]);

    // Only ever surfaces approved actions/risks — the alerts digest reports
    // on live project data, never acts on anything still pending review.
    const { overdueActions, worseningRisks, pendingDecisions } = computeProjectAlerts(
      actions,
      risks,
      decisions,
    );

    res.json({
      project: {
        id: project.id,
        name: project.name,
        url: `${config.frontendBaseUrl}/projects/${project.id}`,
      },
      overdue_actions: overdueActions,
      worsening_risks: worseningRisks,
      pending_decisions: pendingDecisions,
      counts: {
        overdue_actions: overdueActions.length,
        worsening_risks: worseningRisks.length,
        pending_decisions: pendingDecisions.length,
      },
    });
  }),
);

projectsRouter.get(
  '/:id/reports',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');

    const reports = await listWeeklyReportsByProject(id);
    res.json(reports);
  }),
);
