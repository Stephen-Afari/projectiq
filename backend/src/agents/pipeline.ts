import type { Meeting, Project, ContextFlags, ImpactAssessment } from '../db/types.js';
import { listActionsByProject, listRisksByProject, listDecisionsByProject } from '../db/index.js';
import { withRefs } from './shared/refs.js';
import { runMeetingAnalyst } from './meeting-analyst/index.js';
import type { MeetingAnalysisResult } from './meeting-analyst/index.js';
import { runContextAnalyst } from './context-analyst/index.js';
import type {
  ContextAnnotation,
  ExtractedActionWithRef,
  ExtractedDecisionWithRef,
  ExtractedRiskWithRef,
} from './context-analyst/index.js';
import { runImpactAnalyst } from './impact-analyst/index.js';
import type {
  ChangeSignalForImpact,
  DependencyForImpact,
  ImpactAssessmentAnnotation,
  RiskForImpact,
} from './impact-analyst/index.js';

export interface PipelineAgentLog {
  agentName: 'meeting-analyst' | 'context-analyst' | 'impact-analyst';
  model: string;
  promptVersion: string;
  inputRefs: unknown;
  rawOutput: unknown;
  validationPassed: boolean;
  errorMessage: string | null;
}

export type EnrichedAction = ExtractedActionWithRef & { context_flags: ContextFlags | null };
export type EnrichedRisk = ExtractedRiskWithRef & {
  context_flags: ContextFlags | null;
  impact_assessment: ImpactAssessment | null;
};
export type EnrichedDecision = ExtractedDecisionWithRef & { context_flags: ContextFlags | null };
export type EnrichedDependency = DependencyForImpact & { impact_assessment: ImpactAssessment | null };
export type EnrichedChangeSignal = ChangeSignalForImpact & { impact_assessment: ImpactAssessment | null };

export interface PipelineResult {
  success: boolean;
  summary: string | null;
  enriched: {
    actions: EnrichedAction[];
    risks: EnrichedRisk[];
    issues: MeetingAnalysisResult['issues'];
    decisions: EnrichedDecision[];
    dependencies: EnrichedDependency[];
    change_signals: EnrichedChangeSignal[];
  } | null;
  agentLogs: PipelineAgentLog[];
}

function toContextFlags(annotation: ContextAnnotation | undefined): ContextFlags | null {
  if (!annotation) return null;
  return {
    is_likely_duplicate: annotation.is_likely_duplicate,
    duplicate_of_id: annotation.duplicate_of_id,
    duplicate_reasoning: annotation.duplicate_reasoning,
    related_items: annotation.related_items,
    confidence_type: annotation.confidence_type,
  };
}

function toImpactAssessment(annotation: ImpactAssessmentAnnotation | undefined): ImpactAssessment | null {
  if (!annotation) return null;
  return {
    applicable: annotation.applicable,
    schedule_impact: annotation.schedule_impact,
    cost_impact: annotation.cost_impact,
    scope_impact: annotation.scope_impact,
    resource_impact: annotation.resource_impact,
    dependency_impact: annotation.dependency_impact,
    reasoning: annotation.reasoning,
    confidence_type: annotation.confidence_type,
  };
}

/**
 * Runs the full 3-agent analysis pipeline in memory: Meeting Analyst →
 * Context Analyst → Impact Analyst. Nothing is persisted here — the route
 * handler (backend/src/routes/ai.ts) does exactly one round of DB writes
 * with the fully enriched result. Context/Impact failures degrade
 * gracefully (their enrichment stays null on affected items) rather than
 * discarding the Meeting Analyst's extraction; only a Meeting Analyst
 * failure fails the whole pipeline, since there's nothing to enrich.
 */
export async function runMeetingAnalysisPipeline(input: {
  transcript: string;
  project: Project;
  meeting: Meeting;
}): Promise<PipelineResult> {
  const agentLogs: PipelineAgentLog[] = [];

  const meetingRun = await runMeetingAnalyst(input);
  agentLogs.push({
    agentName: 'meeting-analyst',
    model: meetingRun.model || 'unknown',
    promptVersion: meetingRun.promptVersion,
    inputRefs: { meeting_id: input.meeting.id, transcript_reference: input.meeting.transcript_reference },
    rawOutput: meetingRun.rawOutput,
    validationPassed: meetingRun.validationPassed,
    errorMessage: meetingRun.errorMessage,
  });

  if (!meetingRun.validationPassed || !meetingRun.result) {
    return { success: false, summary: null, enriched: null, agentLogs };
  }

  const draft = meetingRun.result;
  const newActions = withRefs('action', draft.actions);
  const newRisks = withRefs('risk', draft.risks);
  const newDecisions = withRefs('decision', draft.decisions);
  const newDependencies = withRefs('dependency', draft.dependencies);
  const newChangeSignals = withRefs('change_signal', draft.change_signals);

  const [existingActions, existingRisks, existingDecisions] = await Promise.all([
    listActionsByProject(input.project.id),
    listRisksByProject(input.project.id),
    listDecisionsByProject(input.project.id),
  ]);
  const validExistingIds = new Set([
    ...existingActions.map((a) => a.id),
    ...existingRisks.map((r) => r.id),
    ...existingDecisions.map((d) => d.id),
  ]);

  // --- Context Analyst ---
  const contextInput = {
    newActions,
    newRisks,
    newDecisions,
    existingActions,
    existingRisks,
    existingDecisions,
  };
  const contextRun = await runContextAnalyst(contextInput);
  agentLogs.push({
    agentName: 'context-analyst',
    model: contextRun.model || 'unknown',
    promptVersion: contextRun.promptVersion,
    inputRefs: {
      new_item_refs: [...newActions, ...newRisks, ...newDecisions].map((i) => i.ref),
      existing_item_count: validExistingIds.size,
    },
    rawOutput: contextRun.rawOutput,
    validationPassed: contextRun.validationPassed,
    errorMessage: contextRun.errorMessage,
  });

  const annotationsByRef = new Map<string, ContextAnnotation>();
  if (contextRun.validationPassed && contextRun.result) {
    for (const annotation of contextRun.result.annotations) {
      // Defensive: only trust a duplicate_of_id that actually matches an
      // existing record — the model could hallucinate one. Keep the
      // qualitative signal (is_likely_duplicate + reasoning) either way.
      if (annotation.duplicate_of_id && !validExistingIds.has(annotation.duplicate_of_id)) {
        annotation.duplicate_of_id = null;
      }
      annotationsByRef.set(annotation.item_ref, annotation);
    }
  }

  const enrichedActions: EnrichedAction[] = newActions.map((a) => ({
    ...a,
    context_flags: toContextFlags(annotationsByRef.get(a.ref)),
  }));
  const enrichedDecisions: EnrichedDecision[] = newDecisions.map((d) => ({
    ...d,
    context_flags: toContextFlags(annotationsByRef.get(d.ref)),
  }));
  const risksWithContext = newRisks.map((r) => ({
    ...r,
    context_flags: toContextFlags(annotationsByRef.get(r.ref)),
  }));

  // --- Impact Analyst (risks carry their context_flags for grounding) ---
  const impactInput = {
    project: input.project,
    risks: risksWithContext as RiskForImpact[],
    dependencies: newDependencies as DependencyForImpact[],
    changeSignals: newChangeSignals as ChangeSignalForImpact[],
  };
  const impactRun = await runImpactAnalyst(impactInput);
  agentLogs.push({
    agentName: 'impact-analyst',
    model: impactRun.model || 'unknown',
    promptVersion: impactRun.promptVersion,
    inputRefs: {
      item_refs: [...newRisks, ...newDependencies, ...newChangeSignals].map((i) => i.ref),
    },
    rawOutput: impactRun.rawOutput,
    validationPassed: impactRun.validationPassed,
    errorMessage: impactRun.errorMessage,
  });

  const impactByRef = new Map<string, ImpactAssessmentAnnotation>();
  if (impactRun.validationPassed && impactRun.result) {
    for (const assessment of impactRun.result.assessments) {
      impactByRef.set(assessment.item_ref, assessment);
    }
  }

  const enrichedRisks: EnrichedRisk[] = risksWithContext.map((r) => ({
    ...r,
    impact_assessment: toImpactAssessment(impactByRef.get(r.ref)),
  }));
  const enrichedDependencies: EnrichedDependency[] = newDependencies.map((d) => ({
    ...d,
    impact_assessment: toImpactAssessment(impactByRef.get(d.ref)),
  }));
  const enrichedChangeSignals: EnrichedChangeSignal[] = newChangeSignals.map((c) => ({
    ...c,
    impact_assessment: toImpactAssessment(impactByRef.get(c.ref)),
  }));

  return {
    success: true,
    summary: draft.summary,
    enriched: {
      actions: enrichedActions,
      risks: enrichedRisks,
      issues: draft.issues,
      decisions: enrichedDecisions,
      dependencies: enrichedDependencies,
      change_signals: enrichedChangeSignals,
    },
    agentLogs,
  };
}
