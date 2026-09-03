# 2026-09-02 — Security Hardening (Auth, Org Isolation, Audit Log, Rate Limits)

## Why
ProjectIQ's MVP worked end to end but auth was deliberately deferred to
"Phase 3" throughout the build — every route/table-module comment said
some version of "no auth/org session yet." Before showing this to
prospective clients, a full security review was run against CLAUDE.md's
own stated rules, and every gap found was fixed in this pass.

## Security review — gaps found

1. **No authentication anywhere.** Zero auth middleware in
   `backend/src/`; every CRUD/AI/read route (12 route files) was callable
   by anyone with network access — no session, no API key, nothing.
2. **No authorization/org-scoping at the route or query layer — an IDOR
   by construction.** Every `get*ById`/`update*` function in
   `backend/src/db/tables/*.ts` took only a raw id, never an org/project
   check. Any caller could approve/reject/edit/read any organisation's
   actions/risks/issues/decisions/dependencies/change_signals/projects/
   meetings by supplying (or enumerating) a UUID. `GET /api/users` and
   the default `GET /api/projects` returned every row across every
   organisation, unscoped — `listUsersByOrganisation`/
   `listProjectsByOrganisation` existed in the code but were dead,
   never called.
3. **RLS was 100% bypassed for all API traffic.** The backend
   exclusively uses the service-role Supabase key
   (`backend/src/db/client.ts`), which bypasses Row Level Security by
   Supabase design. The RLS policies themselves were confirmed correct
   for every table — but provided zero actual protection, since nothing
   in the app's real traffic path went through them.
4. **`audit_log` didn't exist.** CLAUDE.md called it mandatory
   ("Every consequential action ... is written to `audit_log`"); no
   migration ever created the table; nothing wrote to it.
5. **No rate limiting outside the two n8n webhook routes.** `/api/ai/*`
   (real Claude API cost per call) and every other route were unlimited —
   an open cost/DoS exposure.
6. **`cors()` called with no options** — reflected any origin.
7. **No deliberate length caps** on `transcript_text`/`transcript`/
   `question` — bounded only by Express's incidental 100kb default body
   limit, not a considered policy.
8. **Webhook auth was actually correct already** —
   `verifyWebhookSecret` + `webhookRateLimit` were genuinely applied to
   both n8n routes. No change needed there; confirmed and left as-is.
9. **No secrets in the repo** — `.env` is gitignored and untracked; a
   repo-wide sweep for API-key/JWT-shaped strings outside `.env` found
   nothing. Confirmed clean.

## Fixes implemented

### 1. Real authentication (Supabase Auth, verified server-side)
`backend/src/middleware/requireAuth.ts`: reads `Authorization: Bearer
<token>`, verifies it via `supabase.auth.getUser(token)` (the existing
service-role client — verifying a token is an Auth-API call, not a table
query, so it doesn't need the anon key), looks up the matching
`public.users` row, and attaches `req.user = { id, organisationId, role,
email }`. 401 if the token's missing/invalid; 403 if the Supabase Auth
account has no matching `public.users` row. Wired per-router in
`backend/src/index.ts` — every router except `healthRouter` (liveness)
and `webhooksRouter` (n8n's own shared-secret auth, unchanged).

### 2. Authorization enforced where it actually matters
`backend/src/lib/orgAccess.ts`: `assertProjectAccess(projectId,
organisationId)` — fetches the project, 404s (not 403, so a caller can't
distinguish "doesn't exist" from "exists in another org") if it's missing
or belongs to a different org. `loadProjectInOrg` is the same check as
Express middleware, used for `projects.ts`'s ~10 `/:id/*` sub-routes so
they don't each hand-roll the fetch+check. Every entity route
(actions/risks/issues/decisions/dependencies/change_signals) now calls
`assertProjectAccess(existing.project_id, req.user.organisationId)`
right after its existing "does this id exist" check — closing the IDOR
directly, since `req.user.organisationId` comes from a verified session
and can never be client-supplied. `meetings.ts` and all three `ai.ts`
routes (`analyse-meeting`, `weekly-report`, `project-query`) got the same
treatment via their `project_id`/meeting's `project_id`. `GET
/api/users` and the default `GET /api/projects` now call the
previously-dead `listUsersByOrganisation`/`listProjectsByOrganisation`.
`POST /api/projects` ignores any client-supplied `organisation_id`
(removed from the schema entirely) and always inserts
`req.user.organisationId`.

**One subtlety caught and fixed during implementation**: `analyse-meeting`
has an idempotency short-circuit (returns cached results if a meeting was
already analysed) that ran *before* the project fetch existed originally
— the org check had to be moved to immediately after loading the meeting,
ahead of that short-circuit, or a cross-org caller could still read
cached extraction results for a meeting whose full pipeline they'd never
be allowed to trigger.

### 3. `approved_by` now comes from the session, not the client
Per explicit direction: `patchApprovalStatusSchema`
(`backend/src/schemas/common.ts`) no longer accepts `approved_by` at
all — every approval route uses `req.user.id`. The frontend's
`patchApproval()` dropped its `approvedBy` parameter, and
`MeetingResults.tsx`'s "Reviewing as" picker (and the `listUsers()` call
backing it) were removed entirely — approving now always means "as the
logged-in user."

### 4. RLS: proven, not just written
Since RLS was never the actual enforcement point for API traffic (#3
above), a standalone test proves it works for the scenario it's actually
meant for — a client with the anon key, exactly what the frontend now
has. `backend/scripts/test-rls-isolation.ts` (`npm run test:rls`):
creates/reuses a second organisation + Supabase Auth user (same
find-or-create pattern as `backend/scripts/seed.ts`), signs in as that
user with the **anon key**, queries Apex's project directly via Supabase
— expects zero rows; repeats the reverse direction (an Apex user querying
the second org's project). **Ran live — both directions passed**:
```
✓ PASS: rls-test-user@projectiq-test.example (org "RLS Test Org
  (auto-generated)") cannot read Apex's project
✓ PASS: priya.nair@apex-manufacturing.example (org "Apex Manufacturing
  Ltd") cannot read the test org's project
```

### 5. `audit_log` — created and wired to every consequential action
New migration `supabase/migrations/20260902090000_audit_log.sql`:
`organisation_id`, `actor_id` (nullable — a future automated action might
have none), `action`, `resource_type`, `resource_id`, `before_state
jsonb`, `after_state jsonb`, `created_at`; RLS enabled, same
org-scoped policy as every other table. `backend/src/db/tables/
auditLog.ts` (`createAuditLogEntry`) — deliberately uses `supabase`
directly rather than `queryTable.ts`'s `insertRow`, since `queryTable.ts`
itself now calls `createAuditLogEntry` (from `updateApprovalStatus`) and
importing `queryTable.ts` back into `auditLog.ts` would create a cycle.

Write points: `updateApprovalStatus` (the pre-existing single funnel for
all six entities' approve/reject actions — extended to take an
`ApprovalAuditContext { actorId, organisationId, resourceType,
beforeState }` and write one row per call, so audit coverage can't be
missed per-route); each entity's `PATCH /:id/edit` route (content edits,
"consequential" per CLAUDE.md's own pre-existing rule); `POST
/api/ai/weekly-report` (`action: 'report_generated'`, explicitly called
out in the task's requirements).

### 6. Rate limiting expanded
`backend/src/middleware/apiRateLimit.ts` (300 req/15min/IP) on all of
`/api`; `backend/src/middleware/aiRateLimit.ts` (20 req/15min, **keyed by
`req.user.id`**, not IP, so it's a genuine per-user budget) on `/api/ai/*`
specifically. `webhookRateLimit` (pre-existing, 30 req/5min/IP)
unchanged, layered on top for the two n8n routes.

### 7. CORS restricted
`cors({ origin: config.frontendBaseUrl })`, replacing the no-options
`cors()` that reflected any origin.

### 8. Input length caps
`.max(200_000)` on `transcript_text` (`schemas/meetings.ts`) and
`transcript` (`schemas/webhooks.ts`); `.max(2000)` on `question`
(`schemas/ai.ts`); `express.json({ limit: '1mb' })` explicit instead of
the implicit 100kb default.

### 9. Frontend: minimal Supabase Auth login gate
`@supabase/supabase-js` added to `frontend/` (anticipated by CLAUDE.md's
own pre-existing "frontend uses the anon key + RLS" line — just never
implemented). `frontend/src/lib/supabaseClient.ts` (anon key only, auth
calls exclusively — the frontend never queries application tables
directly, still goes through the Express API). `frontend/vite.config.ts`
gets `envDir: '../'` so Vite reads the monorepo-root `.env` (new
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` entries, values mirroring
the existing non-prefixed ones — the anon key is meant to be public).
`frontend/src/lib/authContext.tsx` (`AuthProvider`/`useAuth`) tracks the
session and mirrors its token into `lib/api.ts`'s module-level
`setAccessToken`, so every `request()` call attaches `Authorization:
Bearer <token>` without threading auth through props. `frontend/src/
pages/Login.tsx` — email/password only, no signup/reset (demo users
come from `backend/scripts/seed.ts`). `App.tsx` gates all routes behind
a session check.

## Verified live
- `tsc --noEmit`/`tsc -b` clean on both `backend/` and `frontend/`.
- Migration applied; `audit_log` exists with RLS enabled.
- `npm run test:rls` — both isolation directions PASS (see above).
- `GET /api/projects` with no `Authorization` header → `401 {"error":
  {"message":"Missing bearer token"}}`.
- Signed in as `priya.nair@apex-manufacturing.example` (real Supabase
  Auth password grant) — `GET /api/projects` correctly returned only the
  2 Apex-org projects.
- **Cross-org demonstration (the task's explicit ask)**: the Apex user's
  token against the RLS-test-org's project id →
  `404 {"error":{"message":"Project not found"}}`. The test-org user's
  token against Apex's project id → the identical `404`. Apex's own
  project/dashboard with the Apex token → `200`.
- Approved a real pending action as the authenticated Apex user (PATCH
  body: `{"approval_status":"approved"}`, no `approved_by` sent) —
  response's `approved_by` (`fe3890ab-…`) matched Priya Nair's actual
  `users.id`, confirmed by direct query. The corresponding `audit_log`
  row was confirmed present: `{action: "approved", resource_type:
  "actions", actor_id: "fe3890ab-…", organisation_id: "573e5db8-…"}`.
- Webhook route with no secret still correctly `401`s, unchanged.
- Rate-limit headers confirmed present and correctly scoped:
  `RateLimit-Limit: 300` on a general route, `RateLimit-Limit: 20` on
  `/api/ai/project-query`.

## Disclosed limitation
No browser-automation tool is available in this environment — the actual
login page render and click-through wasn't visually exercised by me
(same disclosed limitation as every prior frontend phase in this
project). Everything that carries real correctness/security risk — the
auth middleware, org-scoping, RLS isolation, audit logging, rate limits,
and the frontend's token-attachment logic — was verified via direct API
calls against the real backend and real Supabase Auth sessions, which is
the substantive part; the login page itself is a thin form calling
already-verified `supabase.auth.signInWithPassword`.

## What It Affects
- `backend/src/middleware/requireAuth.ts`, `apiRateLimit.ts`,
  `aiRateLimit.ts` (new).
- `backend/src/types/express.d.ts` (new).
- `backend/src/lib/orgAccess.ts` (new).
- `backend/src/db/tables/auditLog.ts` (new);
  `supabase/migrations/20260902090000_audit_log.sql` (new).
- `backend/src/db/queryTable.ts` (`updateApprovalStatus` extended);
  `backend/src/db/tables/{actions,risks,issues,decisions,dependencies,
  changeSignals}.ts` (wrapper signatures updated).
- `backend/src/routes/{projects,actions,risks,issues,decisions,
  dependencies,changeSignals,meetings,ai,users}.ts` (org checks, audit
  writes, `approved_by` from session).
- `backend/src/schemas/{common,projects,meetings,webhooks,ai}.ts`
  (dropped client `approved_by`/`organisation_id`, length caps).
- `backend/src/index.ts` (auth + rate limiters wired per router; CORS
  restricted; explicit json limit).
- `backend/scripts/test-rls-isolation.ts` (new); `package.json` (root +
  backend) get `test:rls`.
- `frontend/package.json` (+`@supabase/supabase-js`);
  `frontend/vite.config.ts` (`envDir`).
- `frontend/src/lib/supabaseClient.ts`, `lib/authContext.tsx`,
  `pages/Login.tsx` (new).
- `frontend/src/lib/api.ts` (bearer token attach, `patchApproval` drops
  `approvedBy`).
- `frontend/src/App.tsx` (session gate, sign-out).
- `frontend/src/pages/MeetingResults.tsx` (reviewer picker removed).
- `.env` (+`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- `CLAUDE.md` — Security Rules rewritten; API/Frontend Conventions'
  stale "no auth yet" notes corrected throughout.
