# 2026-08-30 — Executive Reporting Agent + "Weekly Report" n8n Workflow

## Decision
Added the 4th and final agent, Executive Reporting, plus the scheduled
n8n workflow that triggers it. `POST /api/ai/weekly-report` gathers a
project's current state, calls Claude to write a confidence-typed
executive summary (status, key risks, decisions needed, escalations,
management-attention items), persists it to a new `weekly_reports` table,
and returns it. `n8n/weekly_report.json` runs this weekly for every
project and emails the result.

## Not part of the meeting pipeline
`pipeline.ts` (`runMeetingAnalysisPipeline`) orchestrates the 3 per-meeting
agents specifically — Meeting Analyst's draft items with temp refs,
Context Analyst comparing against existing records, Impact Analyst
assessing the same batch. Executive Reporting runs on a schedule against
*accumulated* project state, not a single fresh transcript, so it's
triggered directly by its own route (`runExecutiveReportingAgent`,
mirroring how any single agent's `run()` is called), following the exact
same per-agent folder pattern (`schema.ts`/`types.ts`/`prompt.ts`/
`run.ts`/`index.ts`) as `impact-analyst/`, and reusing
`runStructuredWithRetry` (`backend/src/services/llm/runStructured.ts`)
completely unmodified.

## Data gathering is JS filtering over existing list helpers — no new query layer
Confirmed before building: `backend/src/db/queryTable.ts` only supports
single-column equality filters, and both existing aggregate endpoints
(`/dashboard`, `/alerts`) already fetch a project's full lists and
filter/aggregate in JS rather than pushing filters into Postgres. The
weekly-report route follows the same shape:
- All six item types via the existing `list*ByProject` functions
  (`Promise.all`).
- "New since last week": `created_at >= week_start` filtered in JS.
  `week_start` defaults to 7 days before now if the caller (n8n) doesn't
  supply one.
- Top risks: `approval_status === 'approved'` and severity `high`/`critical`.
- Open change signals: `approval_status === 'approved'` and `status === 'open'`.
- Overdue actions / worsening risks / pending decisions: **identical logic
  to `GET /api/projects/:id/alerts`**, extracted into
  `backend/src/lib/projectAlerts.ts` (`computeProjectAlerts`) so the
  alerts digest and the weekly report's escalations section can never
  silently drift apart. `routes/projects.ts`'s `/alerts` handler was
  refactored to call the same helper — pure extraction, no behavior
  change (re-verified live below).

## Confidence typing, adapted for a summary agent (not locked like Impact Analyst)
Every other agent tags extracted *entities*; this one tags *narrative
lines*. Each item is `{ text, confidence_type }` using the plain
`confidenceTypeSchema` (fact/inference/recommendation) — unlike Impact
Analyst, which structurally locks `confidence_type` to `'inference'`
because an impact projection is never a stated fact. A weekly-report line
genuinely can be any of the three ("3 actions are overdue" is a fact;
"delivery risk is trending upward" is an inference; "confirm a revised due
date" is a recommendation), so locking it here would be wrong, not just
unnecessary. The prompt is explicit that these must never blur.

## Reports are persisted, not just returned
New table `weekly_reports` (migration
`20260830090000_weekly_reports.sql`): `project_id`, `week_start`,
`week_end`, `status_summary` (plain text, joined from the structured
`status_narrative` items — for email/quick display without re-parsing
JSON), `report_json` (the full structured output), `model`,
`prompt_version`, `created_at`. RLS follows the same project-scoped
pattern as every other project-linked table. No `approval_status` — a
generated report is an artifact, not a proposed change to project data;
nothing about generating or reading it requires human approval per the
existing AI Rules (approval gates apply to actions/risks/decisions/etc.
becoming live data, not to a report describing them).

`backend/src/db/tables/weeklyReports.ts` (`createWeeklyReport`,
`listWeeklyReportsByProject`) uses the existing `insertRow`/
`selectByColumn` helpers — no new query-layer code. New
`GET /api/projects/:id/reports` exposes the list; no dashboard page exists
yet to render it (same disclosed-limitation pattern as the `/alerts`
project-link), so this is a data-availability endpoint, not a UI feature,
for now.

## `n8n/weekly_report.json` structure (8 nodes)
Schedule Trigger (weekly, Monday 08:00) → HTTP "Get Projects" → HTTP
"Generate Weekly Report" (`POST .../api/ai/weekly-report`,
`{ project_id }`, `continueOnFail: true` so one project's agent failure
doesn't stop the run for the rest) → IF "Report Generated?" → true: Code
"Format Report Email" (builds subject + plain-text/HTML body from the
structured response, each line prefixed with its FACT/INFERENCE/
RECOMMENDATION label so the labeling survives into the email) → Send
Email (`emailSend`, real node, reuses `$env.ALERTS_FROM_EMAIL`/
`$env.ALERTS_TO_EMAIL` from the alerts workflow) + HTTP "Attach PDF
(Placeholder)" (`continueOnFail: true`); false: NoOp.

## PDF attachment is a disclosed placeholder
Real PDF rendering needs a dependency neither this backend nor a bare n8n
instance has by default. Matches the established real-channel +
placeholder-channel pattern from `project_alerts.json` (real email,
placeholder Slack/Teams): email is the real delivery channel here; the
"Attach PDF" HTTP node points at `$env.PDF_GENERATION_WEBHOOK_URL`
(unset by default), `continueOnFail: true`, explicitly labelled as a
placeholder in the node name — not wired to a real PDF service.

## Verified live against real Apex data
`POST /api/ai/weekly-report` for the "ERP Transformation Programme"
project returned `201` with a structured report: 3 status-narrative
lines, 2 key risks, 3 decisions needed, 2 escalations, 3
management-attention items, every one correctly confidence-tagged
(facts restating counts/dates, inferences about trajectory, one explicit
recommendation to confirm a revised due date). A row was written to
`weekly_reports` (confirmed via `GET /api/projects/:id/reports` returning
it) and to `agent_runs`. `GET /:id/alerts` was re-checked after the
`computeProjectAlerts` refactor to confirm identical output to before the
extraction — no behavior change from moving the logic.

## Disclosed limitation
`n8n/weekly_report.json` was hand-authored to n8n's export schema and
validated as well-formed JSON, but — same as every other workflow file in
this project — not executed inside a live n8n instance by me. The
backend-side behavior that carries the actual correctness risk (data
gathering, confidence tagging, persistence) was verified live against
real Apex data, which is the substantive part.

## What It Affects
- `supabase/migrations/20260830090000_weekly_reports.sql` (new).
- `backend/src/db/types.ts` (`WeeklyReport`).
- `backend/src/db/tables/weeklyReports.ts` (new), `backend/src/db/index.ts`.
- `backend/src/lib/projectAlerts.ts` (new — extracted from `routes/projects.ts`).
- `backend/src/agents/executive-reporting/` (new — `schema.ts`, `types.ts`,
  `prompt.ts`, `run.ts`, `index.ts`).
- `backend/src/schemas/ai.ts` (`weeklyReportSchema`).
- `backend/src/routes/ai.ts` (`POST /weekly-report`).
- `backend/src/routes/projects.ts` (`GET /:id/reports`; `/:id/alerts`
  refactored to use `computeProjectAlerts`).
- `n8n/weekly_report.json` (new).
- `CLAUDE.md` — Database Conventions (`weekly_reports`), API Conventions
  (new routes), AI Rules (4th agent).
