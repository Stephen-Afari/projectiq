# 2026-09-03 — Dashboard UX: Loading/Error/Empty States, Filters, Drill-Down

## Decision
Made the Project Dashboard usable beyond a demo: shape-matched loading
skeletons, error states with a Retry button, distinguishable empty vs.
filtered-to-empty states, and click-through drill-down from every
record-listing tile into a filterable, full-detail list that links back to
each record's source meeting. Built per explicit instruction to not ask
clarifying questions — ambiguous points below are resolved with a stated
default.

## Drill-down needed three new backend routes
`GET /api/projects/:id/{actions,risks,decisions}` already existed;
`/issues`, `/dependencies`, `/change-signals` didn't (only per-meeting and
per-id routes existed for those three). Added in
`backend/src/routes/projects.ts`, identical pattern to the three that
already existed — 404 if the project is missing, otherwise the project's
full list via the already-existing `listIssuesByProject`/
`listDependenciesByProject`/`listChangeSignalsByProject` (already imported
into this file for the dashboard aggregation, so no new imports). Also
added `GET /api/projects/:id/meetings` (`listMeetingsByProject`, same
reasoning) so the drill-down screen can resolve `meeting_id` → title/date
for the "source meeting" link without an N+1 per-record fetch.

**These new routes are deliberately unfiltered — no `approval_status`
check**, unlike the dashboard endpoint. That's the point: a PM clicking
into "Top Risks" should be able to see the pending and rejected risks too,
not just the one approved risk the tile showed. Verified live: the Apex
project has 16 total risks but only 1 approved — `/risks` returns all 16,
confirming drill-down genuinely broadens the view rather than mirroring
the dashboard's restriction.

## No server-side filtering — client-side only, by design
The task's own performance requirement ("avoid refetching everything on
every filter change") is satisfied structurally: `ProjectRecords.tsx`
fetches a type's full list + the project's meetings once per page load
(`useEffect` on `[id, type]`), and every filter (Approval/Status/Owner/
Date range) is a `useMemo` array filter over that already-fetched data —
zero network calls per filter interaction, regardless of how many times
the user changes a dropdown. Adding query-param filtering to the new
backend routes was considered and rejected as unnecessary complexity: at
this data scale, fetching the full list once is both simpler and already
meets the stated performance bar.

## Filter dimensions: the three asked for, plus Approval
Status and Owner use the entity's own fields (`status`/`owner`, or
`decision_owner` for decisions, which have no generic `owner` field), with
**dynamically computed options** — the distinct values actually present in
the fetched list, not a hardcoded enum, so a filter never offers a choice
that matches zero records. Date range filters `created_at` (the one
timestamp uniform across all six entity types). A fourth dimension,
**Approval status** (All/Pending/Approved/Rejected), was added beyond the
three requested — the dashboard's whole "approved-only" principle would
otherwise be impossible to see past on the drill-down screen, defeating
half the point of browsing in. It defaults from the tile's `?view=`
param (e.g. `view=pending` for the decisions-needing-attention tile) but
is always changeable — the dashboard's approved-only convention is
preserved as a *default*, not a hard restriction, once you've drilled in.

## `?view=` seeds defaults, never restricts fetched data
Each dashboard tile links to `/projects/:id/:type?view=<tile>`. The query
param only picks the initial Approval-filter value
(`defaultApprovalFilter` in `ProjectRecords.tsx`); the full list is always
fetched regardless, so narrowing the view further or broadening it back
out never requires a new page load.

## Read-only drill-down, not a second approval workflow
Each `ProjectRecords.tsx` card shows full field detail (owner, status,
severity, dates, source excerpt, confidence/approval badges) but has no
Approve/Reject/Edit actions — that workflow already exists and is scoped
to `MeetingResults.tsx`, per meeting, right after extraction. Duplicating
it here would create two places approval state could be changed from,
against the existing "no status transitions outside `updateApprovalStatus`"
discipline already documented in Database Conventions — this screen is
strictly for browsing/reporting.

## Shared `Skeleton` component — three consumers crossed the threshold
`frontend/src/components/Skeleton.tsx` (`SkeletonBlock`/`SkeletonCard`/
`SkeletonStat`) is used by `ProjectDashboard`, `ProjectRecords`, and
`ProjectList` — the same "three similar instances" extraction threshold
already established by `MeetingResults.tsx`'s shared `ItemCard`. Shape-
matched pulsing placeholders were chosen over a generic spinner so the
page layout doesn't visibly jump once real data replaces the skeleton.

## Retry is a shared pattern, not three separate implementations
Both `ProjectDashboard` and `ProjectRecords` (and `ProjectList`, for
consistency) refactor their data fetch into a `useCallback`'d `load()`
function, called once from `useEffect` on mount and again from the Retry
button's `onClick` — one function, two triggers, no duplicated fetch
logic to keep in sync.

## Empty states distinguish "nothing" from "filtered to nothing"
Existing per-section wording ("No overdue actions.") is preserved on the
dashboard. On the drill-down screen, "No {type} yet." only shows when the
fetched list is genuinely empty; "No records match these filters." shows
when the list has data but the current filter combination excludes all of
it — a PM should be able to tell the difference (nothing exists yet vs.
loosen the filters) rather than seeing the same ambiguous message either
way.

## Verified live against real Apex data
- `tsc --noEmit`/`tsc -b` clean on both `backend/` and `frontend/`.
- `GET /api/projects/:id/{issues,dependencies,change-signals,meetings}`
  all returned real, correct counts (15 issues, 6 dependencies, 19 change
  signals, 8 meetings) — confirming the new routes work end to end.
- `GET /api/projects/:id/risks` confirmed returning all 16 risks
  (14 pending, 1 rejected, 1 approved) — unfiltered, as designed, versus
  the dashboard's single approved risk.
- Both dev servers (backend `:3001`, frontend `:5174` via Vite proxy)
  running with no compile errors after all changes.

## Disclosed limitation
No browser-automation tool is available in this environment — the actual
click-through interaction (loading skeleton → data, filter dropdowns
narrowing the list, drill-down → source-meeting link) was not visually
exercised by me. What was verified: the full data contract for every new
route via `curl` against real Apex data, and clean TypeScript builds for
every new/changed frontend file — same disclosed-limitation pattern as
every prior frontend phase in this project.

## What It Affects
- `backend/src/routes/projects.ts` (`GET /:id/issues`, `/:id/dependencies`,
  `/:id/change-signals`, `/:id/meetings` — new).
- `frontend/src/lib/api.ts` (`RecordType`, `getProjectRecords`,
  `getProjectMeetings`).
- `frontend/src/components/Skeleton.tsx` (new).
- `frontend/src/pages/ProjectRecords.tsx` (new).
- `frontend/src/pages/ProjectDashboard.tsx` (skeleton, retry, tiles/feed
  items become drill-down links).
- `frontend/src/pages/ProjectList.tsx` (skeleton, retry — consistency).
- `frontend/src/App.tsx` (`/projects/:id/:type` route).
- `CLAUDE.md` — API Conventions (new routes), Dashboard Conventions
  (unfiltered drill-down source, client-side-only filtering rule),
  Frontend Conventions (new route, `components/` dir, Skeleton reuse,
  `ProjectRecords.tsx` behavior).
