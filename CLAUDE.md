# CLAUDE.md — ProjectIQ

## Purpose
ProjectIQ turns meeting transcripts into governed, structured project-management
intelligence (actions, risks, issues, decisions, dependencies, change signals) via
four controlled AI agents, with mandatory human approval before any consequential
change or downstream write. Portfolio MVP using synthetic data (Apex Manufacturing
Ltd — ERP Transformation Programme). Optimise for correctness, auditability, and
a clean end-to-end demo story over feature breadth.

## Architecture
- Monorepo: `frontend/` (React/Vite/Tailwind), `backend/` (Node/Express),
  `supabase/` (migrations+seed), `n8n/` (workflow exports), `docs/`.
- Pipeline: transcript → Agent 1 (Meeting Analyst) → Agent 2 (Project Context
  Analyst, dedup/relationship flags) → Agent 3 (Impact Analyst, schedule/
  cost/scope/resource/dependency assessment) → **single** persistence step,
  storing enriched items pending → human review/approval → live records →
  Q&A (RAG) → Agent 4 (Executive Reporting, scheduled). Note: Impact
  Analyst runs pre-approval, on every newly extracted item — not only on
  already-approved changes as originally sketched in the Phase 1 plan; see
  `docs/decision-log/2026-08-25-context-and-impact-agents.md` for why
  (assessing impact before a human decides is more useful than after).
- All AI agent code lives server-side in `backend/src/agents/*`. The frontend
  never calls Claude/OpenRouter directly and never holds an API key.
- Every AI output is schema-validated (zod, in `backend/src/schemas/`) before
  it is written to the database.
- n8n owns scheduling (weekly summary trigger) and the approval-gated
  downstream push; it never writes directly to core entity tables — only via
  the Express API, so validation/RLS/audit always apply.

## Tech Stack
React + Vite + Tailwind · Node.js + Express · Supabase/Postgres + pgvector ·
n8n · Claude API (Anthropic SDK) as primary model, OpenRouter as an optional
dev-time provider behind the same interface · zod for schema validation ·
TypeScript across `frontend/` and `backend/`.

## Coding Conventions
- TypeScript everywhere; no `any` in agent I/O or API boundary code.
- One agent = one folder (`prompt.ts`, `schema.ts`, `run.ts`, `index.ts`).
  Agents do not call each other directly — orchestration happens in
  `backend/src/routes/` or a thin orchestrator service, so each agent stays
  independently testable.
- No speculative abstraction: don't build a plugin system, generic connector
  framework, or multi-provider router beyond the Claude/OpenRouter switch
  already scoped. Add it when a second real case exists, not before.
- Entity/agent I/O types are defined once and imported across `frontend/` and
  `backend/`, not duplicated; introduce a shared-types package only if/when
  real duplication pain shows up.
- Small, focused commits; no dead code, no commented-out blocks.

## Security Rules
- Secrets only via env vars (`.env`, never committed — already gitignored).
  Never hardcode keys, never log full API responses containing secrets.
- All webhooks (n8n → API, API → n8n) must verify a signature/secret
  (`N8N_WEBHOOK_SECRET`); reject unsigned or mismatched requests. First
  real instance: `POST /api/webhooks/n8n/meetings`
  (`backend/src/middleware/verifyWebhookSecret.ts`, header
  `X-N8N-Webhook-Secret`) — a dedicated route, not a reuse of the
  frontend's unauthenticated `POST /api/meetings`, since external traffic
  is a different trust boundary. Internal calls the frontend already makes
  unauthenticated (e.g. `POST /api/ai/analyse-meeting`) are a deliberate,
  documented exception, not silently exempted — see
  `docs/decision-log/2026-08-28-n8n-meeting-ingestion.md`.
- External-facing webhook routes are rate-limited
  (`backend/src/middleware/webhookRateLimit.ts`, `express-rate-limit`),
  scoped to just those routes — not applied globally.
- **API → n8n direction**: `backend/src/services/approvalEvents.ts` POSTs
  to `N8N_APPROVAL_WEBHOOK_URL` with the `X-N8N-Webhook-Secret` header
  (same shared secret, other direction) whenever an item's
  `approval_status` becomes `'approved'` — first real use of the "API →
  n8n" half of the webhook-signing rule above (the n8n → API half was
  already covered by the ingestion/analysis endpoints). Best-effort: 5s
  timeout, errors logged not thrown, skipped silently if the env var is
  unset — a human's approval action must always succeed regardless of
  whether n8n is reachable.
- Validate every external input (API payloads, webhook bodies, transcript
  uploads) at the boundary before it touches business logic or the DB.
- Supabase Row Level Security is mandatory on every table holding org/project
  data — no table ships without an RLS policy and a test proving isolation.
- Every consequential action (approve, edit, reject, push, delete) is written
  to `audit_log` with actor, timestamp, before/after state.
- Service-role Supabase key is backend-only, never exposed to the frontend or
  committed; frontend uses the anon key + RLS.

## Database Conventions
- All tables scoped by `organisation_id` (and `project_id` where applicable);
  RLS policy per table (see below).
- Extracted-entity tables (`actions`, `risks`, `issues`, `decisions`,
  `dependencies`, `change_signals`) carry: `approval_status` (`pending`/
  `approved`/`rejected`, default `pending`), `meeting_id` (nullable —
  records can originate outside a meeting, e.g. later from the Impact
  Analyst), `source_excerpt`, `created_by_agent`, `approved_by`,
  `approved_at`, and `confidence_type` (`fact`/`inference`/`recommendation`,
  nullable until an agent tags it). No status transitions outside
  `updateApprovalStatus` in the relevant `backend/src/db/tables/*.ts` module.
- `users.id references auth.users(id)` — set up ahead of Supabase Auth
  (Phase 3) so RLS can key off `auth.uid()` without a later re-migration.
  Inert until login exists.
- **RLS is defense-in-depth, not the backend's only authorization
  boundary.** Isolation is enforced via a `SECURITY DEFINER` helper,
  `public.current_organisation_id()`, which looks up the caller's org
  through `public.users`; every table's policy checks against it (directly,
  or via `EXISTS (... projects ...)` for project-scoped tables). The
  **service-role key bypasses RLS entirely** (Supabase platform behavior),
  and the backend always uses that key — so every function in
  `backend/src/db/tables/*.ts` must itself take and filter by an explicit
  `organisationId`/`projectId`/id parameter. RLS protects the frontend's
  anon/authenticated key and any future direct client access; it does not
  protect against a backend bug that forgets to scope a query.
- Migrations are the only way to change schema — no ad hoc console edits;
  every migration file lives in `supabase/migrations`, is committed, and is
  timestamped. Applied via `npm run db:migrate` (`scripts/apply-migrations.mjs`,
  a direct `pg` connection to `SUPABASE_DB_URL` — the Supabase CLI's `db
  push` requires the IPv6-only direct-connection host and doesn't work in
  every dev environment; use the Session Pooler connection string, which is
  IPv4-reachable). Verify with `npm run db:verify`.
- Embeddings (pgvector) are derived data — always regenerable from source
  records/transcripts, never the source of truth themselves. Not yet
  migrated — added when the RAG Q&A phase needs them.
- `context_flags jsonb` (nullable) on `actions`/`risks`/`decisions` and
  `impact_assessment jsonb` (nullable) on `risks`/`dependencies`/
  `change_signals` — written by the Context Analyst and Impact Analyst
  respectively (`risks` gets both; `issues` gets neither — out of scope for
  both agents per their current prompts). JSONB rather than a normalized
  table: this is still-evolving AI-derived annotation data, not yet a
  first-class queried entity — same reasoning as `agent_runs.raw_output`.
  Shapes: `ContextFlags`/`ImpactAssessment` in `backend/src/db/types.ts`.
- `risks.previous_severity` / `risks.severity_changed_at` (both nullable)
  — a worsening-severity baseline, not a full history table. Set by
  `PATCH /api/risks/:id/edit` only when an edit makes `severity` rank
  higher than it was (`low<medium<high<critical`); cleared (`null`) the
  next time severity is edited to something not worse. Powers the Project
  Alerts workflow's "risks whose severity has worsened" query
  (`GET /api/projects/:id/alerts`) — a risk stays flagged until its
  severity is touched again; no separate acknowledge flow exists.
- `weekly_reports` — one row per generated Executive Reporting Agent run:
  `project_id`, `week_start`/`week_end`, `status_summary` (plain text,
  joined from `report_json.status_narrative` for email/quick display),
  `report_json` (the full structured, confidence-typed agent output),
  `model`, `prompt_version`. Written only by `POST /api/ai/weekly-report`;
  never edited/approved — a report is a generated artifact, not an
  extracted-entity table, so it doesn't carry `approval_status`. See
  `docs/decision-log/2026-08-30-executive-reporting-agent-weekly-report.md`.

## API Conventions
- One Express router per resource in `backend/src/routes/` (`projects.ts`,
  `meetings.ts`, `actions.ts`, `risks.ts`, `issues.ts`, `decisions.ts`,
  `dependencies.ts`, `changeSignals.ts`, `users.ts`, `ai.ts`), mounted in
  `index.ts` under `/api/<resource>` (`change_signals` is mounted at
  `/api/change-signals` — kebab-case in URLs, snake_case in the DB/JSON
  body, same pattern as the table name vs. REST path elsewhere).
  Project-scoped reads (`GET /api/projects/:id/actions`, `/risks`,
  `/decisions`, `/dashboard`) live in `projects.ts`; the meeting-scoped
  read-everything endpoint, `GET /api/meetings/:id/results`, lives in
  `meetings.ts`.
- Every route handler is wrapped in `middleware/asyncHandler.ts` so a
  rejected promise reaches `middleware/errorHandler.ts` instead of hanging.
- Every POST/PATCH body is validated with `middleware/validateBody.ts`
  against a zod schema in `backend/src/schemas/`, one file per resource.
- **All error responses share one shape**: `{ error: { message, details?
  } }`. `ApiError` (`backend/src/lib/ApiError.ts`), thrown by route
  handlers, carries the intended status code (404 for missing records,
  etc); anything else is logged server-side and returned as a generic 500
  (never leaks internals). Validation failures are 400 with `details` set
  to zod's `flatten()` output.
- **Two separate PATCH routes per extracted-entity resource, kept
  deliberately distinct**:
  - `PATCH /api/<resource>/:id` — approval only. Accepts exactly
    `{ approval_status: 'approved' | 'rejected', approved_by: <user id> }`,
    mirrors the DB-layer rule (`updateApprovalStatus`). No content field is
    ever touched by this route.
  - `PATCH /api/<resource>/:id/edit` — content only. Accepts a partial
    body of that resource's editable fields (+ `confidence_type`, since
    correcting a mislabeled fact/inference is exactly what human review is
    for) via an `edit<Type>Schema` (`.refine` rejects an empty body). Never
    touches `approval_status`. This split keeps the approval PATCH's
    guarantee ("narrow, single-purpose, always audited") intact instead of
    loosening it to also carry content edits.
  - All six extracted-entity resources (`actions`, `risks`, `issues`,
    `decisions`, `dependencies`, `change_signals`) have both routes now —
    `issues`/`dependencies`/`change_signals` had no routes at all before
    the review screen needed them (their `db/tables/*.ts` CRUD functions
    existed from Phase 2 but were never wired up).
- AI endpoints: `POST /api/ai/analyse-meeting` (real), `POST
  /api/ai/project-query` — still `501` (Phase 7).
- `GET /api/users` — unscoped list, same placeholder rationale as `GET
  /api/projects`: no auth/org session on the frontend yet. Backs the
  review screen's "Reviewing as" picker, standing in for real
  `approved_by` provenance until Auth ships. Not built as if permanent.
- Seeding demo users: since `users.id references auth.users(id)`, seed
  scripts must create real Supabase Auth accounts via
  `supabase.auth.admin.createUser` (service-role client), not fabricated
  UUIDs — see `backend/scripts/seed.ts`.
- `POST /api/webhooks/n8n/meetings` — secret-verified + rate-limited
  external ingestion endpoint for n8n (see Security Rules). Field name is
  `transcript` (matching the external contract), not `transcript_text` as
  used internally — mapped in the route, not leaked into
  `createMeetingWithTranscript`'s shared signature.
- `PATCH /api/webhooks/n8n/meetings/:id/analysis-status` — secret-verified
  + rate-limited. Only `{ status: 'failed', error? }` is accepted (a
  literal, not a free enum) — this route exists solely as the n8n Meeting
  Analysis workflow's fallback for marking a meeting as needing attention
  when it can't reach the backend at all; moving to `'completed'` only
  ever happens as a side effect of `analyse-meeting` actually succeeding.
- **`POST /api/ai/analyse-meeting` is idempotent.** `meetings.analysis_status`
  (`pending`/`completed`/`failed`) tracks this. A call on an already-
  `completed` meeting short-circuits — returns `200` with the *existing*
  extracted items instead of re-running the 3-agent pipeline and creating
  a duplicate batch. Pass `{ force: true }` to bypass this for deliberate
  re-analysis. On pipeline failure, the route itself sets
  `analysis_status='failed'` with the error message before returning
  `502` — this is the primary "mark the meeting as needing attention"
  path; the n8n workflow's explicit `PATCH .../analysis-status` call is
  only a fallback for when the backend was never reached at all. Verified
  live: two consecutive calls on the same meeting return byte-identical
  item ids, not two batches — see
  `docs/decision-log/2026-08-27-n8n-meeting-analysis-workflow.md`.
- `GET /api/projects/:id/alerts` — read-only aggregate for the Project
  Alerts n8n workflow: `overdue_actions` (approved, past due, not
  done/cancelled), `worsening_risks` (approved, `previous_severity` set),
  `pending_decisions` (not yet approved — surfaced for visibility only,
  see AI Rules). Unauthenticated like `/dashboard`/`/results` (read-only,
  same trust boundary as the frontend's other reads — not a webhook-
  ingestion endpoint). Includes `project.url` pointing at
  `FRONTEND_BASE_URL/projects/:id` — now a real page (the Project
  Dashboard, see Frontend Conventions and Dashboard Conventions below).
- `GET /api/projects/:id/dashboard` — the Project Dashboard's data source.
  Returns `project` (incl. the existing `health` column, unchanged),
  `sub_health` (Schedule/Budget/Scope/Resources — see Dashboard
  Conventions), `new_since_last_meeting` (approved actions/risks/
  decisions/issues created at/after the project's most recent
  `meeting_date`; `since: null` and all-zero counts if the project has no
  meetings yet), `counts` (approved totals per entity type),
  `overdue_actions`/`decisions_needing_attention` (reusing
  `computeProjectAlerts`, same as `/alerts`), `top_risks` (approved,
  severity-ranked, top 5), `open_issues`/`open_dependencies`/
  `change_signals` (approved, status-filtered), and `recent_intelligence`
  (approved items across all six entity types, merged and sorted by
  `created_at`, top 15). Every list is approved-only **except**
  `decisions_needing_attention`, which is deliberately the pending
  category (same documented exception as `/alerts`). Built with
  `Promise.all` over the existing `list*ByProject` helpers — no new
  query-layer capability, same convention as `/alerts` and the weekly
  report. This replaced the endpoint's earlier `counts.actions.by_status`-
  style shape, which had zero frontend consumers before this.
- `POST /api/ai/weekly-report` — runs the Executive Reporting Agent for one
  project (`{ project_id, week_start? }`, `week_start` defaults to 7 days
  before now). Gathers project data via the existing `list*ByProject`
  helpers (no new query-layer capability — "new since last week" and
  every other cut is a JS filter over the full list, same as
  `/dashboard`/`/alerts`); reuses `computeProjectAlerts`
  (`backend/src/lib/projectAlerts.ts`, extracted from the `/alerts` route
  so both stay in sync) for overdue actions/worsening risks/pending
  decisions. Persists the structured result to `weekly_reports` and logs
  to `agent_runs` exactly like the meeting pipeline's agents. Returns
  `502` (not persisted) if the agent fails validation after retries.
  Unauthenticated, same trust boundary as the rest of `/api/ai`.
- `GET /api/projects/:id/reports` — lists persisted `weekly_reports` for a
  project, oldest first. The Project Dashboard does not render these
  (it's a live snapshot, not a report archive) — delivery is still via
  the Weekly Report n8n workflow's email step; this endpoint exists so the
  data is at least fetchable ahead of a future reports-archive UI.
- `GET /api/projects/:id/issues`, `/dependencies`, `/change-signals`,
  `/meetings` — the same "full unfiltered project list" pattern as the
  pre-existing `/:id/actions`/`/:id/risks`/`/:id/decisions` (no
  `approval_status` filter — unlike the dashboard, these are the drill-down
  data source and deliberately include pending/rejected rows so a PM
  browsing in isn't limited to what the summary tile showed). `/meetings`
  additionally backs the drill-down screen's "source meeting" resolution
  (`meeting_id` → title/date), fetched once rather than per-record.

## Ingestion Conventions
- Meetings can be created two ways, sharing one service function
  (`createMeetingWithTranscript`, `backend/src/services/meetingIngestion.ts`):
  the frontend's `POST /api/meetings` (no auth, same-origin) and n8n's
  `POST /api/webhooks/n8n/meetings` (secret-verified, external). Both do
  the same project-lookup + create + transcript-upload sequence — don't
  duplicate that logic in a third place; extend the shared service instead.
- Raw meeting transcript text is stored in a private Supabase Storage
  bucket, `transcripts` (provisioned by `npm run setup:storage`, see
  `backend/scripts/setup-storage.ts`), never as a large text column in
  Postgres. `meetings.transcript_reference` holds the storage object path,
  convention `<project_id>/<meeting_id>.txt` — this matches the
  `documents.storage_url` pattern already used for uploaded files.
- `POST /api/meetings` is the only write path: it creates the `meetings`
  row first, then uploads the transcript (if provided) via
  `backend/src/services/transcriptStorage.ts`, then updates
  `transcript_reference`. `transcript_text` in the request body is
  optional at the schema level (meetings can exist without a transcript)
  but the frontend's New Meeting screen requires it, since transcript
  capture is that screen's whole purpose.
- The frontend never talks to Supabase Storage directly — only to the
  Express API — so no storage-level RLS policy exists yet (the
  service-role key bypasses storage RLS the same way it bypasses table
  RLS, per Database Conventions above). Add a policy if/when the frontend
  ever needs to read transcripts directly.
- No cross-store transaction: if the Storage upload fails after the
  `meetings` row is created, the API returns `502` but the (transcript-less)
  meeting row still exists. Acceptable for MVP; revisit if this proves
  confusing in practice.

## Dashboard Conventions
- **Overall project health is the existing `projects.health` column** —
  the dashboard displays it, never recomputes or overrides it. It's the
  one health signal a human (or, later, an agent) has explicitly set.
- **Sub-health (Schedule/Budget/Scope/Resources) is a deterministic score,
  not a 5th AI agent.** `backend/src/lib/projectHealth.ts`
  (`computeSubHealth`) reads only already-stored, **approved** data: each
  category sums a weight per approved risk/dependency/change_signal whose
  Impact Analyst `impact_assessment.applicable === true` and whose
  matching field (`schedule_impact`/`cost_impact`/`scope_impact`/
  `resource_impact`) is non-null — risks weighted by severity
  (`critical=3, high=2, low/medium=1`), dependencies/change_signals a flat
  `1` (no severity field). Schedule additionally adds
  `min(overdueActionsCount, 3)`. Score → level: `0` green, `1–2` amber,
  `>=3` red. A simple, explainable heuristic over data the Impact Analyst
  already produced — adding a 5th agent to *judge* health at dashboard-
  load time would violate the "four agents only" rule in AI Rules.
- Every dashboard list is **approved-only**, with the one standing
  exception already established by `/alerts` and the weekly report:
  "decisions needing attention" is inherently the *pending* category
  (decisions can't need approval-attention once they're approved).
- **Drill-down is a separate, unfiltered data source, not the dashboard
  endpoint with query params.** `GET /api/projects/:id/{actions|risks|
  issues|decisions|dependencies|change-signals}` returns every row for
  that project regardless of `approval_status` — clicking into a
  dashboard tile should let a PM see pending/rejected records too, not
  just the approved subset the summary showed. No server-side filtering
  is implemented for these routes: the frontend fetches the full list
  once per drill-down page load and filters entirely client-side
  (`useMemo` over already-fetched data), so narrowing by
  approval/status/owner/date-range is instant and never triggers a
  network call. Do not add query-param filtering to these routes without
  a real performance reason — it would duplicate logic that already lives
  correctly on the frontend.
- See `docs/decision-log/2026-09-01-project-dashboard.md` (initial build)
  and `docs/decision-log/2026-09-03-dashboard-ux-filters-drilldown.md`
  (states, filters, drill-down) for full design and live verification
  against Apex data.

## Frontend Conventions
- Routing: `react-router-dom`, added once a second screen actually existed
  (New Meeting → Meeting Results) per the no-speculative-abstraction rule —
  not scaffolded ahead of need. Routes and `<BrowserRouter>` live in
  `frontend/src/App.tsx`. Current routes: `/` (New Meeting),
  `/meetings/:meetingId/results` (Meeting Results), `/projects` (Project
  List — the entry point into dashboards; reuses the existing
  `listProjects()` call already used by New Meeting's project picker),
  `/projects/:id` (Project Dashboard), `/projects/:id/:type` (Project
  Records — the drill-down list; `:type` is one of `actions|risks|issues|
  decisions|dependencies|change-signals`, the same string as the API path
  segment, so no separate name-mapping layer exists between the route and
  the fetch call). The header carries a small static nav (`New Meeting` /
  `Projects`) — the first cross-screen navigation in the app, added
  because nothing linked into `/projects/:id` otherwise.
- `frontend/src/components/` (new directory) — `Skeleton.tsx` exports
  `SkeletonBlock`/`SkeletonCard`/`SkeletonStat`, shared by
  `ProjectDashboard`/`ProjectRecords`/`ProjectList` (three consumers
  crosses this codebase's own extraction threshold — the same reasoning
  already used for `MeetingResults.tsx`'s shared `ItemCard`). Loading
  states render shape-matched pulsing placeholders, not a spinner, so the
  layout doesn't jump once data arrives. Error states across these three
  screens follow one pattern: fetch logic lives in a `useCallback`'d
  `load()` called from `useEffect` on mount and from a Retry button's
  `onClick` — same function, two triggers, no duplicated fetch logic.
- `frontend/src/pages/ProjectRecords.tsx` — the drill-down screen. Fetches
  a project's full record list for one type plus `getProjectMeetings`
  once per page load (`useEffect` on `[id, type]`); Approval/Status/
  Owner/Date-range filters are `useMemo` array filters over that
  already-fetched data — no network call on any filter change (see
  Dashboard Conventions). A `?view=` query param seeds the *default*
  filter selection (e.g. a tile for "decisions needing attention" links
  with `?view=pending`) but never restricts what's fetched — the user can
  always broaden the filters from there. Status/Owner filter options are
  computed from the distinct values actually present in the fetched data,
  not a hardcoded enum, so an option is never shown with zero matching
  records. Each record card is read-only (no Approve/Reject/Edit — this
  is a browsing/reporting screen, not the `MeetingResults.tsx` approval
  workflow) and links its `meeting_id` to `/meetings/:id/results` as
  "source meeting," or shows "No linked meeting" for the (currently rare)
  case of a null `meeting_id`.
- `frontend/src/pages/ProjectDashboard.tsx` follows `MeetingResults.tsx`'s
  established conventions: same loading/error/data state pattern, same
  card shell (`rounded-lg border bg-white p-4 shadow-sm border-slate-200`),
  same badge shape (`rounded border px-1.5 py-0.5 text-[11px] font-medium
  uppercase tracking-wide`). Local `HEALTH_STYLES`/`SEVERITY_STYLES`/
  `CONFIDENCE_STYLES` color maps are colocated in the file, same pattern
  as `CONFIDENCE_STYLES`/`StatusBadge` in `MeetingResults.tsx` — no
  centralized theme tokens exist in `tailwind.config.js`, so semantic
  color conventions live by usage in each screen. No charting library
  added; health/severity render as colored badges and simple stat cells,
  matching the codebase's existing plain-Tailwind restraint (confirmed
  nothing else in the frontend uses one).
- `frontend/src/lib/api.ts` is the only place that calls `fetch` — typed
  request/response shapes per resource, a shared `ApiError` thrown on any
  non-2xx (carrying the API's `{ message, details }`), and a
  `ResourceKey → URL segment` map (`patchApproval`/`patchEdit`) so route
  path conventions (e.g. `change_signals` → `/change-signals`) live in one
  place, not scattered across call sites.
- `frontend/src/pages/` holds one file per screen. Screens fetch their own
  data in a `useEffect` and manage their own loading/error state — no
  global client-state library introduced for two screens.
- The review screen (`MeetingResults.tsx`) uses one generic, field-config-
  driven card component for all six item categories rather than six
  near-duplicate card components — the categories differ only in which
  fields they show/edit, not in structure (approve/reject/edit, badges,
  duplicate/impact callouts are identical across all six). This is the
  "three similar lines" threshold for a shared component, not speculative.
- New meetings trigger analysis automatically (`NewMeeting.tsx` calls
  `createMeeting` then immediately `analyseMeeting`, showing a distinct
  "Analysing…" state before navigating to the results screen) — there is
  no separate manual "run analysis" step in the UI.

## AI Rules
- Four agents only, each with one job: Meeting Analyst (extraction),
  Project Context Analyst (comparison/dedup/relationship/change-signal
  detection), Project Impact Analyst (schedule/cost/scope/resource/dependency
  impact assessment), Executive Reporting Agent (weekly summaries). No
  open-ended/general-purpose agent, no agent given tools beyond what its job
  requires.
- Every AI-generated claim is tagged FACT, INFERENCE, or RECOMMENDATION.
  FACT = directly stated/verifiable in the source transcript/record.
  INFERENCE = the agent's derived judgement, not explicitly stated.
  RECOMMENDATION = a suggested action, never auto-applied.
  Never render or store an INFERENCE or RECOMMENDATION as if it were a FACT.
- All agent output must validate against its zod schema before being
  persisted; invalid output is rejected and logged, never coerced/guessed
  into shape.
- No agent output causes a schedule/scope/cost/resource change, a status
  transition to `approved`, or any downstream (n8n/webhook) write without an
  explicit human approval action recorded in `audit_log`.
- Cite the underlying record(s) (meeting/transcript excerpt, or prior
  entity id) for every extracted or inferred item wherever feasible.
- Log every agent invocation (input refs, model, prompt version, raw output,
  validation result) to `agent_runs` for auditability and debugging.
- **Model abstraction**: agents never call an SDK directly. They call
  `llmClient.generateStructured()` (`backend/src/services/llm/index.ts`),
  a provider-agnostic interface; `config.llmProvider`
  (`LLM_PROVIDER` env var, default `anthropic`) is the single place that
  picks the implementation. `config.anthropicModel` (`ANTHROPIC_MODEL` env
  var) is the single place the model id is configured — never hardcode a
  model string inside an agent. OpenRouter is a stub that throws until a
  second real provider case exists (no speculative implementation).
- **Structured output**: every agent's contract is one zod schema
  (`backend/src/agents/<agent>/schema.ts`), which is both (a) validated
  against post-hoc via `.safeParse()` and (b) converted to a JSON Schema
  (via `zod-to-json-schema`) used as the Anthropic tool's `input_schema` —
  one source of truth, so the "shape the model is told to produce" and "shape
  we accept" cannot drift apart. Forcing `tool_choice` to that one tool is
  what makes the model return structured JSON instead of free text.
- **Retry/repair**: if the model's output fails zod validation, the agent
  retries (default 3 attempts total) with a repair prompt containing the
  previous output and the exact validation errors, asking for a corrected
  result — not a fresh, unguided retry. API-level failures (billing, auth,
  rate limit, network) are not retried — they won't be fixed by asking the
  model again — and are surfaced immediately so the caller can log and
  report them. Every attempt (success, validation failure, or API failure)
  is logged to `agent_runs`, even when the endpoint ultimately returns an
  error to the caller.
- Extracted-entity items only ever get created with `approval_status`
  defaulting to `pending` (the DB column default — agents never pass
  `approval_status` explicitly); moving to `approved`/`rejected` is only
  ever done via the PATCH routes (see API Conventions).
- **3-agent pipeline** (`backend/src/agents/pipeline.ts`,
  `runMeetingAnalysisPipeline`): Meeting Analyst → Context Analyst → Impact
  Analyst, all in memory, before any DB write. Meeting Analyst's draft
  items get temporary refs (`action-0`, `risk-1`, via
  `backend/src/agents/shared/refs.ts`) so the later stages — and the final
  persistence step — can address a specific item before it has a real DB
  id. Context Analyst additionally receives the project's *existing*
  actions/risks/decisions (real ids) to compare against.
- **Context Analyst never merges, deletes, or blocks insertion** — it only
  flags. A likely duplicate is still created as its own pending row; the
  flag (`context_flags.is_likely_duplicate` + `duplicate_of_id` pointing at
  the real existing record) is what lets a human reviewer see the
  connection instead of two indistinguishable pending items.
  `duplicate_of_id` is defensively re-validated against the actual set of
  existing ids before storage — a hallucinated id gets nulled out, the
  qualitative flag (`is_likely_duplicate`, `duplicate_reasoning`) is kept.
- **Impact Analyst's `confidence_type` is structurally locked to
  `"inference"`** (`z.literal('inference')`, not a free enum) — an impact
  projection is never a directly-stated fact, so the schema itself
  prevents mislabeling here rather than relying on the model to choose
  correctly. `applicable: false` is stored, not omitted, when the agent
  finds no material impact — that's a recorded, auditable outcome too.
- **Graceful degradation**: if the Context or Impact Analyst fails
  validation after retries (or hits an API error), that stage's enrichment
  is left `null` on the affected items — the pipeline does not discard the
  Meeting Analyst's extraction. Only a Meeting Analyst failure fails the
  whole pipeline (nothing to enrich otherwise). Every stage's outcome is
  still logged to `agent_runs` regardless.
- **Downstream automations only ever act on approved items.** The Approval
  Hand-off event (`backend/src/services/approvalEvents.ts`,
  `n8n/approval_handoff.json`) fires exclusively from
  `updateApprovalStatus` when `status === 'approved'` — structurally
  unreachable for `'pending'` or `'rejected'`, and the n8n workflow itself
  re-checks `approval_status === 'approved'` before its (placeholder)
  downstream step, as defense in depth rather than trusting the caller
  blindly. The Project Alerts workflow is read-only and never mutates
  anything; surfacing `pending_decisions` in the digest is reporting for a
  human, not autonomous action on unapproved data — see
  `docs/decision-log/2026-08-28-n8n-approval-and-alerts-workflows.md`.
- **Executive Reporting Agent (`backend/src/agents/executive-reporting/`)
  is the 4th and final agent**, triggered directly by
  `POST /api/ai/weekly-report` (not via `pipeline.ts`, which is specific
  to the 3-agent per-meeting flow) — same `runStructuredWithRetry` reuse,
  same schema-first contract as the other three. Its confidence-typing is
  adapted for narrative summary lines rather than extracted entities: each
  `{ text, confidence_type }` item uses the free `confidenceTypeSchema`
  (not locked to one value like Impact Analyst) — a summary line can
  legitimately be a plain restatement of data (`fact`), a judgement about
  trajectory (`inference`), or a suggested next step (`recommendation`),
  and the prompt is explicit that these must not blur. It never invents
  data outside what the route hands it, and produces its own report; it
  triggers no downstream write or approval-state change itself. See
  `docs/decision-log/2026-08-30-executive-reporting-agent-weekly-report.md`.

## Testing Rules
- Every zod schema has unit tests covering valid and invalid shapes.
- Every agent has unit tests with fixed synthetic transcript fixtures
  (Apex Manufacturing) asserting on structured output shape and
  FACT/INFERENCE/RECOMMENDATION tagging, not on exact prose.
- Every RLS policy has a test proving cross-org isolation.
- The approval pipeline (draft → review → approve → live → audit_log) has an
  integration test covering the golden path and a rejection path.
- Golden-path e2e (transcript in → dashboard reflects approved data) covered
  before Phase 10 sign-off.
- Test folders (`frontend`/`backend` unit tests, integration, e2e) are added
  when the first real test is written, not scaffolded empty ahead of need.

## Documentation Rules
- Every prompt/session that changes scope, architecture, schema, or a
  non-trivial decision adds a dated file to `docs/decision-log/` (see
  `docs/` plan) — what was decided, why, alternatives considered, impact.
- `docs/architecture.md` and `docs/data-model.md` are living documents,
  updated in place to reflect current system state (not appended to).
- Keep this CLAUDE.md itself updated when conventions change; treat drift
  between this file and actual code as a bug.
