import type { Action, Decision, Risk } from '../../db/types.js';
import type { ExtractedActionWithRef, ExtractedDecisionWithRef, ExtractedRiskWithRef } from './types.js';

export const PROMPT_VERSION = 'context-analyst-v1';

export function buildSystemPrompt(): string {
  return `You are the Project Context Analyst agent for ProjectIQ.

Your only job: compare newly extracted actions, risks, and decisions against this project's
EXISTING records, and annotate each new item with duplicate/relationship information by calling
the record_context_analysis tool. You never merge, delete, edit, or block the creation of any
record — every new item still becomes its own row; your annotation is what lets a human reviewer
see "this looks like it restates risk X" instead of two indistinguishable pending items. You must
return exactly one annotation per new item, keyed by item_ref.

=== DUPLICATE DETECTION ===
Mark is_likely_duplicate true only when a new item is substantially the SAME underlying
action/risk/decision as an existing one — restating the same task, the same risk, or the same
decision in different words — not merely on a related topic. When true, set duplicate_of_id to
that EXISTING item's id. Only use ids that appear in the "Existing records" list below — never
invent or guess an id. When not a likely duplicate, is_likely_duplicate is false and
duplicate_of_id is null (and duplicate_reasoning is null too).

=== RELATIONSHIPS (separate from duplication) ===
Note when a new item clearly relates to another item — existing or another new item in this same
batch — without being a duplicate of it. Examples: "this action addresses risk X", "this decision
resolves issue Y", "this risk is a consequence of dependency Z". Reference the other item by its
ref: an existing item's real id, or another new item's ref (e.g. "risk-1"). Leave related_items
empty ([]) when there's no clear relationship — do not force a connection that isn't really there.

=== CONFIDENCE ===
confidence_type describes YOUR duplicate/relationship judgement itself. This is almost always
"inference" — you are the one deciding two items are related or duplicative; nobody in the
meeting said "this duplicates X." Use "fact" only in the rare case someone explicitly referenced
a prior item by name (e.g. "as we discussed in the kickoff, that risk is still open"). Never use
"recommendation" here — that label is for the other agents, not for annotation judgements.`;
}

function describeExisting(
  actions: Action[],
  risks: Risk[],
  decisions: Decision[],
): string {
  const lines: string[] = [];
  if (actions.length) {
    lines.push('Existing actions:');
    for (const a of actions) lines.push(`- id=${a.id} | ${a.description} (owner: ${a.owner ?? 'unassigned'}, status: ${a.status})`);
  }
  if (risks.length) {
    lines.push('Existing risks:');
    for (const r of risks) lines.push(`- id=${r.id} | ${r.description} (severity: ${r.severity ?? 'unknown'}, status: ${r.status})`);
  }
  if (decisions.length) {
    lines.push('Existing decisions:');
    for (const d of decisions) lines.push(`- id=${d.id} | ${d.decision}`);
  }
  return lines.length ? lines.join('\n') : '(none — this is the first analysis for this project)';
}

function describeNew(
  actions: ExtractedActionWithRef[],
  risks: ExtractedRiskWithRef[],
  decisions: ExtractedDecisionWithRef[],
): string {
  const lines: string[] = [];
  if (actions.length) {
    lines.push('New actions:');
    for (const a of actions) lines.push(`- ref=${a.ref} | ${a.description} (owner: ${a.owner ?? 'unassigned'})`);
  }
  if (risks.length) {
    lines.push('New risks:');
    for (const r of risks) lines.push(`- ref=${r.ref} | ${r.description} (severity: ${r.severity ?? 'unknown'})`);
  }
  if (decisions.length) {
    lines.push('New decisions:');
    for (const d of decisions) lines.push(`- ref=${d.ref} | ${d.decision}`);
  }
  return lines.join('\n');
}

export interface ContextAnalystPromptInput {
  newActions: ExtractedActionWithRef[];
  newRisks: ExtractedRiskWithRef[];
  newDecisions: ExtractedDecisionWithRef[];
  existingActions: Action[];
  existingRisks: Risk[];
  existingDecisions: Decision[];
}

export function buildUserPrompt(input: ContextAnalystPromptInput): string {
  return `Existing records for this project:
${describeExisting(input.existingActions, input.existingRisks, input.existingDecisions)}

New items just extracted from the latest meeting:
${describeNew(input.newActions, input.newRisks, input.newDecisions)}

Call record_context_analysis with one annotation per new item listed above.`;
}

export function buildRepairPrompt(
  input: ContextAnalystPromptInput & { previousOutput: unknown; validationErrors: string },
): string {
  return `${buildUserPrompt(input)}

Your previous attempt to call record_context_analysis did not match the required schema.

Previous output:
${JSON.stringify(input.previousOutput, null, 2)}

Validation errors:
${input.validationErrors}

Call record_context_analysis again with a corrected result that fixes exactly these errors.`;
}
