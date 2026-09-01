# 2026-08-23 — REST API Surface and Apex Demo Seed Data

## Decision
Built the full Express API surface over the Phase 2 `backend/src/db/`
module — typed routes, zod input validation, consistent JSON error
handling — and an idempotent seed script that populates realistic Apex
Manufacturing demo data. No AI, no frontend.

## Endpoints
- `POST /api/projects`, `GET /api/projects/:id`
- `GET /api/projects/:id/actions`, `/risks`, `/decisions`, `/dashboard`
- `POST /api/meetings`, `GET /api/meetings/:id`
- `POST /api/actions`, `PATCH /api/actions/:id`
- `POST /api/risks`, `PATCH /api/risks/:id`
- `POST /api/decisions`
- `POST /api/ai/analyse-meeting`, `POST /api/ai/project-query` — `501`
  placeholders

All error responses: `{ error: { message, details? } }`. See CLAUDE.md's
new API Conventions section for the full pattern.

## Why `approval_status` changes only via PATCH
CLAUDE.md's AI Rules already require that no consequential change happens
without explicit human approval, auditable. The PATCH routes are the sole
API-level path to `approved`/`rejected` on `actions`/`risks`, requiring an
`approved_by` user id — enforcing at the API layer the same rule the DB
layer's `updateApprovalStatus` already enforces. `issues`, `decisions`,
`dependencies`, `change_signals` don't get PATCH routes yet because this
task's endpoint list didn't request them (only `actions`/`risks`) — added
when needed.

## Seeding users: real Supabase Auth accounts, not fabricated UUIDs
`users.id references auth.users(id)` (a Phase 2 decision, for future
`auth.uid()`-keyed RLS) means `public.users` rows cannot be inserted with
made-up UUIDs — the FK rejects them. `backend/scripts/seed.ts` creates each
of the 5 demo people as a real Supabase Auth user via
`supabase.auth.admin.createUser` (idempotent — falls back to
`admin.listUsers` + email match if the account already exists), then
inserts the matching `public.users` row. Each account uses a fixed,
documented password (`SEED_DEMO_PASSWORD` env var, default
`ProjectIQ-Demo-2026!`) rather than a random unretrievable one, since these
accounts are meant to be usable once a login UI exists (Phase 3 Auth).

Seeded: organisation "Apex Manufacturing Ltd"; 5 users — Priya Nair
(Project Manager), David Chen (Finance Lead), Michael Osei (IT Lead), Sarah
Whitfield (Procurement Manager), Tom Reyes (Vendor PM) — mapped onto the
existing `user_role` enum (admin/pm/contributor/viewer) since it has no
dedicated Finance/IT/Procurement/Vendor values; one project ("ERP
Transformation Programme", status `active`, health `amber`); one "Programme
Kickoff" meeting; 4 sample actions, 3 risks, 2 decisions, all citing that
meeting.

## Idempotency approach
Every step finds-or-creates by a natural key: organisation by `name`, users
by auth email (then `public.users` by id), project by
`organisation_id + name`, meeting by `project_id + title`. The sample
actions/risks/decisions are only inserted if the project has zero existing
rows of that type — simple and sufficient for a fixed demo seed set,
avoiding duplicate inserts on re-run. Verified by running `npm run seed`
twice in a row.

## Bugs found and fixed along the way
1. **`SUPABASE_URL` had `/rest/v1/` appended** in `.env` — worked
   accidentally for nothing that actually exercised `supabase-js` reads
   until now (`selectByColumn` calls failed with "Invalid path specified in
   request URL"). `supabase-js`'s `createClient` expects the bare project
   URL and appends `/rest/v1/...` itself. Fixed by correcting the `.env`
   value to `https://<ref>.supabase.co`.
2. **`backend/src/config.ts` used `dotenv/config`'s default lookup**, which
   reads `.env` relative to `process.cwd()`. That's fine for `npm run
   dev:backend` (cwd stays at repo root in this setup) but broke `npm run
   seed --workspace=backend`, where npm sets cwd to `backend/` — no `.env`
   there, so every Supabase env var silently came back empty until
   `createClient` threw. Fixed by having `config.ts` resolve the monorepo
   root `.env` explicitly via `import.meta.url`, regardless of invocation
   cwd.

## What It Affects
- `backend/src/routes/*.ts`, `backend/src/schemas/*.ts`,
  `backend/src/lib/{ApiError,requireId}.ts`,
  `backend/src/middleware/{asyncHandler,validateBody,errorHandler}.ts`,
  `backend/src/index.ts` (routers mounted, error handler registered).
- `backend/scripts/seed.ts`, `backend/tsconfig.json` (now includes
  `scripts/`), `backend/package.json` / root `package.json` (`npm run
  seed`).
- `backend/src/config.ts` (root `.env` resolution fix),
  `backend/src/db/tables/organisations.ts` (added `getOrganisationByName`).
- `.env` — `SUPABASE_URL` corrected (bug fix, not a new requirement).
- `CLAUDE.md` — new API Conventions section.
