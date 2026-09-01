# 2026-08-27 — n8n Meeting Analysis Workflow + Idempotent Analysis Endpoint

## Decision
Formalised analysis-triggering into its own n8n workflow
(`n8n/meeting_analysis.json`) with retries and failure notification, and
fixed a real correctness gap the task explicitly called out: **`POST
/api/ai/analyse-meeting` was not idempotent** — every call re-ran the full
3-agent pipeline and inserted a fresh batch of pending items, confirmed by
testing during earlier phases (re-analysing the same meeting produced
duplicate actions/risks/etc. every time). A retry — from n8n after a slow
response, or anyone else — after a call that actually succeeded server-side
would have silently duplicated everything. Fixed at the backend, not
worked around in n8n.

## Idempotency: `meetings.analysis_status`, not the `agent_runs` log
New migration `20260827090000_meeting_analysis_status.sql` adds
`analysis_status` (`pending`/`completed`/`failed`, default `pending`) and
`analysis_error` (nullable text) to `meetings`. `analyse-meeting` now
checks this first: if `analysis_status === 'completed'` and the request
didn't pass `force: true`, it returns `200` with the *existing* extracted
items (queried the same way `GET /api/meetings/:id/results` already does)
instead of re-running anything. `force: true` bypasses this for deliberate
re-analysis — e.g. after a transcript correction.

This column doubles as the "mark the meeting as needing attention"
mechanism the task asked for: on pipeline failure, the route sets
`analysis_status='failed'` with the error message *before* returning `502`
— automatic, no separate step, using the same code path that already
existed for handling failure.

**Verified live, not just asserted**: created a fresh, never-analysed
meeting, ran `analyse-meeting` (`201`, 6 actions/3 risks/4 issues/2
decisions/2 dependencies/4 change signals, `analysis_status: completed`),
then called it again with no `force` — `200`, `status:
"already_analysed"`, identical counts, and the returned action ids were
byte-for-byte identical to the first run's ids (not a second batch with
new ids). That's the actual proof, not an inference from reading the code.

## Fallback marking endpoint for true network failure
The backend can only mark `analysis_status='failed'` if the request
reaches it and the pipeline actually runs. If n8n can't reach the backend
at all (DNS failure, backend down, connection refused — not a graceful
502), that marking never happens. So the new `PATCH
/api/webhooks/n8n/meetings/:id/analysis-status` (secret-verified,
rate-limited, same middleware stack as the existing ingestion endpoint)
exists specifically for the n8n workflow's failure branch to call as a
best-effort fallback after retries are exhausted. Deliberately narrow:
`markAnalysisStatusSchema` only accepts `status: 'failed'` (a zod literal,
not a free enum) — moving to `'completed'` only ever happens as a side
effect of a real successful analysis run, never via this route.
Verified live: correct secret + valid meeting id → `200`, meeting's
`analysis_status`/`analysis_error` updated as expected.

## Workflow structure (`n8n/meeting_analysis.json`, 11 nodes)
```
Webhook (Header Auth, same credential as Ingestion workflow)
  → Validate Payload (Code)
  → IF Payload Valid?
      false → Respond 400
      true  → Call Analyse Meeting (HTTP POST, retryOnFail: 3x/5s, timeout 180s)
                → IF Analysis Succeeded? (checks response has `counts`)
                    true  → Format Success Summary → Respond 200
                    false → Send Failure Notification (placeholder webhook POST)
                              → Mark Meeting Failed (PATCH .../analysis-status)
                                → Respond 502
```
Standalone, webhook-triggered — matches the Ingestion workflow's shape
rather than an n8n "Execute Workflow" sub-workflow node.

**Update (same day): wired to the Ingestion workflow.** The Ingestion
workflow's "Trigger Analysis" HTTP node (`n8n/meeting_ingestion.json`) now
calls this workflow's webhook (`{{$env.N8N_BASE_URL}}/webhook/meeting-analysis`,
with the `X-N8N-Webhook-Secret` header) instead of hitting `POST
/api/ai/analyse-meeting` on the backend directly. This requires a new n8n
environment variable, `N8N_BASE_URL` (e.g. `http://localhost:5678` for a
local instance) — n8n calling its own webhook endpoint needs its own base
URL, distinct from `PROJECTIQ_API_BASE_URL` (the backend's address). The
end-to-end chain is now: external caller → Ingestion workflow → stores
meeting → responds to caller → calls Analysis workflow's webhook →
Analysis workflow calls the backend (with retries) → notifies + marks
failed on persistent failure. Both workflows remain independently
callable — the Analysis workflow still accepts a direct `POST
.../webhook/meeting-analysis` call with just `{ meeting_id }` from
anywhere, not only from the Ingestion workflow.

## Retries
`Call Analyse Meeting` uses n8n's node-level `retryOnFail` (3 attempts, 5s
between) with a generous 180s timeout, since the pipeline runs 3
sequential LLM calls with their own internal retry/repair loop and can
genuinely take over a minute. n8n's retry doesn't distinguish status codes
— a definitive 4xx (e.g. meeting not found) retries the same way a
transient 5xx would, just less efficiently. Not worth extra branching
complexity to special-case; the idempotency fix means even a "successful
retry of an already-succeeded call" is safe now, which was the actual risk
worth eliminating.

## Notification is a placeholder, per the task's own framing
`Send Failure Notification` POSTs a Slack-incoming-webhook-shaped body to
`$env.NOTIFICATION_WEBHOOK_URL` — not a real Slack/Teams/Email n8n node,
which would need OAuth credentials that can't be configured blindly.
Swappable for a real node once the user has those credentials in their n8n
instance.

## AI work stays behind the API
The workflow only ever calls `POST /api/ai/analyse-meeting` and `PATCH
.../analysis-status` — never touches Claude directly, per "n8n
orchestrates; the backend owns the Claude calls and validation" (already
true of the existing design, reconfirmed here).

## Disclosed limitation
Same as the Ingestion workflow: `n8n/meeting_analysis.json` was
hand-authored to n8n's export schema and validated as well-formed JSON,
but not executed inside a live n8n instance by me — no direct access to
the user's running n8n. All backend-side changes (idempotency, the new
endpoint) were fully verified live via direct API calls, which is the part
that actually carries correctness risk; the n8n JSON is comparatively low-
risk orchestration around already-verified endpoints, but node parameter
shapes should still be visually checked after import.

## What It Affects
- `supabase/migrations/20260827090000_meeting_analysis_status.sql` (new).
- `backend/src/db/types.ts` (`MeetingAnalysisStatus`, `Meeting` fields),
  `backend/src/db/tables/meetings.ts` (`updateMeetingAnalysisStatus`).
- `backend/src/schemas/ai.ts` (`force` field), `backend/src/schemas/webhooks.ts`
  (`markAnalysisStatusSchema`).
- `backend/src/routes/ai.ts` (idempotency short-circuit + status marking
  at both exit points), `backend/src/routes/webhooks.ts` (new PATCH route).
- `n8n/meeting_analysis.json` (new).
- `CLAUDE.md` — API Conventions (two new endpoint behaviors), Ingestion
  Conventions (idempotency rule).
