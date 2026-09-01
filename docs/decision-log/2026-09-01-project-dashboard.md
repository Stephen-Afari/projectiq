# 2026-09-01 — Project Dashboard (`/projects/:id`)

## Decision
Added a single-screen Project Dashboard reading real, approved-only data
from a rewritten `GET /api/projects/:id/dashboard`: overall + sub-health,
new-since-last-meeting counts, overdue actions, top risks, decisions
needing attention, open issues/dependencies, open change signals, and a
recent-intelligence feed. Built per explicit instruction to not ask
clarifying questions — ambiguous points below are resolved with a stated
default, not a question.

## Overall health unchanged; sub-health is new and deterministic
`projects.health` (green/amber/red) already exists and is the one health
signal explicitly set by a human/agent — the dashboard just displays it,
never recomputes it.

Schedule/Budget/Scope/Resources sub-health did not exist anywhere in the
schema. Rather than add a 5th AI agent to judge it (which would violate
CLAUDE.md's "four agents only" rule), it's computed deterministically in
`backend/src/lib/projectHealth.ts` (`computeSubHealth`) from data the
Impact Analyst already produced: for each approved risk/dependency/
change_signal with `impact_assessment.applicable === true`, whichever
category fields are non-null contribute a weight (risks by severity —
critical 3, high 2, low/medium 1; dependencies/change_signals a flat 1,
since they carry no severity field). Schedule additionally adds
`min(overdueActionsCount, 3)`, reusing `computeProjectAlerts` rather than
recomputing overdue logic a third time (it's now shared by `/alerts`, the
weekly report, and the dashboard). Score thresholds: `0` green, `1–2`
amber, `>=3` red — documented explicitly here and in CLAUDE.md as a simple
heuristic, not a hidden judgement call.

## Approved-only, with the one standing exception
Every list filters `approval_status === 'approved'` except "decisions
needing attention," which reuses `computeProjectAlerts`'s
`pendingDecisions` — this mirrors the exact convention already established
by `/alerts` and the weekly report (a decision can only need
approval-attention while it's still pending; documented in CLAUDE.md as
"the one deliberately not-yet-approved category, surfaced for visibility
only").

## "New since last meeting" uses the most recent meeting_date as cutoff
`listMeetingsByProject` sorted by `meeting_date` descending gives the
cutoff; `since` is `null` (and all four counts `0`) if the project has no
meetings — disclosed as a stated simplification rather than silently
producing a misleading number. Counts approved actions/risks/decisions/
issues created at or after that date.

## Response shape replaced, not extended — old shape had zero consumers
The prior `/dashboard` response (`counts.actions.by_status`, etc.) was
grepped across the entire frontend before touching it — nothing called
this endpoint. Replacing it outright (rather than adding new fields
alongside dead ones) was safe and is documented as such, not a silent
breaking change to anything real.

## Frontend: matches MeetingResults.tsx conventions exactly
`frontend/src/pages/ProjectDashboard.tsx` reuses the established
loading/error/data `useState`+`useEffect` pattern, the same card shell and
badge shape as `MeetingResults.tsx`, and colocates its own
`HEALTH_STYLES`/`SEVERITY_STYLES`/`CONFIDENCE_STYLES` maps the same way
`MeetingResults.tsx` colocates `CONFIDENCE_STYLES`/`StatusBadge` — there's
no centralized theme in `tailwind.config.js` to draw from. No charting
library was added; confirmed nothing else in the frontend uses one, and
health/severity render fine as colored badges + simple stat cells.

## Reachability: added a minimal Project List page
Nothing linked to `/projects/:id` before this — only a `<select>` in
`NewMeeting.tsx` used `listProjects()`, for meeting creation, not
navigation. Added `frontend/src/pages/ProjectList.tsx` (reusing
`listProjects()` and `NewMeeting.tsx`'s simple fetch-on-mount pattern) at
`/projects`, plus a small static header nav (`New Meeting` / `Projects`)
in `App.tsx` — the first cross-screen navigation in the app. This is a
necessary entry point, not scope creep: without it the new screen would
only be reachable by typing a UUID into the URL bar. `GET
/api/projects/:id/alerts`'s `project.url` (pointing at
`FRONTEND_BASE_URL/projects/:id`) is now a real, working link — previously
disclosed as forward-looking; that disclosure is now resolved.

## Verified live against real Apex data
`GET /api/projects/:id/dashboard` for "ERP Transformation Programme"
returned: `sub_health: { schedule: red, budget: green, scope: green,
resources: amber }` (consistent with the one approved high-severity risk
carrying schedule+resource impact, plus 1 overdue approved action);
`counts` correctly reflecting only approved totals (4 actions, 1 risk, 0
issues, 1 decision, 0 dependencies, 0 change signals — much lower than the
much larger *all-items* counts from the weekly-report demo, confirming
the approved-only filter is working, not just present in code);
`decisions_needing_attention: 9` (all pending, confirmed); `top_risks`,
`open_issues`, `open_dependencies`, `change_signals` all confirmed
approved-only. `recent_intelligence` returned 6 items, correctly sorted
newest-first. Re-checked `GET /:id/alerts` after touching
`computeProjectAlerts`-adjacent code — identical output to before this
change (`overdue_actions: 1, worsening_risks: 1, pending_decisions: 9`),
confirming no regression. `tsc -b` clean on both `backend/` and
`frontend/`. Both dev servers started; `/projects` and `/projects/:id`
routes return `200` and the Vite dev proxy correctly forwards `/api` to
the backend.

## Disclosed limitation
No browser-automation tool is available in this environment, so the
screen's actual rendered appearance was not visually verified by me —
same disclosed limitation as every other frontend screen built in this
project. What was verified: the data contract (`curl` against the real
endpoint, confirmed correct/approved-only/consistent with sub-health
scoring), a clean TypeScript build for both the new page and its types,
and that the dev server serves the new routes without error.

## What It Affects
- `backend/src/lib/projectHealth.ts` (new — `computeSubHealth`).
- `backend/src/routes/projects.ts` (`/:id/dashboard` rewritten;
  `countBy` helper removed as dead code).
- `frontend/src/lib/api.ts` (`HealthLevel`, `SubHealth`,
  `IntelligenceFeedItem`, `ProjectDashboard` types;
  `getProjectDashboard`; `Risk` gains `previous_severity`/
  `severity_changed_at` to match the backend type).
- `frontend/src/pages/ProjectDashboard.tsx` (new).
- `frontend/src/pages/ProjectList.tsx` (new).
- `frontend/src/App.tsx` (new routes + header nav).
- `CLAUDE.md` — new Dashboard Conventions section, API Conventions
  (`/dashboard` reshape, `/alerts`'s stale forward-looking-link note
  resolved), Frontend Conventions (new routes/pages).
