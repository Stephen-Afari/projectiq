# ProjectIQ — Architecture (Living Document)

_Last updated: 2026-08-21 (skeleton rebuilt as frontend/ + backend/)_

## Overview
ProjectIQ ingests meeting transcripts, runs them through four controlled AI
agents, stores schema-validated structured output as drafts, requires human
approval before anything becomes "live" project data or triggers a
downstream write, and surfaces the result via a dashboard, RAG-based Q&A,
and scheduled executive summaries.

See the full pipeline diagram and component breakdown in
`docs/decision-log/2026-08-21-initial-architecture-plan.md` (original plan)
and `docs/decision-log/2026-08-21-skeleton-rebuild-frontend-backend.md`
(folder naming update).

## Components
- **`frontend/`** — React + Vite + Tailwind frontend. No direct AI or
  Supabase-service-role access; talks to `backend/` over REST, uses the
  Supabase anon key + RLS for any direct reads it needs.
- **`backend/`** — Node + Express backend. Owns auth, CRUD, the four AI
  agents (`backend/src/agents/*`), schema validation (`backend/src/schemas`),
  and webhook endpoints for n8n.
- **`supabase/`** — Postgres schema (migrations) + RLS policies + pgvector +
  synthetic seed data (Apex Manufacturing Ltd).
- **`n8n/`** — exported workflow JSON for scheduled jobs (weekly summary) and
  the approval-gated downstream push.

## Status
Phase 1 (Foundations & Repo Scaffolding) — skeleton only, `GET /api/health`
on the backend and an app shell on the frontend. Data model, RLS, auth, and
the agents themselves are not yet implemented — see `docs/decision-log/` for
the phase roadmap.
