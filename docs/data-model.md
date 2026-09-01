# ProjectIQ — Data Model (Living Document)

_Last updated: 2026-08-21 (schema migrated — see
`docs/decision-log/2026-08-21-database-schema-and-rls.md`)_

## Tables

### Core
- **`organisations`** — `id, name, created_at`
- **`users`** — `id (references auth.users), name, email (unique), role
  (admin/pm/contributor/viewer), organisation_id, created_at`
- **`projects`** — `id, organisation_id, name, description, status
  (planning/active/on_hold/completed/cancelled), health (green/amber/red),
  start_date, target_date, created_at`

### Meeting inputs
- **`meetings`** — `id, project_id, title, meeting_date, source,
  transcript_reference, summary, created_at`
- **`documents`** — `id, project_id, filename, document_type, storage_url,
  created_at`

### Extracted entities (AI-extracted, human-approved)
All six share an audit-field pattern:
`meeting_id` (nullable), `source_excerpt`, `approval_status`
(`pending`/`approved`/`rejected`, default `pending`), `created_by_agent`,
`approved_by`, `approved_at`, `confidence_type`
(`fact`/`inference`/`recommendation`, nullable).

- **`actions`** — `description, owner, due_date, priority
  (low/medium/high/critical), status (open/in_progress/done/cancelled)` + audit fields
- **`risks`** — `description, probability, impact (low/medium/high),
  severity (low/medium/high/critical), owner, mitigation, status
  (open/mitigated/closed/accepted)` + audit fields
- **`issues`** — `description, owner, severity (low/medium/high/critical),
  status (open/investigating/resolved/closed), resolution` + audit fields
- **`decisions`** — `decision, decision_owner, decision_date, impact` + audit fields
- **`dependencies`** — `description, upstream_activity, downstream_activity,
  owner, status (planned/in_progress/blocked/complete)` + audit fields
- **`change_signals`** — `change_type (text), description, potential_impact,
  status (open/acknowledged/resolved)` + audit fields

### Not yet built
`agent_runs`, `audit_log`, `embeddings`, `downstream_pushes` — deferred
until the agents / approval UI / RAG Q&A / n8n push phases that actually
write to them.

## Row Level Security
Every table has RLS enabled. Isolation is keyed by
`public.current_organisation_id()`, a `SECURITY DEFINER` function that
looks up the caller's `organisation_id` from `public.users` via
`auth.uid()`. `organisations`/`users`/`projects` check directly against it;
`meetings`/`documents`/the six entity tables check via
`EXISTS (SELECT 1 FROM projects WHERE projects.id = <table>.project_id AND
projects.organisation_id = current_organisation_id())`.

The backend's service-role key bypasses RLS (Supabase platform behavior) —
RLS here isolates the frontend's future anon/authenticated access, not the
backend. See `backend/src/db/index.ts` for how the backend enforces scoping
itself.

## Migrations
`supabase/migrations/`, applied in order (all applied to the live project as
of 2026-08-23):
1. `20260821090000_extensions_and_enums.sql`
2. `20260821090100_core_tables.sql`
3. `20260821090200_meetings_and_documents.sql`
4. `20260821090300_entity_tables.sql`
5. `20260821090400_rls_policies.sql`

Applied via `npm run db:migrate` (connects directly to `SUPABASE_DB_URL`
using `pg`) and confirmed via `npm run db:verify` — all 11 tables exist
with `relrowsecurity = true`. The Supabase CLI's `db push` was not used; it
requires the IPv6-only direct-connection host, which isn't reachable from
every dev environment. `SUPABASE_DB_URL` must be the Session Pooler
connection string (IPv4-reachable), not the direct `db.<ref>.supabase.co`
string.

## Backend access
`backend/src/db/` — typed query helpers, one module per table under
`tables/`, built on a shared `queryTable.ts` helper. See its module-level
doc comment (`backend/src/db/index.ts`) for the scoping contract.
