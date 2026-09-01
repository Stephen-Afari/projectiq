# 2026-08-21 — Initial Architecture Plan

## Decision
Adopted the full ProjectIQ architecture plan: monorepo structure
(`apps/web`, `apps/api`, `packages/*`, `supabase/`, `n8n/`, `docs/`, `tests/`),
the four-agent AI pipeline (Meeting Analyst, Project Context Analyst,
Project Impact Analyst, Executive Reporting Agent), the FACT/INFERENCE/
RECOMMENDATION guardrail, the draft → human-approval → live-record state
machine, and the 10-phase build roadmap. `CLAUDE.md` was written to codify
these conventions for all future work.

## Why
The project needed a governing architecture before any code was written,
given the non-negotiable constraints: no AI-driven mutation of project data
without human approval, strict separation of fact vs. inference vs.
recommendation, and multi-tenant isolation via Supabase RLS from day one.
A monorepo with `apps/` + `packages/` workspaces was chosen as the standard
shape for a React + Express + shared-types stack, and keeps agent logic
isolated per-agent (one folder each) for independent testability and audit.

## Alternatives Considered / Rejected
- **Single open-ended AI agent with tools** — rejected because it would make
  outputs harder to audit, harder to schema-validate per concern, and
  conflicts with the requirement for narrow, controlled agent responsibilities.
- **Separate repos per app** — rejected for a portfolio MVP of this size;
  a monorepo keeps shared types in sync and simplifies the demo build/deploy
  story.
- **Real third-party downstream integrations (Jira/Asana) in MVP scope** —
  deferred; the approval-gated push pattern is demonstrated against a mock
  n8n webhook target instead, keeping the architecture swappable later
  without rearchitecting.

## What It Affects
Sets the folder structure, tech stack, and all conventions in `CLAUDE.md`
for every subsequent phase (1–10). Phase 1 scaffolding was built directly
against this plan.
