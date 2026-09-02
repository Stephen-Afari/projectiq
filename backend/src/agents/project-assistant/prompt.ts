import type { ProjectAssistantInput } from './types.js';

export const PROMPT_VERSION = 'project-assistant-v1';

export function buildSystemPrompt(): string {
  return `You are the ProjectIQ Project Assistant — a Q&A tool that answers a project manager's
natural-language questions about ONE project, using ONLY the structured data given to you below.
You have no other source of information. You never take any action; this is read-only Q&A.

Call record_project_query with:
- answer: an array of statements, each { text, confidence_type, citations }. Always at least one
  statement, even if only to say the question can't be answered from this data.
- data_gap: null if the data fully answers the question. Otherwise a short, specific statement of
  exactly what's missing (e.g. "ProjectIQ does not track budget/spend figures, so I can't quantify
  cost overrun."). Still answer whatever CAN be answered in the answer array — data_gap covers only
  the part you can't.

Rules, no exceptions:
- NEVER invent a fact, record, number, or name that isn't in the data below. If you don't know,
  say so in data_gap — do not guess or estimate to fill a gap.
- Every statement's confidence_type:
  - "fact": a plain restatement of something in the data (e.g. "3 actions are overdue").
  - "inference": your own judgement/synthesis not directly stated as one data point (e.g. "risk to
    the go-live date appears to be increasing").
  - "recommendation": a suggested next step. Phrase it as a suggestion, never as decided.
- citations: reference the specific records a statement is grounded in, using the exact id/type
  given in the data below. Omit citations only for statements with nothing specific to cite (e.g.
  "no risks are currently open"). Never invent an id.
- Answer the question asked. Don't pad with unrelated sections.

Data vocabulary, so you interpret the fields correctly:
- "worsening" / "increased in severity" risks = risks with a non-null previous_severity.
- "overdue" actions = past their due_date and not done/cancelled (already filtered for you below).
- "awaiting approval" / "needs approval" decisions = approval_status "pending".
- "since our last meeting" / "what changed" = items whose created_at is at/after since_last_meeting.
- A request like "generate a steering committee update" means: synthesize multiple statements
  covering overall status/health, key risks, decisions needing approval, and escalations (overdue
  actions, worsened risks) — the same categories a status report would cover, phrased as direct
  answer statements.
- "what could delay the project" = synthesize from risks/dependencies/change_signals whose
  reasoning/description suggests schedule impact, plus overdue actions — this is necessarily an
  inference, tag it as such.`;
}

function describeProject(input: ProjectAssistantInput): string {
  const p = input.project;
  return `Project: ${p.name}${p.description ? `\nDescription: ${p.description}` : ''}
Status: ${p.status} | Health: ${p.health} (Schedule: ${input.subHealth.schedule}, Budget: ${input.subHealth.budget}, Scope: ${input.subHealth.scope}, Resources: ${input.subHealth.resources})${p.target_date ? `\nTarget date: ${p.target_date}` : ''}
Since last meeting: ${input.sinceLastMeeting ?? '(no meetings recorded yet)'}`;
}

function describeMeetings(input: ProjectAssistantInput): string {
  if (!input.meetings.length) return '(none)';
  return input.meetings
    .slice()
    .sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1))
    .map((m) => `- type=meeting id=${m.id} | "${m.title}" on ${m.meeting_date}`)
    .join('\n');
}

function listOrNone(lines: string[]): string {
  return lines.length ? lines.join('\n') : '(none)';
}

export function buildUserPrompt(input: ProjectAssistantInput): string {
  return `${describeProject(input)}

Question: "${input.question}"

=== Reference data (approved only, except decisions which include pending) ===

Meetings (most recent first):
${describeMeetings(input)}

Actions (${input.actions.length}):
${listOrNone(
  input.actions.map(
    (a) =>
      `- type=action id=${a.id} | ${a.description} (status: ${a.status}, priority: ${a.priority}, owner: ${a.owner ?? 'unassigned'}, due: ${a.due_date ?? 'none'}, created: ${a.created_at})`,
  ),
)}

Risks (${input.risks.length}), sorted by severity:
${listOrNone(
  input.risks
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map(
      (r) =>
        `- type=risk id=${r.id} | ${r.description} (severity: ${r.severity ?? 'unknown'}, previous_severity: ${r.previous_severity ?? 'none'}, probability: ${r.probability ?? 'unknown'}, owner: ${r.owner ?? 'unassigned'}, mitigation: ${r.mitigation ?? 'none'}, created: ${r.created_at})`,
    ),
)}

Issues (${input.issues.length}):
${listOrNone(
  input.issues.map(
    (i) =>
      `- type=issue id=${i.id} | ${i.description} (status: ${i.status}, severity: ${i.severity ?? 'unknown'}, owner: ${i.owner ?? 'unassigned'}, created: ${i.created_at})`,
  ),
)}

Decisions (${input.decisions.length}, includes pending):
${listOrNone(
  input.decisions.map(
    (d) =>
      `- type=decision id=${d.id} | ${d.decision} (approval_status: ${d.approval_status}, owner: ${d.decision_owner ?? 'unassigned'}, date: ${d.decision_date ?? 'none'}, created: ${d.created_at})`,
  ),
)}

Dependencies (${input.dependencies.length}):
${listOrNone(
  input.dependencies.map(
    (d) =>
      `- type=dependency id=${d.id} | ${d.description} (status: ${d.status}, ${d.upstream_activity ?? '?'} → ${d.downstream_activity ?? '?'}, created: ${d.created_at})`,
  ),
)}

Change signals (${input.changeSignals.length}):
${listOrNone(
  input.changeSignals.map(
    (c) =>
      `- type=change_signal id=${c.id} | [${c.change_type ?? 'unspecified'}] ${c.description} (status: ${c.status}, potential_impact: ${c.potential_impact ?? 'none'}, created: ${c.created_at})`,
  ),
)}

Precomputed helpers:
- Overdue actions: ${listOrNone(input.overdueActions.map((a) => `id=${a.id}`))}
- Worsening risks: ${listOrNone(input.worseningRisks.map((r) => `id=${r.id}`))}
- Pending decisions: ${listOrNone(input.pendingDecisions.map((d) => `id=${d.id}`))}

Call record_project_query with your grounded answer to the question above.`;
}

function severityRank(severity: string | null): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity ?? ''] ?? -1;
}

export function buildRepairPrompt(
  input: ProjectAssistantInput & { previousOutput: unknown; validationErrors: string },
): string {
  return `${buildUserPrompt(input)}

Your previous attempt to call record_project_query did not match the required schema.

Previous output:
${JSON.stringify(input.previousOutput, null, 2)}

Validation errors:
${input.validationErrors}

Call record_project_query again with a corrected result that fixes exactly these errors.`;
}
