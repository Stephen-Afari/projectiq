import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createProjectSchema } from '../schemas/projects.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { config } from '../config.js';
import { computeProjectAlerts } from '../lib/projectAlerts.js';
import {
  createProject,
  getProjectById,
  listActionsByProject,
  listAllProjects,
  listRisksByProject,
  listDecisionsByProject,
  listWeeklyReportsByProject,
} from '../db/index.js';

export const projectsRouter = Router();

function countBy<T extends object>(items: T[], key: keyof T): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? 'unknown');
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
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
  '/:id/dashboard',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const project = await getProjectById(id);
    if (!project) throw new ApiError(404, 'Project not found');

    const [actions, risks, decisions] = await Promise.all([
      listActionsByProject(id),
      listRisksByProject(id),
      listDecisionsByProject(id),
    ]);

    res.json({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        health: project.health,
        start_date: project.start_date,
        target_date: project.target_date,
      },
      counts: {
        actions: {
          total: actions.length,
          by_status: countBy(actions, 'status'),
          by_approval_status: countBy(actions, 'approval_status'),
        },
        risks: {
          total: risks.length,
          by_severity: countBy(risks, 'severity'),
          by_approval_status: countBy(risks, 'approval_status'),
        },
        decisions: {
          total: decisions.length,
        },
      },
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
