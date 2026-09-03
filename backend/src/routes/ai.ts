import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { analyseMeetingSchema, projectQuerySchema, weeklyReportSchema } from '../schemas/ai.js';
import { ApiError } from '../lib/ApiError.js';
import { computeProjectAlerts } from '../lib/projectAlerts.js';
import { computeSubHealth } from '../lib/projectHealth.js';
import { getMostRecentMeetingDate } from '../lib/projectMeetings.js';
import { assertProjectAccess } from '../lib/orgAccess.js';
import {
  createAction,
  createAgentRun,
  createAuditLogEntry,
  createChangeSignal,
  createDecision,
  createDependency,
  createIssue,
  createRisk,
  createWeeklyReport,
  getMeetingById,
  listActionsByMeeting,
  listActionsByProject,
  listRisksByMeeting,
  listRisksByProject,
  listIssuesByMeeting,
  listIssuesByProject,
  listDecisionsByMeeting,
  listDecisionsByProject,
  listDependenciesByMeeting,
  listDependenciesByProject,
  listChangeSignalsByMeeting,
  listChangeSignalsByProject,
  listMeetingsByProject,
  updateMeetingAnalysisStatus,
  updateMeetingSummary,
} from '../db/index.js';
import { downloadTranscript } from '../services/transcriptStorage.js';
import { retrieveRelevantChunks } from '../services/retrieval.js';
import { runMeetingAnalysisPipeline } from '../agents/pipeline.js';
import { runExecutiveReportingAgent } from '../agents/executive-reporting/index.js';
import type { WeeklyReportInput } from '../agents/executive-reporting/index.js';
import { runProjectAssistant } from '../agents/project-assistant/index.js';
import type { ProjectAssistantInput, QueryAnswerPoint } from '../agents/project-assistant/index.js';

export const aiRouter = Router();

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

aiRouter.post(
  '/analyse-meeting',
  validateBody(analyseMeetingSchema),
  asyncHandler(async (req, res) => {
    const { meeting_id, force } = req.body;

    const meeting = await getMeetingById(meeting_id);
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    await assertProjectAccess(meeting.project_id, req.user!.organisationId);
    if (!meeting.transcript_reference) {
      throw new ApiError(400, 'Meeting has no transcript to analyse');
    }

    // Idempotency: a meeting already successfully analysed short-circuits
    // instead of re-running the pipeline and creating a duplicate batch of
    // items — safe for n8n (or anyone) to retry this call. `force: true`
    // bypasses this for deliberate re-analysis.
    if (meeting.analysis_status === 'completed' && !force) {
      const [actions, risks, issues, decisions, dependencies, changeSignals] = await Promise.all([
        listActionsByMeeting(meeting.id),
        listRisksByMeeting(meeting.id),
        listIssuesByMeeting(meeting.id),
        listDecisionsByMeeting(meeting.id),
        listDependenciesByMeeting(meeting.id),
        listChangeSignalsByMeeting(meeting.id),
      ]);
      res.status(200).json({
        status: 'already_analysed',
        meeting,
        counts: {
          actions: actions.length,
          risks: risks.length,
          issues: issues.length,
          decisions: decisions.length,
          dependencies: dependencies.length,
          change_signals: changeSignals.length,
        },
        actions,
        risks,
        issues,
        decisions,
        dependencies,
        change_signals: changeSignals,
      });
      return;
    }

    const project = await assertProjectAccess(meeting.project_id, req.user!.organisationId);

    const transcript = await downloadTranscript(meeting.transcript_reference);

    const pipeline = await runMeetingAnalysisPipeline({ transcript, project, meeting });

    await Promise.all(
      pipeline.agentLogs.map((log) =>
        createAgentRun({
          agent_name: log.agentName,
          project_id: project.id,
          meeting_id: meeting.id,
          model: log.model,
          prompt_version: log.promptVersion,
          input_refs: log.inputRefs,
          raw_output: log.rawOutput,
          validation_passed: log.validationPassed,
          error_message: log.errorMessage,
        }),
      ),
    );

    if (!pipeline.success || !pipeline.enriched) {
      const errorMessage = 'Meeting Analyst could not produce a valid structured result after retries';
      // Marks the meeting as needing attention — the n8n Meeting Analysis
      // workflow's failure branch also does this as a best-effort fallback
      // for the case this request never reaches the backend at all.
      await updateMeetingAnalysisStatus(meeting.id, 'failed', errorMessage);
      throw new ApiError(502, errorMessage);
    }

    const { enriched } = pipeline;
    const common = { project_id: project.id, meeting_id: meeting.id, created_by_agent: 'meeting-analyst' };

    const [actions, risks, issues, decisions, dependencies, changeSignals] = await Promise.all([
      Promise.all(
        enriched.actions.map((a) =>
          createAction({
            ...common,
            description: a.description,
            owner: a.owner ?? undefined,
            due_date: a.due_date ?? undefined,
            priority: a.priority,
            source_excerpt: a.source_text,
            confidence_type: a.confidence_type,
            context_flags: a.context_flags,
          }),
        ),
      ),
      Promise.all(
        enriched.risks.map((r) =>
          createRisk({
            ...common,
            description: r.description,
            probability: r.probability ?? undefined,
            impact: r.impact ?? undefined,
            severity: r.severity ?? undefined,
            owner: r.owner ?? undefined,
            mitigation: r.mitigation ?? undefined,
            source_excerpt: r.source_text,
            confidence_type: r.confidence_type,
            context_flags: r.context_flags,
            impact_assessment: r.impact_assessment,
          }),
        ),
      ),
      Promise.all(
        enriched.issues.map((i) =>
          createIssue({
            ...common,
            description: i.description,
            owner: i.owner ?? undefined,
            severity: i.severity ?? undefined,
            source_excerpt: i.source_text,
            confidence_type: i.confidence_type,
          }),
        ),
      ),
      Promise.all(
        enriched.decisions.map((d) =>
          createDecision({
            ...common,
            decision: d.decision,
            decision_owner: d.decision_owner ?? undefined,
            decision_date: d.decision_date ?? undefined,
            impact: d.impact ?? undefined,
            source_excerpt: d.source_text,
            confidence_type: d.confidence_type,
            context_flags: d.context_flags,
          }),
        ),
      ),
      Promise.all(
        enriched.dependencies.map((dep) =>
          createDependency({
            ...common,
            description: dep.description,
            upstream_activity: dep.upstream_activity ?? undefined,
            downstream_activity: dep.downstream_activity ?? undefined,
            owner: dep.owner ?? undefined,
            source_excerpt: dep.source_text,
            confidence_type: dep.confidence_type,
            impact_assessment: dep.impact_assessment,
          }),
        ),
      ),
      Promise.all(
        enriched.change_signals.map((c) =>
          createChangeSignal({
            ...common,
            change_type: c.change_type,
            description: c.description,
            potential_impact: c.potential_impact ?? undefined,
            source_excerpt: c.source_text,
            confidence_type: c.confidence_type,
            impact_assessment: c.impact_assessment,
          }),
        ),
      ),
    ]);

    await updateMeetingSummary(meeting.id, pipeline.summary ?? '');
    const updatedMeeting = await updateMeetingAnalysisStatus(meeting.id, 'completed');

    res.status(201).json({
      meeting: updatedMeeting,
      counts: {
        actions: actions.length,
        risks: risks.length,
        issues: issues.length,
        decisions: decisions.length,
        dependencies: dependencies.length,
        change_signals: changeSignals.length,
      },
      actions,
      risks,
      issues,
      decisions,
      dependencies,
      change_signals: changeSignals,
    });
  }),
);

aiRouter.post(
  '/weekly-report',
  validateBody(weeklyReportSchema),
  asyncHandler(async (req, res) => {
    const { project_id, week_start } = req.body;

    const project = await assertProjectAccess(project_id, req.user!.organisationId);

    const weekEnd = new Date().toISOString();
    const weekStart = week_start ?? new Date(Date.now() - ONE_WEEK_MS).toISOString();

    const [actions, risks, issues, decisions, dependencies, changeSignals] = await Promise.all([
      listActionsByProject(project_id),
      listRisksByProject(project_id),
      listIssuesByProject(project_id),
      listDecisionsByProject(project_id),
      listDependenciesByProject(project_id),
      listChangeSignalsByProject(project_id),
    ]);

    const isNew = (createdAt: string) => createdAt >= weekStart;
    const newItemCounts = {
      actions: actions.filter((a) => isNew(a.created_at)).length,
      risks: risks.filter((r) => isNew(r.created_at)).length,
      issues: issues.filter((i) => isNew(i.created_at)).length,
      decisions: decisions.filter((d) => isNew(d.created_at)).length,
      dependencies: dependencies.filter((dep) => isNew(dep.created_at)).length,
      change_signals: changeSignals.filter((c) => isNew(c.created_at)).length,
    };

    const topRisks = risks.filter(
      (r) =>
        r.approval_status === 'approved' && (r.severity === 'high' || r.severity === 'critical'),
    );

    // Same "what needs attention" logic as GET /api/projects/:id/alerts —
    // shared helper so the two never drift apart.
    const { overdueActions, worseningRisks, pendingDecisions } = computeProjectAlerts(
      actions,
      risks,
      decisions,
    );

    const openChangeSignals = changeSignals.filter(
      (c) => c.approval_status === 'approved' && c.status === 'open',
    );

    const agentInput: WeeklyReportInput = {
      project,
      weekStart,
      weekEnd,
      newItemCounts,
      topRisks,
      overdueActions,
      worseningRisks,
      pendingDecisions,
      openChangeSignals,
    };

    const run = await runExecutiveReportingAgent(agentInput);

    await createAgentRun({
      agent_name: 'executive-reporting',
      project_id,
      model: run.model,
      prompt_version: run.promptVersion,
      input_refs: { weekStart, weekEnd, newItemCounts },
      raw_output: run.rawOutput,
      validation_passed: run.validationPassed,
      error_message: run.errorMessage,
    });

    if (!run.validationPassed || !run.result) {
      const errorMessage =
        run.errorMessage ?? 'Executive Reporting Agent could not produce a valid report after retries';
      throw new ApiError(502, errorMessage);
    }

    const statusSummary = run.result.status_narrative.map((item) => item.text).join(' ');

    const report = await createWeeklyReport({
      project_id,
      week_start: weekStart,
      week_end: weekEnd,
      status_summary: statusSummary,
      report_json: run.result,
      model: run.model,
      prompt_version: run.promptVersion,
    });

    await createAuditLogEntry({
      organisation_id: req.user!.organisationId,
      actor_id: req.user!.id,
      action: 'report_generated',
      resource_type: 'weekly_reports',
      resource_id: report.id,
      after_state: { report_id: report.id, week_start: weekStart, week_end: weekEnd },
    });

    res.status(201).json({
      report,
      project: { id: project.id, name: project.name },
    });
  }),
);

aiRouter.post(
  '/project-query',
  validateBody(projectQuerySchema),
  asyncHandler(async (req, res) => {
    const { project_id, question } = req.body;

    const project = await assertProjectAccess(project_id, req.user!.organisationId);

    const [actions, risks, issues, decisions, dependencies, changeSignals, meetings, retrievedChunks] =
      await Promise.all([
        listActionsByProject(project_id),
        listRisksByProject(project_id),
        listIssuesByProject(project_id),
        listDecisionsByProject(project_id),
        listDependenciesByProject(project_id),
        listChangeSignalsByProject(project_id),
        listMeetingsByProject(project_id),
        retrieveRelevantChunks(project_id, question),
      ]);

    const isApproved = <T extends { approval_status: string }>(item: T) =>
      item.approval_status === 'approved';

    const approvedActions = actions.filter(isApproved);
    const approvedRisks = risks.filter(isApproved);
    const approvedIssues = issues.filter(isApproved);
    const approvedDependencies = dependencies.filter(isApproved);
    const approvedChangeSignals = changeSignals.filter(isApproved);

    // Same "what needs attention" logic as GET /:id/alerts, the weekly
    // report, and the dashboard — shared helper so none of them drift.
    const { overdueActions, worseningRisks, pendingDecisions } = computeProjectAlerts(
      approvedActions,
      approvedRisks,
      decisions,
    );

    const subHealth = computeSubHealth(
      approvedRisks,
      approvedDependencies,
      approvedChangeSignals,
      overdueActions.length,
    );

    const sinceLastMeeting = getMostRecentMeetingDate(meetings);

    // The set of every id handed to the model, keyed by claimed type —
    // used below to drop any hallucinated citation before responding.
    // Decisions include pending ones (the one deliberate exception, same
    // as everywhere else), everything else is approved-only.
    const knownIds: Record<string, Set<string>> = {
      action: new Set(approvedActions.map((a) => a.id)),
      risk: new Set(approvedRisks.map((r) => r.id)),
      issue: new Set(approvedIssues.map((i) => i.id)),
      decision: new Set(decisions.map((d) => d.id)),
      dependency: new Set(approvedDependencies.map((d) => d.id)),
      change_signal: new Set(approvedChangeSignals.map((c) => c.id)),
      meeting: new Set(meetings.map((m) => m.id)),
      document: new Set(retrievedChunks.map((c) => c.document_id)),
    };

    const agentInput: ProjectAssistantInput = {
      project,
      subHealth,
      question,
      sinceLastMeeting,
      meetings,
      retrievedChunks,
      actions: approvedActions,
      risks: approvedRisks,
      issues: approvedIssues,
      dependencies: approvedDependencies,
      changeSignals: approvedChangeSignals,
      decisions,
      overdueActions,
      worseningRisks,
      pendingDecisions,
    };

    const run = await runProjectAssistant(agentInput);

    await createAgentRun({
      agent_name: 'project-assistant',
      project_id,
      model: run.model,
      prompt_version: run.promptVersion,
      input_refs: {
        question,
        since_last_meeting: sinceLastMeeting,
        retrieved_chunk_ids: retrievedChunks.map((c) => c.id),
      },
      raw_output: run.rawOutput,
      validation_passed: run.validationPassed,
      error_message: run.errorMessage,
    });

    if (!run.validationPassed || !run.result) {
      const errorMessage =
        run.errorMessage ?? 'Project Assistant could not produce a valid answer after retries';
      throw new ApiError(502, errorMessage);
    }

    // Defensive re-validation: drop any citation whose id doesn't match a
    // real record of its claimed type — same pattern as the Context
    // Analyst's duplicate_of_id re-validation. Never trust an id the
    // model reports back to us.
    const answer: QueryAnswerPoint[] = run.result.answer.map((point) => ({
      ...point,
      citations: point.citations.filter((c) => knownIds[c.type]?.has(c.id) ?? false),
    }));

    res.status(200).json({
      project: { id: project.id, name: project.name },
      question,
      answer,
      data_gap: run.result.data_gap,
      // The retrieved passages the answer could cite from — lets the
      // frontend resolve "click a document citation -> show the source
      // passage" by matching (document_id, section) client-side, with no
      // extra round trip.
      sources: retrievedChunks,
    });
  }),
);
