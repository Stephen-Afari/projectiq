# 2026-08-27 — Meeting Results Review Screen (Human-in-the-Loop Approval Gate)

## Decision
Built the review/approval screen: after a meeting is analyzed, the user
lands on `/meetings/:id/results`, sees everything the 3-agent pipeline
extracted grouped by type (Summary, Actions, Risks, Issues, Decisions,
Dependencies, Change Signals), and can Approve, Reject, or Edit each
pending item. Approved/rejected items move out of the Pending group into a
collapsed Reviewed group. The user explicitly asked not to be interrupted
with clarifying questions, so every open decision below was made and
documented rather than asked about.

## Backend gaps this task surfaced
Building this screen honestly required auditing what actually existed:
only `actions`/`risks` had a PATCH (approval-only), `decisions` had no
PATCH at all, and `issues`/`dependencies`/`change_signals` had **no Express
routes whatsoever** — their `db/tables/*.ts` CRUD functions were built in
Phase 2 and never wired up. There was also no meeting-scoped read (only
project-scoped lists) and no way to edit a field before approving. All of
this was in scope here, not deferred, since the screen's whole point is
"everything extracted for a meeting" with working controls on every
category.

## New read endpoint: `GET /api/meetings/:id/results`
Returns `{ meeting, actions, risks, issues, decisions, dependencies,
change_signals }`, each filtered to that meeting via new
`list*ByMeeting(meetingId)` functions (the same `selectByColumn` helper
already used for `list*ByProject`). Chosen over 6 client-side-filtered
project-wide fetches — matches exactly what the screen needs, and doesn't
leak the whole project's history into a single-meeting view.

## Approval PATCH and content-edit PATCH kept as two separate routes
`PATCH /api/<resource>/:id` (approval-only, unchanged from earlier phases)
stays exactly as documented: `{ approval_status, approved_by }`, nothing
else. A new `PATCH /api/<resource>/:id/edit` handles content-field edits
(+ `confidence_type`, since correcting a mislabeled fact/inference is
exactly what human review is for) via an `edit<Type>Schema` per resource
(partial fields, `.refine` rejects an empty body). This preserves the
existing guarantee that the approval PATCH is narrow, single-purpose, and
always audited, rather than loosening it to also carry arbitrary content
changes. All six extracted-entity resources now have both routes —
`issues`/`dependencies`/`change_signals` previously had neither.

## "Reviewing as" placeholder instead of real auth
`approved_by` needs a real user id and there is still no session (Auth is
a later, not-yet-built phase). Added `GET /api/users` (unscoped list, same
precedent as the earlier unscoped `GET /api/projects`) so the screen can
offer a simple "Reviewing as" dropdown defaulting to the first seeded user.
This is explicitly a placeholder — documented as such in CLAUDE.md — to be
replaced by a real session-derived identity once Auth ships.

## Routing added now, not before
`react-router-dom` was added because a second screen now genuinely exists
(New Meeting → Meeting Results) — CLAUDE.md's earlier note said add it
"when a second screen actually exists," and this is that point. Two
routes: `/` and `/meetings/:meetingId/results`.

## Analysis triggers automatically, not as a separate manual step
`NewMeeting.tsx`'s submit handler now creates the meeting, immediately
calls `POST /api/ai/analyse-meeting`, and shows a distinct "Analysing
transcript — this runs three AI agents in sequence and can take a
minute…" state before navigating to the results screen. Matches the
request's framing ("after analysing a meeting, navigate to a results
screen") — there's no extra "click to analyse" step.

## One generic item card, not six near-duplicates
The six categories differ only in which fields they show and which are
editable — not in structure (title, confidence badge, status badge, source
quote, duplicate banner, related items, impact callout, approve/reject/
edit controls, pending-vs-reviewed grouping are identical across all six).
`MeetingResults.tsx` defines one `ItemCard` driven by a small
`FieldConfig[]` per category rather than six copies of the same component
— past the "three similar lines" threshold for a shared abstraction, not
speculative.

## Duplicate visibility
Per the explicit ask, cards where `context_flags.is_likely_duplicate` is
true get a distinct visual treatment (amber left border) plus a
"Possible duplicate" banner with the agent's `duplicate_reasoning`, so a
reviewer can act on them at a glance without reading every field.
`related_items` (non-duplicate relationships) render as a compact list
underneath. `impact_assessment` renders as a labelled "Impact Analyst
(inference)" callout showing only the populated dimensions, or a muted
"no material impact identified" note when `applicable: false`.

## Dashboard exclusion of rejected items — out of scope here
The request's "rejected items are... excluded from the dashboard later"
describes a future end-state, not a requirement to modify
`GET /api/projects/:id/dashboard` in this task (that's dashboard-phase
work, not yet built beyond its Phase 3 stub). This phase only ensures
rejection is correctly recorded (`approval_status='rejected'`, `approved_by`,
`approved_at` all set) — verified live below.

## Verified end-to-end (via the exact API calls the UI makes)
1. Both `backend` and `frontend` typecheck clean.
2. Created a fresh meeting with the sample Apex transcript via
   `POST /api/meetings` (as the New Meeting screen does), triggered
   `POST /api/ai/analyse-meeting` (as the screen's auto-analyse step
   does) — `201`, 6 actions/3 risks/4 issues/2 decisions/1 dependency/5
   change signals extracted and enriched.
3. Fetched `GET /api/meetings/:id/results` (as the results screen does on
   load) — confirmed populated `context_flags` (several items correctly
   flagged as likely duplicates against the same transcript's earlier
   analysis runs) and `impact_assessment`.
4. Performed the exact review actions the UI's buttons trigger: rejected a
   flagged-duplicate risk (`PATCH /api/risks/:id`), approved a clean action
   (`PATCH /api/actions/:id`), edited a decision's `impact` text then
   approved it (`PATCH /api/decisions/:id/edit` then `PATCH
   /api/decisions/:id`) — all `200`, all correctly reflected in the
   updated rows (`approval_status`, `approved_by`, `approved_at`, and the
   edited field all correct).
5. Final state confirmed via `GET /api/meetings/:id/results`: mixed
   pending/approved/rejected across categories, matching the actions taken.
6. Frontend UI itself was exercised through its full underlying API
   contract, but not visually clicked through in a real browser (no
   browser-automation tool available in this environment) — both dev
   servers are left running for the user to verify visually themselves.

## What It Affects
- `backend/src/db/tables/{actions,risks,issues,decisions,dependencies,changeSignals}.ts`
  (`list*ByMeeting`, `update*Fields`), `backend/src/db/tables/users.ts`
  (`listAllUsers`).
- `backend/src/schemas/{actions,risks,issues,decisions,dependencies,changeSignals}.ts`
  (`edit<Type>Schema`), `backend/src/schemas/common.ts`
  (`requireAtLeastOneField`, `confidenceTypeValues`).
- `backend/src/routes/{issues,dependencies,changeSignals,users}.ts` (new),
  `decisions.ts` (PATCH routes added), `actions.ts`/`risks.ts` (edit PATCH
  added), `meetings.ts` (`GET /:id/results`), `index.ts` (all mounted).
- `frontend/package.json` (`react-router-dom`), `frontend/src/App.tsx`
  (routing), `frontend/src/lib/api.ts` (extended), `frontend/src/pages/
  NewMeeting.tsx` (auto-analyse + navigate), `frontend/src/pages/
  MeetingResults.tsx` (new — the review screen).
- `CLAUDE.md` — API Conventions (edit-vs-approval PATCH split, new routes,
  `GET /api/users` placeholder), new Frontend Conventions section.
