# ProjectIQ — Plan

## What We Built

ProjectIQ turns raw meeting transcripts into governed, structured
project-management intelligence, with mandatory human approval before
anything consequential happens.

- **Ingestion**: meetings can be created from the frontend (New Meeting
  screen) or pushed in externally by n8n via a signed webhook; transcript
  text is stored in a private Supabase Storage bucket, never as a large
  text column.
- **A 4-agent AI pipeline** (`backend/src/agents/*`): Meeting Analyst
  extracts actions/risks/issues/decisions/dependencies/change signals;
  Project Context Analyst flags likely duplicates and relationships
  against existing project data; Project Impact Analyst assesses
  schedule/cost/scope/resource/dependency impact; Executive Reporting
  Agent produces scheduled weekly summaries. Every claim is tagged FACT,
  INFERENCE, or RECOMMENDATION and validated against a zod schema before
  it's ever written to the database.
- **A mandatory human approval gate**: every extracted item lands as
  `pending`; nothing becomes `approved`, triggers a downstream automation
  (n8n hand-off), or counts toward live project data without an explicit
  human action, recorded in `audit_log`.
- **A Project Dashboard**: overall/sub-area health, overdue actions, top
  risks, decisions needing attention, open issues & dependencies, change
  signals, and a recent-intelligence feed — an executive-readable view of
  one project's current state.
- **A Meeting Review screen**: the approval workspace — approve, reject,
  or edit each extracted item, with duplicate flags and impact
  assessments surfaced inline.
- **Ask ProjectIQ**: a RAG-backed assistant that answers questions
  grounded in a project's approved data and uploaded documents, with
  every claim cited back to its source record or document passage.
- **n8n automations**: a weekly Executive Reporting trigger, an
  Approval Hand-off event (fires only on `approved`), and a read-only
  Project Alerts digest (overdue actions, worsening risks, pending
  decisions) — none of them write to core tables directly, only through
  the validated, RLS-backed Express API.
- **Supabase Auth**: email/password sign-in gates the whole frontend;
  RLS policies (defense-in-depth behind explicit backend-side org/project
  scoping) protect every org-scoped table.

## What We Improved

A dedicated design-polish pass (2026-09-08, see
`docs/decision-log/2026-09-08-design-polish-pass.md` for full detail)
took the app from "functionally complete" to "looks like a product,"
without touching the data model, security rules, or approval-gate
behavior:

- **A real design system where there was none**: a brand color (indigo,
  aliased from Tailwind's own palette — the existing slate/green/amber/
  red/blue/purple/orange semantic colors were left untouched, since they
  encode approval-gate and confidence-type meaning), the Inter typeface,
  a favicon, and a shared `components/ui/{Badge,Card,StatusBanner}`
  primitive layer that replaced five independently-duplicated badge
  color-key maps and a dozen copy-pasted card shells with one definition
  each.
- **Responsive behavior added where there was almost none**: a
  collapsing mobile header nav, stacking form/filter controls,
  viewport-relative chat sizing, and consistent page padding — previously
  only 4 breakpoint classes existed in the entire frontend.
- **The Dashboard now reads as an executive health view**: Overall
  Health leads the page in a hero treatment; the intelligence-card grid
  no longer strands a card alone in its own row at any screen width;
  small inline icons speed up scanning each card's purpose.
- **The Meeting Review screen closed its parity gap with the rest of the
  app**: it went from the least-finished screen (plain-text loading, no
  Retry button, no overview) to having a real skeleton loader, a Retry
  button, a top summary bar (extracted/pending/reviewed counts), a
  once-stated FACT/INFERENCE/RECOMMENDATION legend, a sticky quick-nav
  with live per-section counts, and tidier callout spacing.
- **The AI Assistant's citations are unambiguous**: entity citations now
  get their own distinct brand-colored pill treatment, as visually clear
  as the existing document-citation pills, so a reader can tell at a
  glance what kind of source backs a claim.
- **Consistency sweep**: transitions on interactive elements, per-page
  `document.title`, and warmer empty-state copy across every screen.

## Future Roadmap

- **Phase 9 integrations**: replace the Approval Hand-off event's
  placeholder n8n downstream node with a real push into a PM tool
  (Jira/Planner) — the signed-webhook contract already exists; only the
  n8n-side node and target-system field mapping remain.
- **Deploy**: Supabase is already hosted; `frontend/`, `backend/`, and
  n8n still need a production hosting decision and a real
  `FRONTEND_BASE_URL`/CORS configuration.
- **Multi-project portfolio view**: a cross-project rollup dashboard,
  reusing the Dashboard's health/stat primitives, once a single
  project's view is solid — the natural next step now that it is.
- **Supabase Auth hardening**: today's sign-in is email/password only
  against seeded demo users, with no self-service signup/invite/reset
  flow — needed before this could be handed to real users.
- **An independent second design pass**: this pass simulated the Ralph
  Loop technique manually because the `ralph-loop` plugin's Stop hook and
  the `frontend-design` skill weren't active mid-session (both were
  installed moments before the pass began). Re-running the actual
  tooling in a fresh session, now that both load correctly, is a
  reasonable next step before the next major demo.
