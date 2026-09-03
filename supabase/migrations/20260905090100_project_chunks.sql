-- ProjectIQ: project_chunks — embedded text chunks from uploaded project
-- documents, for a future RAG retrieval phase (this migration only builds
-- the ingestion-side storage; nothing queries this table by similarity
-- yet). The `vector` extension was already enabled in the very first
-- migration (20260821090000_extensions_and_enums.sql), in anticipation of
-- exactly this. See docs/decision-log/2026-09-05-rag-document-ingestion.md.
--
-- No ivfflat similarity index yet — building one now, on an empty table,
-- would be badly tuned. Deferred to the retrieval phase that actually
-- queries it by similarity, not forgotten.

create table project_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  document_id uuid not null references documents (id),
  chunk_index int not null,
  content text not null,
  -- Page number (PDF), nearest heading (Markdown/plain text), or null
  -- (DOCX — no reliable page/section boundary without full rendering).
  section text,
  -- Xenova/all-MiniLM-L6-v2, 384 dimensions (backend/src/services/embeddings/).
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);

create index project_chunks_project_id_idx on project_chunks (project_id);
create index project_chunks_document_id_idx on project_chunks (document_id);

alter table project_chunks enable row level security;

create policy project_chunks_isolated on project_chunks
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_chunks.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = project_chunks.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );
