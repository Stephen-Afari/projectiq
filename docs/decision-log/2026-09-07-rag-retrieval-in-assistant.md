# 2026-09-07 — RAG Retrieval Wired into the Project Assistant

## Decision
`POST /api/ai/project-query` now grounds answers in both structured
records (unchanged) and the project's uploaded documents: the incoming
question is embedded, a top-k pgvector similarity search runs over that
project's `project_chunks`, and the relevant passages are handed to the
same Project Assistant agent alongside the structured data it already
used. Citations name the source document and its section/page; the
assistant UI renders them and expands the actual passage on click.

## Similarity search: a Postgres RPC, not the Supabase JS query builder
pgvector's `<=>` (cosine distance) operator isn't reachable through
`.order()`/`.filter()` fluent calls. New migration
`20260907090000_match_project_chunks.sql` adds `match_project_chunks
(query_embedding, match_project_id, match_count)` — a `stable` SQL
function joining `project_chunks` to `documents` in one query (so the
result already carries `filename`/`document_type`, no second lookup
needed for citation labels), with `project_id` filtered **inside the
function itself**, not left to the caller to filter after the fact — a
mis-scoped call structurally cannot leak another project's chunks, the
same defense-in-depth principle already applied everywhere else in this
app (`assertProjectAccess`, RLS policies). Called through a new generic
`queryTable.ts` helper, `callRpc<T>(fn, params)`, matching the existing
"thin typed wrapper, one error-wrapping convention" used by
`selectByColumn`/`insertRow`/etc.

## Top-k alone isn't enough — a similarity threshold makes "not covered" a real outcome
`backend/src/services/retrieval.ts`'s `retrieveRelevantChunks(projectId,
question)` embeds the question with the *same* local `embeddingClient`
already built for ingestion (no new embedding provider), fetches
`config.retrievalTopK` (default 8) nearest chunks, then drops anything
below `config.retrievalMinSimilarity` (default `0.3`). Nearest-neighbor
search alone always returns exactly k rows, even for a question with
nothing relevant in any document — without a threshold, the agent would
always have *something* to (mis)cite. The threshold is what makes an
empty retrieved-passages list a meaningful, honest signal rather than a
a bug to work around.

## Citation schema: a `document` type, id = the document (not the chunk)
`queryCitationSchema.type` gained `'document'`; for that type, `id` is
the **document's** id, not the internal chunk row id — a citation should
point at something a human can recognize and go find again (a document
they uploaded), not an implementation-detail row. A new optional
`section` field carries the page/heading, only ever populated for
document citations. Defensive re-validation (the same pattern already
used for entity citations, mirroring the Context Analyst's
`duplicate_of_id` handling) got a `document` entry in `routes/ai.ts`'s
`knownIds` map, built from the actual retrieved chunks' document ids — a
hallucinated document citation is dropped exactly like a hallucinated
entity citation already was.

## Prompt: retrieved passages are listed explicitly, absence is meaningful
`prompt.ts`'s user prompt gained a "Project documents (retrieved
passages)" section, listing every post-threshold chunk with its
`type=document id=<document_id> section=<section>` tag, filename, and
content — the same `type=<x> id=<y>` addressing convention already used
for every other data category in this prompt. The system prompt was
extended (not rewritten — the existing "never invent a fact" rule and
structural `data_gap` field already existed) with an explicit
instruction: an empty or irrelevant passages list, for a question that's
clearly asking about document content, must produce a `data_gap`
explaining that — never a fallback to general/training knowledge about
what a typical charter or SOP might say.

## Response carries the retrieved passages, not just final citations
`sources` in the response is the full threshold-passed chunk list (id,
document_id, filename, section, content, similarity) — this lets the
frontend resolve "click a citation → show the source passage" by
matching a document citation's `id`+`section` against `sources` entirely
client-side. No new backend route was needed for the UI requirement.

## Frontend: document citations expand inline, entity citations unchanged
`AskProjectIQ.tsx`'s citation pills now branch by type: entity citations
still link to the existing drill-down/meeting screens exactly as before;
a `type === 'document'` citation is a button that toggles an inline
expandable block (filename, section, full passage text) beneath the
answer. No document-viewer page was built — out of scope for this phase,
and the chat panel is a sufficient place to show a short passage.

## Verified live against the real Apex project and the ingested charter
Asked (as the real Apex user, against the live backend):
> "What is the Steering Committee's approval authority threshold before
> Executive Sponsor approval is required, and what named user licence
> count did the approved budget originally assume?"

Both facts — answerable *only* from `apex-project-charter.md` — were
answered correctly and cited precisely:
- "£50,000" threshold → cited `type: document`, `apex-project-charter.md`,
  section **"Governance and Stakeholders"** (correct — matches the
  charter's actual text).
- "120 named user licences" → cited the same document, section
  **"Budget"** (also correct).
`data_gap: null` — the documents fully answered the question.

Then asked a question about a document type never uploaded ("What does
the SOP say about the change control approval workflow?") — the
assistant correctly reported no SOP exists, offered the charter's
related-but-distinct governance content as the closest available
information (clearly distinguished, not conflated), and set `data_gap`
explaining the SOP itself wasn't found — exactly the "documents don't
cover this" behavior the guardrail is meant to produce, verified with a
real model call, not just asserted from the prompt text.

Cross-org isolation re-confirmed on the now-retrieval-enabled route: the
RLS-test-org user's token got `404` querying Apex's project, unchanged
from before this phase. `tsc --noEmit`/`tsc -b` clean on both workspaces;
the existing 80-test Vitest suite passes unchanged (no test currently
exercises `/api/ai/project-query`, so no mocking of the embedding model
was needed for the suite to stay green).

## What It Affects
- `supabase/migrations/20260907090000_match_project_chunks.sql` (new).
- `backend/src/db/queryTable.ts` (`callRpc` helper).
- `backend/src/db/tables/projectChunks.ts` (`searchProjectChunks`,
  `ChunkSearchResult`).
- `backend/src/services/retrieval.ts` (new).
- `backend/src/config.ts` (`retrievalTopK`, `retrievalMinSimilarity`).
- `backend/src/agents/project-assistant/schema.ts` (citation `type`
  gains `'document'`, new `section`), `types.ts` (`retrievedChunks`),
  `prompt.ts` (new passages section + grounding rules).
- `backend/src/routes/ai.ts` (`project-query` calls
  `retrieveRelevantChunks`, extends `knownIds`, returns `sources`).
- `backend/tests/helpers/dbMocks.ts` (`searchProjectChunks` stub added).
- `frontend/src/lib/api.ts` (`QueryCitation` gains `'document'`/`section`,
  new `QuerySource`, `ProjectQueryResponse` gains `sources`).
- `frontend/src/components/AskProjectIQ.tsx` (document citation pill +
  inline expandable source-passage block).
- `CLAUDE.md` — Architecture (pipeline note updated), AI Rules (Project
  Assistant bullet updated), new RAG Retrieval Conventions section,
  updated RAG Document Ingestion Conventions intro.
