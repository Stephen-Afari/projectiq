import { callRpc, insertRows, selectByColumn } from '../queryTable.js';
import type { ProjectChunk } from '../types.js';

const TABLE = 'project_chunks';

/** Result shape of the match_project_chunks RPC (see the migration) — a chunk joined with its document's filename/type plus a similarity score. */
export interface ChunkSearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  section: string | null;
  filename: string;
  document_type: string | null;
  similarity: number;
}

/** Top-k cosine-similarity search over one project's chunks — project_id is enforced inside the SQL function itself. */
export async function searchProjectChunks(
  projectId: string,
  queryEmbedding: number[],
  matchCount: number,
): Promise<ChunkSearchResult[]> {
  return callRpc<ChunkSearchResult>('match_project_chunks', {
    query_embedding: queryEmbedding,
    match_project_id: projectId,
    match_count: matchCount,
  });
}

export async function createProjectChunks(
  chunks: Array<{
    project_id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    section: string | null;
    embedding: number[];
  }>,
): Promise<ProjectChunk[]> {
  return insertRows<ProjectChunk>(TABLE, chunks);
}

export async function listChunksByDocument(documentId: string): Promise<ProjectChunk[]> {
  return selectByColumn<ProjectChunk>(TABLE, 'document_id', documentId);
}

export async function listChunksByProject(projectId: string): Promise<ProjectChunk[]> {
  return selectByColumn<ProjectChunk>(TABLE, 'project_id', projectId);
}
