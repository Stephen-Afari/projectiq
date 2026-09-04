# 2026-09-11 — Frontend Project Creation

## Context

`POST /api/projects` (`backend/src/routes/projects.ts`) already existed,
session-authenticated and correctly scoping `organisation_id` server-side
via `createProjectSchema` (`name` required; `description`/`status`/
`health`/`start_date`/`target_date` optional) — but the frontend had no
way to call it. `NewMeeting.tsx`'s project picker only ever listed
whatever `listProjects()` returned, so a user with no seeded projects (or
who simply wanted to start a new one) had no in-app path to create one.
This adds that path entirely on the frontend — no backend, schema, RLS,
or approval-logic changes were needed or made.

## What changed

- **`frontend/src/lib/api.ts`**: extended the previously minimal
  `Project` interface (`{ id, name }`) with the optional fields the
  backend already returns/accepts (`description`, `status`, `health`,
  `start_date`, `target_date`) — additive only, no existing `Project`
  consumer was affected. Added a `ProjectStatus` literal union mirroring
  the backend's `projectStatusValues` zod enum, reused the existing
  `HealthLevel` type rather than inventing a duplicate. Added
  `CreateProjectInput` and `createProject()`, mirroring the exact
  existing shape of `CreateMeetingInput`/`createMeeting()` — same
  `request<T>(path, { method: 'POST', body })` convention, no new
  pattern introduced.
- **New `frontend/src/components/NewProjectForm.tsx`**: a reusable form
  (Name required; Description, Status, Health, Start/Target date
  optional) built from the existing `ui/Card` and `ui/StatusBanner`
  primitives and the same input/button styling already established in
  `NewMeeting.tsx`/`Login.tsx` (brand-cyan primary button, explicit
  slate-grey disabled state). Takes `onCreated`/`onCancel` props and
  does not navigate or reset itself — the caller decides what happens
  next, so the same component serves two different flows.
- **`ProjectList.tsx`**: added a "New Project" button next to the page
  heading that toggles `<NewProjectForm>` inline (no modal library —
  consistent with this codebase's no-new-dependency convention). On
  success the new project is appended to local state immediately, no
  extra network round-trip.
- **`NewMeeting.tsx`**: added a "+ New project" text link next to the
  Project field label that toggles the same `<NewProjectForm>` in an
  inline expanding panel beneath the dropdown. On success, the new
  project is appended to local `projects` state, auto-selected
  (`setProjectId`), and the panel collapses — the user continues filling
  out the meeting form without navigating away, per the brief.

## Verification

- `npx tsc -b` — clean, zero errors.
- `npm run build` — production build succeeds.
- **Exercised the real flow end-to-end against the live dev backend**,
  not just read the code: signed in as the seeded demo user
  (`priya.nair@apex-manufacturing.example`) via Supabase Auth's password
  grant, then called `POST /api/projects` with the exact payload shape
  `NewProjectForm` sends (`{ name, description, status, health }`).
  Got `201` back with a full project row matching the extended `Project`
  type. Confirmed via a follow-up `GET /api/projects` call that the new
  project appears in the list the frontend's `listProjects()` /
  `NewMeeting.tsx`'s dropdown would render — proving both the create and
  list paths work together, not just in isolation.
- No visual/browser screenshot was taken — this environment has no
  browser-automation tool, the same disclosed limitation as every prior
  frontend phase in this project. Based on the actual component code and
  the live API verification above: on `/projects`, clicking "New
  Project" reveals the form inline below the heading; submitting it
  hides the form and the new project card appears at the end of the
  list immediately (no page reload). On `/` (New Meeting), clicking
  "+ New project" expands the form beneath the project `<select>`;
  submitting it collapses the form and the dropdown now shows the new
  project pre-selected, so the rest of the meeting form remains fillable
  without any navigation.
- `git status`/`git diff --stat` confirmed the diff is scoped to
  `frontend/src/lib/api.ts`, the new `NewProjectForm.tsx`,
  `ProjectList.tsx`, `NewMeeting.tsx`, and this entry — no
  `backend/`, `supabase/migrations/`, or `n8n/` files touched.
