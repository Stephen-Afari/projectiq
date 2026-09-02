# 2026-09-07 — "Ask ProjectIQ" Assistant Panel

## Decision
Added the frontend for `POST /api/ai/project-query` (built previously,
backend only): a chat-style panel on the Project Dashboard with suggested
question chips, session-scoped conversation history, confidence-typed
answer rendering, and citations that link into the existing drill-down
and meeting-review screens.

## New component, not folded into ProjectDashboard.tsx directly
`frontend/src/components/AskProjectIQ.tsx` has exactly one consumer
today, unlike `Skeleton.tsx` (three consumers, the codebase's usual
extraction threshold). It's still its own file — a self-contained
~200-line chat widget (message list, input, suggested chips, its own
loading/error handling) is more readable split out than inlined into an
already-large dashboard page. Documented explicitly in CLAUDE.md as a
*different* justification from the reuse-threshold rule, not a silent
exception to it.

## Types mirror the backend response exactly, not re-derived
`QueryCitation`/`QueryAnswerPoint`/`ProjectQueryResponse` in
`frontend/src/lib/api.ts` were written by reading
`backend/src/routes/ai.ts`'s actual `/project-query` handler and
`backend/src/agents/project-assistant/schema.ts` directly, not
reconstructed from memory of the task description — confirmed the real
shape is `{ project, question, answer: [{ text, confidence_type,
citations }], data_gap }` before writing the frontend types.

## Citations link into screens that already exist
`citation.type` is `action|risk|issue|decision|dependency|change_signal|
meeting`. The five non-meeting types map through a local
`CITATION_TYPE_TO_RECORD_TYPE` — the same shape as
`ProjectDashboard.tsx`'s existing `FEED_TYPE_TO_RECORD_TYPE` — into the
`ProjectRecords.tsx` drill-down route built in the prior UX phase;
`meeting` citations link to the existing `/meetings/:id/results` review
screen. No new destination pages were needed — this phase is purely
"render what the backend already returns, link it to what the frontend
already has."

## Suggested chips ask immediately, and stay visible mid-conversation
The 7 sample questions from the backend's own prompt/task spec are
rendered as pill buttons that fire the question directly on click, rather
than only pre-filling the text input — lower friction, and the more
common pattern for "suggested prompt" chips in chat UIs generally. They
remain visible above the input for the whole conversation (not hidden
after the first message), so switching to a different canned question is
always available, not just as a cold-start affordance.

## Conversation state: component state + a `key` remount, nothing more
No chat library, no localStorage, no backend persistence — a plain
discriminated-union array (`{role:'user'|'assistant'|'error', ...}`) in
`AskProjectIQ`'s own `useState`. "Keep a short conversation history in
the session" is satisfied by that state living for the page's lifetime;
scoping it *per project* needed no extra reset logic because
`ProjectDashboard.tsx` renders `<AskProjectIQ key={id} projectId={id} />`
— React remounts the component (and therefore resets its state) for free
whenever `id` changes. This matches the backend's own statelessness
(`POST /api/ai/project-query` doesn't persist anything, confirmed in the
prior phase's decision log) — there was never a case for the frontend to
persist more than the backend does.

## Loading and error states reuse existing patterns
The "Thinking…" placeholder reuses `SkeletonBlock` from
`components/Skeleton.tsx` — the same shared skeleton primitive already
used dashboard-wide — rather than introducing a spinner or a new loading
idiom. Errors render as a message bubble *inside* the conversation (not
a page-level banner like every other screen uses) because a chat panel's
natural unit of feedback is a turn in the conversation; the bubble
includes a "Try again" button that resends the exact question that
failed, using the same `ApiError` message-extraction pattern as every
other screen in this app.

## `data_gap` gets a visually distinct callout
Rendered as its own amber `border-amber-200 bg-amber-50` box beneath the
answer's statement list, reusing the callout convention already
established in `MeetingResults.tsx` for the Impact Analyst's "no material
impact" case. This keeps the hallucination-guard message from reading as
just one more bullet point — it's structurally and visually a different
kind of information (a limitation, not a claim).

## Verified live against real Apex data
`tsc -b` clean. Both dev servers running; the dashboard route and the new
component's module both resolve (`200`) through the Vite dev server. The
same `POST /api/ai/project-query` calls the panel makes were exercised
directly:
- **"Which actions are overdue?"** → one grounded, `fact`-tagged
  statement citing the real overdue action id (`4e44fd08-…`), `data_gap:
  null`. In the panel this renders as one confidence-badged line with a
  clickable citation pill routing to `/projects/:id/actions`.
- **"What are the top five project risks?"** → two `fact`-tagged
  statements (both citing the same single approved risk,
  `38ed3171-…`) plus a `data_gap` explaining only one of five requested
  risks exists — renders as two answer lines followed by the distinct
  amber "What's missing" callout, with the citation pill routing to
  `/projects/:id/risks`.

## Disclosed limitation
No browser-automation tool is available in this environment — the actual
rendered panel (chip clicks, bubble layout, citation pill navigation)
wasn't visually exercised by me. What was verified: the exact backend
contract the panel depends on (via the same `curl` calls made in the
prior backend phase, reconfirmed here), a clean TypeScript build across
`lib/api.ts`, the new component, and the dashboard page, and that both
the dashboard route and the new component's module load without a server
error — same disclosed-limitation pattern as every prior frontend phase
in this project.

## What It Affects
- `frontend/src/lib/api.ts` (`QueryCitation`, `QueryAnswerPoint`,
  `ProjectQueryResponse`, `queryProject`).
- `frontend/src/components/AskProjectIQ.tsx` (new).
- `frontend/src/pages/ProjectDashboard.tsx` (renders the panel).
- `CLAUDE.md` — Frontend Conventions (new panel, citation-linking map,
  session-scoping rationale).
