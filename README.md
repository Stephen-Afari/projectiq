# ProjectIQ

ProjectIQ is a portfolio MVP: an AI project-intelligence system that turns
meeting transcripts into governed, structured project-management data
(actions, risks, issues, decisions, dependencies, change signals), stores it,
shows it on a dashboard, answers questions about it, and — only after human
approval — pushes items to downstream tools.

Demo dataset: **Apex Manufacturing Ltd — ERP Transformation Programme**
(synthetic data only).

See `CLAUDE.md` for the full architecture, conventions, and guardrails, and
`docs/decision-log/` for the history of major decisions.

## Stack

React + Vite + Tailwind (`frontend/`) · Node.js + Express (`backend/`) ·
Supabase/Postgres + pgvector · n8n · Claude API (Anthropic SDK), OpenRouter
optional for dev.

## Monorepo layout

```
frontend/      React app (Vite + Tailwind + TS)
backend/       Express API (TS)
supabase/      Migrations + seed data
n8n/           Exported automation workflows
docs/          Architecture, data model, decision log
```

## Getting started

1. Fill in real keys in `.env` at the repo root (never commit it — see
   `.gitignore`).
2. `npm install`
3. Run both apps:
   - `npm run dev` — starts both `backend` (port 3001) and `frontend`
     (port 5173) together.
   - Or individually: `npm run dev:backend` / `npm run dev:frontend`.
4. Visit `http://localhost:5173` for the app shell, and
   `http://localhost:3001/api/health` for the backend health check
   (`{"status":"ok"}`).

## Status

Phase 1 skeleton: structure and tooling only — no database, AI, or product
features yet. See `docs/decision-log/` for the full 10-phase roadmap.
