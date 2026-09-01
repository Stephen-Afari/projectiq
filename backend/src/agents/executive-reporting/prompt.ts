import type { WeeklyReportInput } from './types.js';

export const PROMPT_VERSION = 'executive-reporting-v1';

export function buildSystemPrompt(): string {
  return `You are the Executive Reporting Agent for ProjectIQ.

Your only job: write a concise weekly executive summary for a project sponsor from the
structured project data you are given, and call the record_weekly_report tool. You never
invent data — every risk, action, or decision you reference must come from the input below.
You never take any action yourself; this is a report for a human to read.

Produce five sections:
- status_narrative: 2-4 short statements on overall status and trajectory this week. Always at
  least one item.
- key_risks: the risks a sponsor most needs to know about right now. Empty array if none.
- decisions_needed: decisions awaiting approval that need executive input. Empty array if none.
- escalations: overdue actions or worsened risks that need attention now. Empty array if none.
- management_attention_items: anything else worth flagging (e.g. open change signals, emerging
  patterns across the new items this week). Empty array if none.

Each item is { text, confidence_type }:
- "fact": a plain restatement of data you were given (e.g. "3 actions are overdue as of the
  report date").
- "inference": your own judgement about status or trajectory that is not a single stated data
  point (e.g. "delivery risk is trending upward given two risks that worsened this week").
- "recommendation": a suggested next step for the sponsor or PM. Phrase it as a suggestion, never
  as something decided or already happening.
Never blur these three — a sponsor must be able to tell what's known, what's judged, and what's
merely suggested. Do not pad a section with filler; an empty array is a correct answer when
there is genuinely nothing to report.`;
}

function describeProject(input: WeeklyReportInput): string {
  return `Project: ${input.project.name}${input.project.description ? `\nDescription: ${input.project.description}` : ''}
Status: ${input.project.status} | Health: ${input.project.health}${input.project.target_date ? `\nTarget date: ${input.project.target_date}` : ''}
Reporting period: ${input.weekStart} to ${input.weekEnd}`;
}

function describeNewItems(input: WeeklyReportInput): string {
  const c = input.newItemCounts;
  return `New items since last report: ${c.actions} action(s), ${c.risks} risk(s), ${c.issues} issue(s), ${c.decisions} decision(s), ${c.dependencies} dependency/dependencies, ${c.change_signals} change signal(s).`;
}

function listOrNone(lines: string[]): string {
  return lines.length ? lines.join('\n') : '(none)';
}

export function buildUserPrompt(input: WeeklyReportInput): string {
  return `${describeProject(input)}

${describeNewItems(input)}

Top risks (approved, high/critical severity):
${listOrNone(
  input.topRisks.map(
    (r) => `- ${r.description} (severity: ${r.severity ?? 'unknown'}, owner: ${r.owner ?? 'unassigned'})`,
  ),
)}

Overdue actions (approved, past due date):
${listOrNone(
  input.overdueActions.map((a) => `- ${a.description} (owner: ${a.owner ?? 'unassigned'}, due ${a.due_date})`),
)}

Risks whose severity has worsened since it was last edited:
${listOrNone(
  input.worseningRisks.map((r) => `- ${r.description} (was ${r.previous_severity}, now ${r.severity})`),
)}

Decisions awaiting approval:
${listOrNone(input.pendingDecisions.map((d) => `- ${d.decision}`))}

Open change signals (approved):
${listOrNone(
  input.openChangeSignals.map((c) => `- [${c.change_type ?? 'unspecified'}] ${c.description}`),
)}

Call record_weekly_report with your structured executive summary based only on the data above.`;
}

export function buildRepairPrompt(
  input: WeeklyReportInput & { previousOutput: unknown; validationErrors: string },
): string {
  return `${buildUserPrompt(input)}

Your previous attempt to call record_weekly_report did not match the required schema.

Previous output:
${JSON.stringify(input.previousOutput, null, 2)}

Validation errors:
${input.validationErrors}

Call record_weekly_report again with a corrected result that fixes exactly these errors.`;
}
