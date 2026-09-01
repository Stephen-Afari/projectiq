# 2026-08-28 — Approval Hand-off + Project Alerts n8n Workflows

## Decision
Added two n8n automations downstream of human review: an event fired the
moment an item is approved (`n8n/approval_handoff.json`, placeholder
downstream step — real Planner/Jira push is Phase 9), and a scheduled
digest of things needing attention (`n8n/project_alerts.json`). Both
respect the approval gate: the hand-off event is structurally impossible
to fire for anything but `'approved'`; the alerts digest is read-only and
never mutates anything.

## Approval events fire from exactly one place
All six entity types' approval PATCH routes already funnel through
`updateApprovalStatus` in `backend/src/db/queryTable.ts` — confirmed by
reading it before making any change, rather than assuming. Hooking event
emission there (not in six separate route handlers) means it's
structurally impossible for an approval to happen without the event firing
correctly scoped: only `status === 'approved'` triggers
`emitApprovalEvent`; `'rejected'` never does, and `'pending'` is
unreachable through this function entirely (nothing ever calls it with
that value). **Verified live, not just read from the code**: approved one
action and rejected another in the same test run against a temporary local
listener — exactly one event received, for the approved item, with the
correct secret header and full record payload; the rejected item produced
zero events.

`backend/src/services/approvalEvents.ts` is best-effort and bounded (5s
`AbortController` timeout, errors logged not thrown) — a human's approval
action must always succeed even if n8n is down, slow, or unconfigured.
Skipped silently if `N8N_APPROVAL_WEBHOOK_URL` isn't set, so nothing in
the rest of the app depends on n8n being present.

## "Severity has worsened" needed a real stored baseline
The schema had no history of severity changes. New migration
`20260828090000_risk_severity_history.sql` adds
`risks.previous_severity`/`risks.severity_changed_at` (both nullable),
set by `PATCH /api/risks/:id/edit` — computed in the route (which already
has the pre-edit row from its existing `getRiskById` lookup, so no extra
query) by comparing severity rank (`low<medium<high<critical`). **Verified
live**: edited a risk `high → critical` (worsening) — `previous_severity:
"high"` recorded; edited it `critical → medium` (improving) —
`previous_severity` correctly cleared to `null`; edited it back `medium →
high` (worsening again) — re-flagged correctly. A risk stays flagged until
its severity is touched again; no separate acknowledge flow was asked for
or built.

## `GET /api/projects/:id/alerts`: computed in the backend, not in n8n
Rather than have the n8n workflow hand-roll date comparisons and severity
logic across raw list calls (error-prone to hand-author blindly, and this
codebase already has a pattern of aggregate endpoints for exactly this —
`/dashboard`, `/results`), one new endpoint returns
`{ project, overdue_actions, worsening_risks, pending_decisions }` with a
`counts` summary and `project.url` for the alert's "link back to the
project." Unauthenticated, matching the existing `/dashboard`/`/results`
endpoints' trust boundary (read-only, same as other frontend reads — not
a webhook-ingestion write path).

**Verified live against real Apex data**, not synthetic/empty: approved an
action and edited its `due_date` to a past date; approved a risk and
worsened its severity (from the test above). The endpoint returned exactly
1 overdue action, 1 worsening risk, and — genuinely, from accumulated
testing across earlier phases — 9 pending decisions (several near-
duplicates from repeated analysis runs on the same sample meeting, which
is expected and itself demonstrates why the Context Analyst's duplicate
flags matter for review). Full compiled alert text (matching exactly what
`n8n/project_alerts.json`'s "Compile Alert" Code node produces) is in the
session transcript — subject line, per-category breakdown, and the
project link.

## "Link back to the project" — disclosed as forward-looking
No project-detail page exists in the frontend yet (only
`/meetings/:id/results`; a Dashboard is a later phase). `project.url` in
the alerts response points at `FRONTEND_BASE_URL/projects/:id` — the
intended future URL. Disclosed explicitly here and in `CLAUDE.md` rather
than silently shipping a link that 404s with no explanation.

## Workflow structures
**`n8n/approval_handoff.json`** (6 nodes): Webhook (Header Auth) → Code
"Validate & Log Event" (re-checks `approval_status === 'approved'` even
though the backend only ever sends approved events — defense in depth at
the n8n layer too) → IF "Is Approved?" → true: HTTP "Notify Downstream
(Placeholder)" → Respond 200; false: Respond 200 "ignored".

**`n8n/project_alerts.json`** (8 nodes): Schedule Trigger (daily 08:00) →
HTTP "Get Projects" → HTTP "Get Alerts" (per project) → Code "Compile
Alert" (builds subject/summary text + `has_alerts`) → IF "Has Alerts?" →
true: Send Email (`emailSend`, real node, needs SMTP credentials
configured by the user) + HTTP "Send Slack/Teams Notification
(Placeholder)"; false: NoOp. Matches the task's own framing — email is the
real channel, Slack/Teams is explicitly the placeholder.

## Disclosed limitation
Both n8n JSON files were hand-authored to n8n's export schema and
validated as well-formed JSON, but not executed inside a live n8n
instance by me — no direct access to the user's running n8n. Every
backend-side behavior that actually carries correctness risk (event
firing/not-firing, severity tracking, alert computation) was verified
live against the real API and real Apex data, which is the substantive
part; the n8n JSON is orchestration around already-verified endpoints.

## What It Affects
- `supabase/migrations/20260828090000_risk_severity_history.sql` (new).
- `backend/src/db/types.ts` (`Risk` gets 2 new fields),
  `backend/src/db/tables/risks.ts` (`updateRiskFields` patch type extended).
- `backend/src/config.ts` (`n8nApprovalWebhookUrl`, `frontendBaseUrl`).
- `backend/src/services/approvalEvents.ts` (new).
- `backend/src/db/queryTable.ts` (`updateApprovalStatus` emits on approval).
- `backend/src/routes/risks.ts` (`/:id/edit` computes severity-worsened).
- `backend/src/routes/projects.ts` (new `GET /:id/alerts`).
- `n8n/approval_handoff.json`, `n8n/project_alerts.json` (new).
- `.env` — `N8N_APPROVAL_WEBHOOK_URL` set to
  `http://localhost:5678/webhook/approval-handoff` (matches the workflow's
  webhook path once imported into a running n8n instance).
- `CLAUDE.md` — Security Rules (API→n8n direction), Database Conventions
  (new risk columns), API Conventions (new alerts endpoint), AI Rules
  (approval-gate guarantee for automations).
