# 2026-09-05 — RAG Document Ingestion Pipeline

## Decision
Built the ingestion half of RAG: project-scoped document upload, text
extraction (.pdf/.docx/.md/.txt), overlapping chunking, local embedding
generation, and storage in a new `project_chunks` pgvector table. No
retrieval/assistant changes in this pass — the Project Assistant still
only answers from structured DB records; querying `project_chunks` by
similarity is the next phase.

## Embeddings run locally — no new API key, no per-document cost
Anthropic has no embeddings endpoint (confirmed by reading
`services/llm/anthropicClient.ts` and the Messages API surface) — this
necessarily needs a provider separate from the rest of the app's
`LlmClient`. Rather than blocking this feature on provisioning a new paid
key (OpenAI/Voyage) before it could even be demonstrated, the default —
and only implemented — provider is `@xenova/transformers`
(Transformers.js) running `Xenova/all-MiniLM-L6-v2` in-process: 384-dim
embeddings, no network call per request once the ~90MB model is cached
locally, zero marginal cost. New `backend/src/services/embeddings/`
mirrors `services/llm/`'s exact three-file shape (`types.ts`'s
`EmbeddingClient` interface, a provider client, an `index.ts` factory
keyed off new `config.embeddingProvider`) — same "provider-agnostic
interface, one config switch" convention, same "don't build the second
provider until it's needed" restraint already applied to `LLM_PROVIDER`'s
`openrouter` stub. A hosted provider can be added behind this same
interface later if quality/scale needs it.

## `project_chunks`: new table, `vector` extension already there
`vector` was enabled in the very first migration
(`20260821090000_extensions_and_enums.sql`) in anticipation of exactly
this — confirmed by grepping every migration for "vector" before writing
anything; this migration only adds the table. Columns: `id, project_id,
document_id, chunk_index, content, section (nullable), embedding
vector(384), created_at`. RLS policy is the identical `EXISTS (...
projects ... organisation_id = current_organisation_id())` shape used by
every other project-scoped table — verified live (see below). **No
ivfflat similarity index yet** — building one now, on an empty table,
would be badly tuned; deferred explicitly to the retrieval phase that
actually queries it by similarity, not forgotten.

## `documents` gets ingestion-status columns, reusing an existing pattern exactly
Rather than invent new status-tracking vocabulary, the new
`ingestion_status`/`ingestion_error` columns (new enum
`document_ingestion_status`: `pending`/`processing`/`completed`/`failed`)
mirror `meetings.analysis_status`/`analysis_error` column-for-column.
Also added: `mime_type`, `size_bytes`, `uploaded_by` (audit trail — who
uploaded). The pre-existing `document_type` column (already free text)
is exactly what the task's category list (charter/plan/RAID register/
minutes/requirements/contracts/SOPs/change requests/status reports/
budget) populates — no schema change needed for it; the frontend offers
those as dropdown suggestions, not a DB-enforced enum.

## Text extraction: real per-page/section metadata where the format allows it
`backend/src/services/textExtraction.ts` dispatches by file extension:
- **PDF** (`pdf-parse` v2's `PDFParse` class): `getText()` returns
  per-page text natively — each page becomes its own `ExtractedSection`
  tagged `section: "Page N"`, a real page number, not an approximation.
- **DOCX** (`mammoth`'s `extractRawText`): a single section, `section:
  null` — DOCX has no reliable page/section boundary without full
  rendering (pagination is a rendering-time concern, not stored in the
  document XML). Disclosed explicitly as a limitation, not silently
  guessed at.
- **Markdown**: sectioned by heading (`#` through `######`) — each
  section tagged with its nearest preceding heading text, giving
  meaningful `section` labels for free from documents that already use
  headings (like both sample Apex documents).
- **Plain text**: one section, `section: null` (no structural signal to
  derive one from).

## Chunking: pure function, paragraph-aware sliding window
`backend/src/services/chunking.ts` — `chunkText`/`chunkSections`, no I/O,
easily testable in isolation (though not covered by new automated tests
in this pass — the task's own output list didn't call for a test-suite
expansion this round, unlike the prior security/testing phases).
Character-based (not token-based) specifically to avoid adding a
tokenizer dependency for a first pass. Packs whole paragraphs into a
chunk up to `config.chunkSize` (1000 chars default), carries the trailing
`config.chunkOverlap` (150 chars default) into the next chunk, hard-splits
any single paragraph that alone exceeds `chunkSize`. Each `ExtractedSection`
is chunked independently, so a chunk never straddles a page or heading
boundary — section metadata stays accurate per chunk.

## Synchronous pipeline, matching an existing convention
`backend/src/services/documentIngestion.ts`'s `ingestDocument()` runs
upload → extract → chunk → embed → bulk-insert → status update entirely
within the `POST /api/documents` request/response cycle — the same
convention `POST /api/ai/analyse-meeting` already established for its
3-agent pipeline (no job queue exists in this MVP; this isn't a new
pattern). The `documents` row is created *before* extraction starts, so a
mid-pipeline failure (unsupported content, corrupt file, embedding
failure) still leaves a `failed`-status row with a captured
`ingestion_error` rather than nothing at all — same "no cross-store
transaction" tradeoff already accepted for meeting transcript uploads.

## Routes follow existing shape conventions exactly
`POST /api/documents` is flat with `project_id` in the multipart body —
the same shape as `POST /api/actions`/`/api/risks` (not nested under
`/projects/:id/`, matching how every other entity-creation route works).
`GET /api/projects/:id/documents` joins `projects.ts`'s existing
`loadProjectInOrg`-gated list routes (`/:id/actions`, `/:id/risks`, ...).
`multer` (memory storage, `config.maxDocumentSizeBytes` limit, default
20MB) is the only multipart-handling middleware in the app, scoped to
just this one route — `express.json()`'s global 1MB limit is untouched
and unrelated. `errorHandler.ts` gained a `MulterError` branch (e.g. a
file exceeding the size limit) so upload errors return a clean `400`
instead of falling through to a generic `500`.

## Frontend: one deliberate exception to the JSON-only convention
`lib/api.ts`'s `request()` hardcodes `Content-Type: application/json` on
every call. `uploadDocument()` is a separate function that builds a
`FormData` body and omits `Content-Type` entirely, letting the browser
set the correct multipart boundary — documented as the one deliberate
exception, not an inconsistency. New `components/DocumentUpload.tsx`
(file picker + document-type dropdown + upload button + a list of
already-uploaded documents with ingestion-status badges), rendered on
`ProjectDashboard.tsx` alongside the existing `AskProjectIQ` panel.

## Sample documents
`docs/samples/apex-project-charter.md` and
`docs/samples/apex-raid-register.md` — synthetic, consistent with the
existing Apex ERP Transformation Programme narrative already used
throughout seed data and the sample transcript (Priya Nair PM, David Chen
Finance Lead, Michael Osei IT Lead, Sarah Whitfield Procurement Manager,
Tom Reyes/Meridian Systems vendor PM; same sandbox-delay/vendor-staffing/
licensing-overrun storyline already established in
`docs/samples/apex-erp-kickoff-followup-transcript.md`), so a future demo
of retrieval-augmented answers can plausibly cite these documents
alongside the existing meeting-derived data.

## Verified live against the real Apex project
`POST /api/documents` with `docs/samples/apex-project-charter.md`
(`document_type: charter`) against the real Apex project (authenticated
as Priya Nair) returned `201`, `ingestion_status: "completed"`,
`chunk_count: 10`. Queried `project_chunks` directly for the resulting
document: **10 rows**, each with a correct `chunk_index`, correct
`section` (matching the charter's own Markdown headings — "Purpose",
"Business Case", "Scope", "Objectives and Success Criteria", "Governance
and Stakeholders", "High-Level Timeline", "Budget", "Key Risks Identified
at Charter Stage", "Approval"), real chunk content, and a **384-dimension
embedding vector** on every row. Cross-org isolation re-verified on the
new routes: the RLS-test-org user's token got `404` uploading to and
listing Apex's documents; Apex's own token correctly listed the ingested
charter. `tsc --noEmit`/`tsc -b` clean on both workspaces; the existing
80-test Vitest suite still passes unchanged (no route/db mock updates
needed beyond adding the new function stubs to `tests/helpers/dbMocks.ts`
for completeness).

## What It Affects
- `supabase/migrations/20260905090000_document_ingestion_status.sql`,
  `20260905090100_project_chunks.sql` (new).
- `backend/src/db/types.ts` (`ProjectDocument` extended, new
  `ProjectChunk`/`DocumentIngestionStatus`).
- `backend/src/db/tables/documents.ts` (extended, now actually wired up),
  `backend/src/db/tables/projectChunks.ts` (new).
- `backend/src/db/queryTable.ts` (new `insertRows` bulk-insert helper).
- `backend/src/services/embeddings/` (new), `textExtraction.ts` (new),
  `chunking.ts` (new), `documentIngestion.ts` (new),
  `documentStorage.ts` (new).
- `backend/src/routes/documents.ts` (new), `routes/projects.ts` (`GET
  /:id/documents`).
- `backend/src/schemas/documents.ts` (new).
- `backend/src/middleware/errorHandler.ts` (`MulterError` branch).
- `backend/src/app.ts` (mount `documentsRouter`).
- `backend/src/config.ts` (`embeddingProvider`, `embeddingModel`,
  `chunkSize`, `chunkOverlap`, `maxDocumentSizeBytes`).
- `backend/scripts/setup-storage.ts` (provisions the new `documents`
  bucket alongside `transcripts`).
- `backend/package.json` (+`multer`, `@types/multer`, `pdf-parse`,
  `mammoth`, `@xenova/transformers`).
- `backend/tests/helpers/dbMocks.ts` (new function stubs added).
- `frontend/src/lib/api.ts` (`uploadDocument`, `listProjectDocuments`,
  `ProjectDocument` type, `DOCUMENT_TYPE_OPTIONS`).
- `frontend/src/components/DocumentUpload.tsx` (new).
- `frontend/src/pages/ProjectDashboard.tsx` (renders the panel).
- `docs/samples/apex-project-charter.md`,
  `docs/samples/apex-raid-register.md` (new).
- `CLAUDE.md` — Architecture (pipeline note updated), Tech Stack (new
  deps), Database Conventions (`project_chunks`, `documents` columns),
  new RAG Document Ingestion Conventions section, API Conventions (new
  routes).
