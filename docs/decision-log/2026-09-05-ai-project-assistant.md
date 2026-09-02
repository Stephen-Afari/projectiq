# 2026-09-05 — AI Project Assistant (`POST /api/ai/project-query`)

## Decision
Implemented the previously-`501` `POST /api/ai/project-query` as a
natural-language Q&A endpoint over one project's structured data: a new
agent, `backend/src/agents/project-assistant/`, grounded strictly in
retrieved Supabase records (no vector search/RAG — explicitly deferred to
a later phase per the task itself), with structural guardrails against
hallucination rather than relying on the model to self-police.

## A 5th capability, deliberately positioned against "four agents only"
CLAUDE.md's AI Rules previously read "Four agents only... no open-ended/
general-purpose agent," which the Project Assistant could look like it
violates. It doesn't: the Architecture section already listed "Q&A (RAG)"
as its own pipeline stage, distinct from the four write-side extraction/
reporting agents, before this endpoint was ever built. CLAUDE.md now says
so explicitly (AI Rules' "four agents" bullet retitled to "four
*extraction/reporting* agents," with the Project Assistant called out by
name as the anticipated fifth). The implementation itself earns that
framing rather than just claiming it: no tools, no writes, no side
effects, answers grounded only in one project's already-retrieved data —
narrow enough that "general purpose" doesn't actually apply.

## Structured retrieval over query classification
The task lists 7 varied question shapes ("top five risks," "what changed
since last meeting," "generate a steering committee update," etc.).
Rather than building a classifier to route each question to a different
data-gathering path (fragile, and wrong the moment a user phrases
something slightly differently), the route always gathers the same
comprehensive-but-bounded snapshot and lets Claude work out what's
relevant — the same "fetch full list(s)" convention already used
successfully by the dashboard and weekly report. The snapshot: project +
computed sub-health (`computeSubHealth`), approved actions/risks/issues/
dependencies/change_signals, **all** decisions (pending + approved — the
one deliberate exception already established three times over, for the
same reason: "what needs approval" requires the pending ones), meetings
(for "since last meeting" and citing a meeting by name), and precomputed
`computeProjectAlerts` output (overdue actions, worsening risks, pending
decisions) so the model doesn't have to re-derive date/severity logic
itself from raw rows.

New `backend/src/lib/projectMeetings.ts` (`getMostRecentMeetingDate`)
extracts logic that was inlined in the dashboard route — now shared by
both the dashboard's "new since last meeting" and this endpoint's "what
changed since our last meeting" — re-verified live to produce identical
output after the extraction (`since: '2026-08-28'`, matching pre-change).

## Output schema: structural guardrails, not prose hoping
Mirrors the Executive Reporting Agent's proven shape — an array of
`{ text, confidence_type, citations }` statements — plus two additions
specific to answering an arbitrary question:
- **`citations`**: each statement can reference the specific records
  (`type`, `id`, `label`) it's grounded in, directly satisfying "should
  reference the underlying records."
- **`data_gap` (required, `string | null`)**: this is the actual
  hallucination guard the task asks for. Rather than instructing the
  model "say if you don't know" and hoping it remembers, the schema makes
  it a mandatory field — the model must either leave it `null` (data
  fully answers the question) or explain exactly what's missing. Verified
  live: asking for the "top five risks" against a project with only one
  approved risk on record produced `data_gap: "Only 1 approved risk
  exists in the data, so I cannot provide a true top five — 4 additional
  risk records would be needed..."` instead of inventing four more risks.

No separate free-text summary field — same minimalism already chosen for
the weekly report, where `status_summary` is *derived* by joining tagged
items rather than being a second, untagged narrative the model could
drift from its own citations.

## Citations are defensively re-validated, not trusted
Before the response is sent, every citation's `id` is checked against a
`knownIds` map (built from the exact records handed to the model, keyed
by type) — any citation referencing an id that doesn't actually exist for
its claimed type is dropped from that statement's citation list. This is
the identical pattern already used for the Context Analyst's
`duplicate_of_id` ("a hallucinated id gets nulled out, the qualitative
flag is kept") — applied here per-citation instead of per-field, but the
same principle: never let a model-reported id reach the response
unverified, but don't discard the surrounding content just because one
reference was wrong.

## Stateless — logged, not persisted
Unlike the weekly report, an answer to an ad hoc question isn't a
generated artifact meant to be revisited later, so there's no new table.
Every call is still logged to `agent_runs` (`agent_name:
'project-assistant'`, `meeting_id: null`, `input_refs: { question,
since_last_meeting }`) — the same auditability requirement as every other
agent invocation, verified live (3 rows present after the 3 demo
questions below). The route responds `200`, not `201`, since nothing is
created.

## Verified live against real Apex data
Three of the seven sample questions, against the real "ERP Transformation
Programme" project:
1. **"What are the top five project risks?"** — correctly reported the
   single approved risk on record (Meridian staffing, high severity,
   worsened from medium), explicitly flagged that only 1 of 5 requested
   risks exists (`data_gap`), and offered a clearly-labeled
   `recommendation` (not a fact) to consider logging additional known
   concerns as formal risks.
2. **"Which actions are overdue?"** — correctly identified the one
   overdue action (schedule revision, owner Priya Nair, due 2026-08-01),
   cited it, `data_gap: null`.
3. **"Generate a steering committee update."** — produced a multi-point
   synthesis (health/sub-health, key risk, overdue action, 3 additional
   in-flight actions, 9 pending decisions with duplicate-detection noted,
   1 already-approved related decision, "no issues/dependencies/change
   signals" fact, a schedule-risk inference, and a recommendation to
   consolidate duplicate decisions), each correctly tagged and cited, with
   `data_gap` correctly noting budget/spend figures aren't tracked by
   ProjectIQ so the licensing overrun's magnitude can't be quantified.

`tsc --noEmit` clean. `agent_runs` confirmed receiving one row per call,
`validation_passed: true` on all three. Dashboard's
`new_since_last_meeting.since` reconfirmed unchanged
(`2026-08-28`) after the `getMostRecentMeetingDate` extraction.

## What It Affects
- `backend/src/lib/projectMeetings.ts` (new).
- `backend/src/routes/projects.ts` (dashboard route uses the new helper;
  no behavior change).
- `backend/src/agents/project-assistant/` (new — `schema.ts`, `types.ts`,
  `prompt.ts`, `run.ts`, `index.ts`).
- `backend/src/schemas/ai.ts` (`projectQuerySchema`).
- `backend/src/routes/ai.ts` (`POST /project-query` replaces the `501`
  stub).
- `CLAUDE.md` — Architecture (pipeline description updated), AI Rules
  ("four agents" reframed, new Project Assistant bullet), API Conventions
  (new route documented).
