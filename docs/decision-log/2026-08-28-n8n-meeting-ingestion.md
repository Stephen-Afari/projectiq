# 2026-08-28 — n8n Meeting Ingestion Workflow

## Decision
Added an external ingestion path: an n8n workflow (`n8n/meeting_ingestion.json`)
that accepts `{ project_id, title, meeting_date, source, transcript }`,
verifies the shared secret, validates the payload, confirms the project
exists, stores the meeting via a new secret-authenticated backend endpoint,
responds immediately, then triggers analysis in the background.

## New backend endpoint: `POST /api/webhooks/n8n/meetings`
Deliberately not a reuse of the frontend's `POST /api/meetings` (which has
no auth — same-origin, internal trust boundary). External traffic is a
different trust boundary, and CLAUDE.md's Security Rules already required
"All webhooks (n8n → API, API → n8n) must verify a signature/secret" —
this is the first endpoint that actually needed to satisfy that. Guarded
by, in order: `webhookRateLimit` (30 req / 5 min per IP, scoped to
`/api/webhooks` only — not global), `verifyWebhookSecret` (compares
`X-N8N-Webhook-Secret` against `N8N_WEBHOOK_SECRET`, throws a sync
`ApiError(401)` that Express 4 auto-catches), then the usual
`validateBody` zod check. Field name is `transcript` (matching the task's
payload spec exactly), mapped internally to the existing
`createMeetingWithTranscript` service.

## Refactor: shared `createMeetingWithTranscript`
The project-lookup + create + transcript-upload + compensating-error logic
was inline in `routes/meetings.ts`'s POST handler. Extracted to
`backend/src/services/meetingIngestion.ts` so the frontend route and the
new webhook route share it exactly rather than duplicating the same
upload-failure handling twice. Behavior unchanged — verified by re-running
the existing meeting-creation flow after the refactor.

## `analyse-meeting` intentionally stays unauthenticated
CLAUDE.md's "n8n → API must verify a signature/secret" rule is satisfied at
the new ingestion endpoint — the actual new n8n-facing surface. Retrofitting
secret-auth onto `POST /api/ai/analyse-meeting` would break the frontend,
which calls it directly after meeting creation and has no access to
`N8N_WEBHOOK_SECRET`. Documented here as a deliberate, scoped exception
rather than a silent gap: analysis-triggering is reachable only after the
secret-gated ingestion step already succeeded (from n8n) or from the
frontend's own already-trusted same-origin session.

## Fast ack, analysis runs after the response
`analyse-meeting` runs 3 sequential LLM calls and can take a minute or
more. Holding an external caller's HTTP connection open that long is bad
webhook practice and risks timeouts on the caller's side. The workflow
uses `responseMode: responseNode` on the Webhook trigger and a **Respond to
Webhook** node placed right after meeting creation succeeds — the caller
gets `{ status: "ok", meeting_id, message: "Meeting stored, analysis
triggered" }` immediately, and the same execution continues afterward to
call `analyse-meeting` in the background (still visible in n8n's execution
log for observability, just not blocking the HTTP response).

## Workflow structure (`n8n/meeting_ingestion.json`, 11 nodes)
```
Webhook (Header Auth)
  → Validate Payload (Code)
  → IF Payload Valid?
      false → Respond 400
      true  → Get Project (HTTP GET)
                → IF Project Found?
                    false → Respond 404
                    true  → Create Meeting (HTTP POST, secret header)
                              → IF Meeting Created?
                                  false → Respond 502
                                  true  → Respond Success (200)
                                            → Trigger Analysis (HTTP POST, fire-and-forget)
```
Uses n8n's native Header Auth credential on the Webhook node (not a
hand-rolled comparison in a Code node) — n8n rejects unauthorized calls
before the workflow even starts executing, which is both simpler and more
standard than validating the secret in-workflow.

`PROJECTIQ_API_BASE_URL` and `N8N_WEBHOOK_SECRET` are referenced via n8n
expressions (`$env.*`) — never hardcoded into the exported JSON, consistent
with "secrets only via env vars, never committed."

## Disclosed limitation
This JSON was hand-authored to n8n's export schema and validated as
well-formed JSON, but **not executed inside a live n8n instance** — I don't
have direct access to the user's running n8n to import and click-test it
myself. The backend side of this (the actual new code) was fully verified
live: correct/incorrect/missing secret, invalid payload, nonexistent
project, valid request, and the rate limit, all via direct curl calls
against the new endpoint (see Verified section below). The n8n workflow
itself should be verified by the user after import — node parameter shapes
(especially the IF-node condition objects) can vary slightly across n8n
versions, so a quick visual check of each node after import is worth doing
before relying on it.

## How to build it (node-by-node, if not importing the JSON)
1. **Webhook** — HTTP Method `POST`, Path `meeting-ingestion`,
   Authentication → **Header Auth**. Create a new credential: header name
   `X-N8N-Webhook-Secret`, value = your `N8N_WEBHOOK_SECRET` (from `.env`).
   Response Mode → **Using 'Respond to Webhook' Node**.
2. **Code** ("Validate Payload") — reads `$input.item.json.body` (or
   `.json` if your n8n version doesn't nest under `body`), checks
   `project_id`/`title`/`meeting_date`/`transcript` are present and
   non-blank, outputs `{ ...fields, valid, error }`.
3. **IF** ("Payload Valid?") — condition `{{$json.valid}}` is `true`.
   False branch → **Respond to Webhook**, JSON body
   `{ status: "error", message: "{{$json.error}}" }`, response code `400`.
4. **HTTP Request** ("Get Project") — `GET
   {{$env.PROJECTIQ_API_BASE_URL}}/api/projects/{{$json.project_id}}`.
   Enable "Continue On Fail" so a 404 doesn't abort the workflow.
5. **IF** ("Project Found?") — condition `{{$json.id}}` exists. False
   branch → **Respond to Webhook**, `{ status: "error", message: "Project
   not found" }`, response code `404`.
6. **HTTP Request** ("Create Meeting") — `POST
   {{$env.PROJECTIQ_API_BASE_URL}}/api/webhooks/n8n/meetings`, header
   `X-N8N-Webhook-Secret: {{$env.N8N_WEBHOOK_SECRET}}`, JSON body built
   from the *original* validated fields (reference them via
   `{{$('Validate Payload').item.json.project_id}}` etc — the Get Project
   call overwrote `$json` with the project response, so reach back to the
   Code node by name). Enable "Continue On Fail".
7. **IF** ("Meeting Created?") — condition `{{$json.id}}` exists. False
   branch → **Respond to Webhook**, `{ status: "error", message: "Failed
   to create meeting" }`, response code `502`.
8. **Respond to Webhook** ("Respond Success") — JSON body `{ status: "ok",
   meeting_id: "{{$json.id}}", message: "Meeting stored, analysis
   triggered" }`, response code `200`.
9. **HTTP Request** ("Trigger Analysis") — `POST
   {{$env.PROJECTIQ_API_BASE_URL}}/api/ai/analyse-meeting`, JSON body
   `{ meeting_id: "{{$('Create Meeting').item.json.id}}" }`. Enable
   "Continue On Fail" (the response is already sent; a failure here just
   means analysis needs a manual retry via the New Meeting/review flow).

Set n8n environment variables (or n8n Variables, if your instance uses
that feature instead): `PROJECTIQ_API_BASE_URL` (e.g.
`http://localhost:3001`) and ensure the Header Auth credential's secret
value matches `.env`'s `N8N_WEBHOOK_SECRET` exactly.

## How to test
1. Import `n8n/meeting_ingestion.json` (Workflows → Import from File) or
   build the 9 nodes above manually.
2. Create the Header Auth credential and set `PROJECTIQ_API_BASE_URL`.
3. Activate the workflow; note the webhook's production URL (n8n shows it
   on the Webhook node — typically
   `http://<n8n-host>:5678/webhook/meeting-ingestion`).
4. Sample curl, using the Apex sample transcript already in the repo
   (adjust the URL to your actual n8n webhook address and the project id
   to a real one from `GET /api/projects`):
   ```bash
   SECRET=$(grep '^N8N_WEBHOOK_SECRET=' .env | cut -d= -f2-)
   PROJECT_ID="<your Apex project id>"
   node -e "
   const fs = require('fs');
   const transcript = fs.readFileSync('docs/samples/apex-erp-kickoff-followup-transcript.md', 'utf8');
   const body = JSON.stringify({
     project_id: '$PROJECT_ID',
     title: 'n8n Webhook Ingestion Test',
     meeting_date: '2026-08-28',
     source: 'n8n',
     transcript,
   });
   fetch('http://localhost:5678/webhook/meeting-ingestion', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', 'X-N8N-Webhook-Secret': '$SECRET' },
     body,
   }).then(async r => { console.log('status', r.status); console.log(await r.text()); });
   "
   ```
5. Expect `{"status":"ok","meeting_id":"...","message":"Meeting stored,
   analysis triggered"}`. Check n8n's execution log to confirm the
   "Trigger Analysis" node ran afterward, then check
   `GET /api/meetings/:id/results` (or the review screen) for the
   extracted items once analysis finishes.

## Verified (backend side, directly against the new endpoint)
- Wrong secret → `401`.
- Missing secret header → `401`.
- Correct secret, nonexistent `project_id` → `400 "Project not found"`.
- Correct secret, valid payload → `201`, real meeting row with
  `transcript_reference` set.
- 31st request within 5 minutes → `429` (rate limit engaged exactly at the
  configured threshold).

## What It Affects
- `backend/src/services/meetingIngestion.ts` (new, extracted from
  `routes/meetings.ts`).
- `backend/src/middleware/{verifyWebhookSecret,webhookRateLimit}.ts` (new).
- `backend/src/schemas/webhooks.ts` (new), `backend/src/routes/webhooks.ts`
  (new), `backend/src/routes/meetings.ts` (refactored, behavior unchanged),
  `backend/src/index.ts` (mounted `/api/webhooks`).
- `backend/package.json` (`express-rate-limit`).
- `n8n/meeting_ingestion.json` (new). Note: the pre-existing empty
  `n8n/workflows/` folder from the original architecture plan wasn't used
  here — the task specified the exact path `n8n/meeting_ingestion.json`,
  which this follows literally.
- `CLAUDE.md` — Security Rules / API Conventions updated with the webhook
  ingestion pattern.
