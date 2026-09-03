-- ProjectIQ: match_project_chunks — top-k cosine-similarity search over a
-- single project's document chunks, joined to `documents` so the result
-- already carries the filename/document_type a citation needs. pgvector's
-- <=> operator isn't reachable through the Supabase JS query builder's
-- fluent .order()/.filter() calls — this RPC is the standard pattern.
-- project_id is filtered inside the function itself (not left to the
-- caller to filter after the fact), so a mis-scoped call can't leak
-- another project's chunks. See
-- docs/decision-log/2026-09-07-rag-retrieval-in-assistant.md.

create or replace function match_project_chunks(
  query_embedding vector(384),
  match_project_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  section text,
  filename text,
  document_type text,
  similarity float
)
language sql
stable
as $$
  select
    pc.id,
    pc.document_id,
    pc.chunk_index,
    pc.content,
    pc.section,
    d.filename,
    d.document_type,
    1 - (pc.embedding <=> query_embedding) as similarity
  from project_chunks pc
  join documents d on d.id = pc.document_id
  where pc.project_id = match_project_id
  order by pc.embedding <=> query_embedding
  limit match_count;
$$;
