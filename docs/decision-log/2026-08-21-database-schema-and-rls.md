# 2026-08-21 — Database Schema, RLS, and Backend DB Module

## Decision
Migrated the 11 core MVP tables (`organisations`, `users`, `projects`,
`meetings`, `documents`, `actions`, `risks`, `issues`, `decisions`,
`dependencies`, `change_signals`) to the live Supabase project via 5 ordered
SQL migrations in `supabase/migrations/`, enabled Row Level Security on
every table, and added a typed backend query module at `backend/src/db/`.

## Why `approval_status`
CLAUDE.md's AI Rules already mandate that no AI output causes a
consequential change without explicit human approval, recorded and
auditable. `approval_status` (`pending`/`approved`/`rejected`, default
`pending`) on all six extracted-entity tables is the enforcement point for
that rule at the data layer: every row an agent writes starts `pending`,
and only a human action (via `updateApprovalStatus` in the relevant
`backend/src/db/tables/*.ts` module, which requires an `approvedBy` id) can
move it to `approved`/`rejected`. `approved_by`/`approved_at` give the
audit trail without needing a separate `audit_log` table yet.

## Why RLS keyed by organisation
CLAUDE.md's Security Rules require RLS on every table holding org/project
data as the multi-tenant isolation mechanism, even though the MVP demo only
seeds one organisation — the isolation has to be real and testable, not
assumed. RLS is keyed via a `SECURITY DEFINER` helper,
`public.current_organisation_id()`, which resolves the caller's org through
`public.users` and `auth.uid()`. Tables with a direct `organisation_id`
column check it directly; tables scoped by `project_id`
(`meetings`/`documents`/the six entity tables) check via an `EXISTS` join
through `projects`.

An important nuance recorded here explicitly: the **backend's service-role
key bypasses RLS entirely** — this is standard Supabase behavior, not a gap
in these policies. RLS is the isolation boundary for the frontend's future
anon/authenticated key and any other direct DB access; the backend's own
`db` module is the boundary for backend queries, and every function there
takes and filters by an explicit id parameter rather than trusting ambient
RLS. This is documented in the module's doc comment
(`backend/src/db/index.ts`) so it isn't rediscovered as a surprise later.

## `users.id references auth.users(id)`
Not requested by name in this task's field list, but added ahead of Phase 3
(Auth) so RLS can key off `auth.uid()` without a disruptive re-migration
once login exists. It's inert until a login flow is built — no functional
effect today.

## Clarifications resolved with the user before building
1. **Applying migrations**: no Postgres connection string was available in
   `.env` (only the REST URL + JWT keys) and the Supabase CLI wasn't
   installed. The user chose to paste a DB connection string/password so
   the migrations could be applied directly rather than requiring manual
   SQL-editor pasting. In practice, `npx supabase db push` failed in this
   environment: the direct-connection host (`db.<ref>.supabase.co`) only
   resolves over IPv6, which this sandbox can't route, and the CLI kept
   attempting that host even when passed the Session Pooler `--db-url`.
   The fix was to bypass the CLI entirely — `scripts/apply-migrations.mjs`
   and `scripts/verify-schema.mjs` connect directly via the `pg` npm
   package (a real devDependency now, see root `package.json`) to
   `SUPABASE_DB_URL` (the IPv4-reachable Session Pooler string), running
   each migration file in filename order. Run via `npm run db:migrate` /
   `npm run db:verify`. CLAUDE.md's Database Conventions note ("applied in
   order via the Supabase CLI") is superseded by this — updated below.
2. **Field scope**: this task's Input field list (mostly just
   `approval_status`) was narrower than CLAUDE.md's existing Database
   Conventions (which already promised `source_excerpt`,
   `created_by_agent`, `approved_by`, `approved_at`, and a confidence
   classification on every extracted-entity table). The user chose the
   fuller CLAUDE.md field set now, to avoid a second migration when Agent 1
   ships in Phase 4. `actions.source_text` from the prompt was unified into
   `source_excerpt` for consistency across all six tables.
3. **Support tables**: `agent_runs`, `audit_log`, `embeddings`,
   `downstream_pushes` (called out in the original Phase 2 roadmap
   milestone) were deferred — the user chose to build exactly the 11 tables
   this task specified, adding the support tables later alongside the code
   that actually writes to them.

## What It Affects
- `supabase/migrations/*.sql` — the 5 new migration files.
- `backend/src/db/**` — new typed query module (`client.ts`, `types.ts`,
  `queryTable.ts`, `tables/*.ts`, `index.ts`), plus `@supabase/supabase-js`
  added to `backend/package.json`.
- `CLAUDE.md` Database Conventions — updated with the finalized enum names,
  the `users.id`/`auth.users` decision, and the RLS-vs-service-role-key
  clarification.
- `docs/data-model.md` — updated in place with the real schema.
- No UI or AI agent code was touched — out of scope for this phase.
