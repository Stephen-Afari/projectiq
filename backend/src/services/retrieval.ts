import { config } from '../config.js';
import { searchProjectChunks, type ChunkSearchResult } from '../db/index.js';
import { embeddingClient } from './embeddings/index.js';

export type { ChunkSearchResult };

/**
 * Embeds `question` with the same local embedding client used for
 * ingestion (backend/src/services/embeddings/) and runs a top-k
 * pgvector similarity search scoped to `projectId`, then drops any
 * result below config.retrievalMinSimilarity — nearest-neighbor search
 * alone always returns k rows even when none are actually relevant to
 * the question; the threshold is what lets the Project Assistant say
 * "the documents don't cover this" instead of grounding an answer in
 * whatever happened to be least-far-away.
 */
export async function retrieveRelevantChunks(
  projectId: string,
  question: string,
): Promise<ChunkSearchResult[]> {
  const [queryEmbedding] = await embeddingClient.embedTexts([question]);
  const results = await searchProjectChunks(projectId, queryEmbedding!, config.retrievalTopK);
  return results.filter((r) => r.similarity >= config.retrievalMinSimilarity);
}
