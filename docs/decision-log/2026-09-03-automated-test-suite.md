# 2026-09-03 — Automated Test Suite (Vitest + supertest)

## Decision
Added ProjectIQ's first real automated test suite: 13 test files, 80
tests, covering CRUD + validation for projects/meetings/actions/risks/
decisions, the Meeting Analyst agent against a mocked Claude response
(including the repair loop), the approval gate's actual security
property, dashboard aggregation math against a known fixture, and
webhook auth. `npm test` (root) runs it; fully offline, deterministic,
no real Supabase, no real Claude, no network calls, no API tokens spent.

## Vitest over Jest
The backend is pure ESM (`"type": "module"`, `moduleResolution:
"NodeNext"`, every relative import already `.js`-suffixed). Vitest is
ESM-native with zero config friction here; Jest's ESM support needs extra
transform configuration for no benefit at this project's size. New
devDependencies: `vitest`, `supertest`, `@types/supertest` — confirmed
none existed anywhere in the repo before this.

## The one required source change: `app.ts`/`index.ts` split
`index.ts` built the Express app and called `app.listen()` in the same
module with nothing exported — supertest needs an importable `app` that
never opens a real port. `backend/src/app.ts` now exports `app` (built
through `app.use(errorHandler)`); `backend/src/index.ts` shrinks to
importing it and calling `.listen()`. Verified zero behavior change: the
real dev server was restarted after the split and `curl /api/health` /
an unauthenticated `GET /api/projects` (`401`, unchanged) both matched
prior behavior exactly.

## Fully offline — the mocking architecture
Three seams needed mocking, all confirmed structurally clean to mock
before writing any test:
- **LLM**: every agent's `run.ts` → `runStructuredWithRetry` →
  `llmClient.generateStructured` (`services/llm/index.ts`) is the *only*
  place touching `@anthropic-ai/sdk` (confirmed by reading
  `anthropicClient.ts` — `generateStructured` returns `{ raw: toolUse.input,
  model }`, completely unprocessed). One `vi.mock` of this module fully
  controls any agent's output.
- **DB**: every route file imports only named functions from
  `../db/index.js` (confirmed across every route file, not e.g. `db/client.js`
  directly) — `vi.mock('../../src/db/index.js', ...)` per test file with
  `vi.fn()` stubs is sufficient; nothing needs a real Postgres connection.
- **Auth**: `requireAuth.ts` is the one file (besides `transcriptStorage.ts`,
  unused by these tests) that imports `db/client.js` directly, for
  `supabase.auth.getUser`. Route tests stub `requireAuth` wholesale (sets
  `req.user` to a fixed fixture, `TEST_USER`); its own internal 401/403/
  success logic gets a **separate, dedicated test**
  (`tests/middleware/requireAuth.test.ts`) that mocks only
  `supabase.auth.getUser` and `getUserById`, so the real middleware logic
  is verified somewhere rather than perpetually bypassed.

**A Vitest-specific gotcha worth recording**: `vi.mock(...)` calls are
hoisted above all other code in a file, including `const` declarations —
so a mock factory can't reference an outer-scope `const` built before it
without hitting a temporal-dead-zone error. Every route test's `vi.mock`
factory is therefore *self-contained* (its own `await import(...)` inside
the factory, e.g. `tests/helpers/dbMocks.ts`'s `createDbMocks()`), and
the test file separately does `const db = await import('../../src/db/index.js')`
*after* the mock registration to get a reference to the same `vi.fn()`
instances for configuring `.mockResolvedValue(...)` later in the file.

`tests/helpers/dbMocks.ts` centralizes one `vi.fn()` per function any
route file imports from `db/index.js` — needed because `app.ts` wires
every router at once, so every route module's top-level import must
resolve to *something*, even in a test that only exercises one router.

## Approval-gate coverage: three layers, not one giant test
Each layer proves a different guarantee precisely:
1. **`tests/db/updateApprovalStatus.test.ts`** — the sharpest test. Calls
   the real `updateApprovalStatus` (the single funnel all six entities'
   approve/reject routes share) with `status: 'rejected'` and asserts
   `emitApprovalEvent` (the downstream n8n hand-off) was **never called**;
   with `'approved'`, asserts it was called exactly once. This one test
   covers "automations never act on pending/rejected" for all six entity
   types simultaneously, since they all funnel through this function.
2. **`tests/lib/projectAlerts.test.ts`** — pure unit tests on
   `computeProjectAlerts` proving pending/rejected rows never appear in
   `overdueActions`/`worseningRisks`, and that `pendingDecisions` is
   correctly the one deliberate pending-only exception.
3. **`tests/routes/projects.test.ts`**'s dashboard suite — proves the
   same guarantee at the HTTP-response level against a known fixture, and
   includes a live before/after comparison: flip one fixture decision
   from `pending` to `approved` between two requests, assert
   `counts.decisions` goes from 1→2 and `decisions_needing_attention`
   goes from 1→0. This is "approving includes them" demonstrated
   directly, not inferred.

`tests/routes/actions.test.ts`/`risks.test.ts`/`decisions.test.ts`
additionally assert the *write* side of the 2026-09-02 hardening: sending
`{approval_status: 'approved', approved_by: 'attacker-id'}` in the
request body results in the mocked `update*ApprovalStatus` call's
`context.actorId` being the session's `TEST_USER.id` — never the
attacker-supplied value. Zod's default behavior (silently stripping
unknown body keys, since `approved_by` isn't in
`patchApprovalStatusSchema` anymore) is exercised here, not just assumed.

## Dashboard "known seed" = a fixed fixture, not the live Apex data
Using real seeded Supabase data would make assertions non-deterministic
(the Apex demo project's approved-item counts drift as more demo work
happens against it) and slow (real network round-trip). `tests/fixtures.ts`
defines an exact, hand-picked dataset — 3 actions (2 approved, 1
overdue-and-open; 1 pending), 3 risks (2 approved incl. one worsened; 1
pending), 2 decisions (1 approved, 1 pending), 1 each of issue/dependency/
change_signal — and the dashboard test asserts exact counts against it
(`{actions: 2, risks: 2, issues: 1, decisions: 1, dependencies: 1,
change_signals: 1}`). Stated explicitly as a deliberate substitution for
live seed data, not a silent one.

## Meeting Analyst: three specific claims, not "it runs"
`tests/agents/meetingAnalyst.test.ts` mocks `generateStructured` to prove,
against a fixed sample transcript:
1. A valid mocked response → `validationPassed: true`, and the returned
   action/risk/decision carry the *correct* `confidence_type` each
   (`fact` for a directly-stated commitment, `inference` for a derived
   risk judgement) — not just "some tag exists."
2. An invalid first response (missing required `confidence_type` on an
   action) followed by a valid second response →
   `validationPassed: true`, `attempts: 2`, and the second call's prompt
   is asserted to actually contain repair-prompt language
   ("did not match the required schema") — proving the retry is a real
   repair attempt, not a blind re-ask.
3. Always-invalid responses across all attempts →
   `validationPassed: false`, `result: null`, no thrown exception,
   `generateStructured` called exactly 3 times (the documented default
   `maxAttempts`) — graceful failure per
   `runStructuredWithRetry`'s contract.

## Webhook auth: unit test + integration test
`tests/middleware/verifyWebhookSecret.test.ts` tests the middleware
function directly (missing header, wrong secret, correct secret).
`tests/routes/webhooks.test.ts` additionally mounts the real
`webhooksRouter` behind supertest (with `meetingIngestion.js` and the
relevant `db/index.js` functions mocked) and confirms both webhook routes
genuinely 401 on a bad/missing secret and succeed on the correct one —
covering both "the function is correct in isolation" and "it's actually
wired onto the route."

## RLS isolation stays a separate script, not part of this suite
`backend/scripts/test-rls-isolation.ts` (`npm run test:rls`, built in the
prior security-hardening phase) needs a real anon-key session against
real Supabase to mean anything — mocking it would make it prove nothing.
Kept deliberately outside the offline Vitest suite; both are documented
together in Testing Rules as the full testing picture.

## Verified live
- `npm test` (root) — **13 test files, 80 tests, all passing.**
- `cd backend && npx tsc --noEmit` — clean (the `app.ts`/`index.ts` split
  introduced no type errors).
- Real dev server restarted post-split; `GET /api/health` → `200`,
  unauthenticated `GET /api/projects` → `401` — both unchanged from
  before the split.

## What It Affects
- `backend/src/app.ts` (new), `backend/src/index.ts` (slimmed).
- `backend/vitest.config.ts` (new).
- `backend/package.json` (+`vitest`/`supertest`/`@types/supertest`;
  `test`/`test:watch` scripts).
- `backend/tests/**` (new): `fixtures.ts`, `helpers/dbMocks.ts`,
  `lib/{projectAlerts,projectHealth,projectMeetings}.test.ts`,
  `agents/meetingAnalyst.test.ts`, `db/updateApprovalStatus.test.ts`,
  `middleware/{verifyWebhookSecret,requireAuth}.test.ts`,
  `routes/{webhooks,projects,meetings,actions,risks,decisions}.test.ts`.
- `CLAUDE.md` — Testing Rules rewritten to describe actual coverage and
  the offline-mocking convention for future tests.
