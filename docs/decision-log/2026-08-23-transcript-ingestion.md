# 2026-08-23 — Transcript Ingestion (Backend + Minimal Frontend)

## Decision
Built end-to-end transcript capture: a "New Meeting" screen (paste or
upload a `.txt`/`.md` transcript, pick a project, set title/date) backed by
an extended `POST /api/meetings`. No AI analysis — pure capture and
storage, as scoped.

## Where the transcript text lives
`meetings.transcript_reference` (added in Phase 2) was named as a pointer,
matching the existing `documents.storage_url` pattern — so rather than add
a `transcript_text` column to Postgres, transcripts are stored in a new
private Supabase Storage bucket, `transcripts`, at path
`<project_id>/<meeting_id>.txt`, with `transcript_reference` set to that
path. This required zero migration to the `meetings` table — only bucket
provisioning (`backend/scripts/setup-storage.ts`, `npm run setup:storage`,
idempotent via a `listBuckets()` check, same pattern as `scripts/seed.ts`).

`POST /api/meetings` orchestration: validate body → look up the project (a
friendly `400 "Project not found"` if missing, not a raw FK error) → create
the `meetings` row → if `transcript_text` was given, upload it and update
`transcript_reference` → return the (possibly updated) row. `transcript_text`
is optional at the schema/API level (meetings can exist without a
transcript — e.g. future agent-created stub meetings) but the frontend form
requires it, since that's the whole point of this screen.

**Known limitation, accepted for MVP**: no cross-store transaction. If the
Storage upload fails after the `meetings` row is inserted, the API returns
`502` and the meeting row persists without a transcript. Revisit if this
causes confusion — the fix would be either a compensating delete on upload
failure, or a proper outbox/retry pattern, both more machinery than this
phase needs.

## Supporting addition: `GET /api/projects`
The project picker needed a list endpoint that didn't exist (only `POST
/api/projects` and `GET /api/projects/:id` existed). Added
`GET /api/projects`, unscoped (returns all projects) — there's no auth/org
session on the frontend yet to scope by. Backed by a new `selectAll<T>()`
helper in `queryTable.ts` and `listAllProjects()` in `db/tables/projects.ts`.
Revisit once Phase 3 Auth ships a real session; this should likely become
organisation-scoped then.

## Frontend
First real screen: `frontend/src/pages/NewMeeting.tsx`, rendered directly by
`App.tsx` (no router yet — added when a second screen actually exists, per
CLAUDE.md's no-speculative-abstraction convention). `frontend/src/lib/api.ts`
is a thin typed fetch wrapper (`listProjects`, `createMeeting`) that throws
on the API's `{ error: { message } }` shape so the form can surface it.
Upload and paste share one textarea: choosing a file reads it client-side
via `File.text()` and fills the same state paste would.

## Sample transcript
`docs/samples/apex-erp-kickoff-followup-transcript.md` — a new, distinct
Apex ERP meeting (not a duplicate of the seed data's kickoff meeting)
covering a schedule delay (migration sandbox slip), a vendor/supplier risk
(Meridian Systems losing engineers), a budget concern (licence seat
overrun), one decision (phased go-live), and one dependency (procurement
config blocked on vendor master data migration) — deliberately shaped as
future Meeting Analyst test fixture material, though no extraction happens
yet.

## Verified
- `npm run setup:storage` run twice — idempotent, bucket created once.
- Uploaded the sample transcript via a simulated API call — `201`, real
  `transcript_reference`, and confirmed by downloading the object back from
  the `transcripts` bucket (4682 bytes, content matched).
- Friendly `400`s confirmed for a nonexistent `project_id` and a
  whitespace-only `transcript_text` (rejected by the zod schema's `refine`,
  not a generic error).
- Both `backend` and `frontend` typecheck clean.

## What It Affects
- `backend/src/db/queryTable.ts` (`selectAll`),
  `backend/src/db/tables/{projects,meetings}.ts` (`listAllProjects`,
  `updateMeetingTranscriptReference`).
- `backend/src/services/transcriptStorage.ts` (new),
  `backend/scripts/setup-storage.ts` (new, `npm run setup:storage`).
- `backend/src/schemas/meetings.ts` (`transcript_text` field),
  `backend/src/routes/meetings.ts` (orchestration),
  `backend/src/routes/projects.ts` (`GET /`).
- `frontend/src/lib/api.ts`, `frontend/src/pages/NewMeeting.tsx`,
  `frontend/src/App.tsx` (new frontend screen — first real UI).
- `docs/samples/apex-erp-kickoff-followup-transcript.md` (new).
- `CLAUDE.md` — new Ingestion Conventions section.
