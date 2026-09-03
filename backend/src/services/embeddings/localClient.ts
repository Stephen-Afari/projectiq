import { config } from '../../config.js';
import type { EmbeddingClient } from './types.js';

const DIMENSIONS = 384; // Xenova/all-MiniLM-L6-v2's fixed output size

// The pipeline (and the ~90MB model it downloads on first use, then caches
// locally) is loaded lazily and once — importing this module must not pay
// that cost until an embedding is actually requested.
let extractorPromise: Promise<(text: string, opts: Record<string, unknown>) => Promise<{ data: Float32Array }>> | null = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import('@xenova/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', config.embeddingModel),
    ) as unknown as Promise<(text: string, opts: Record<string, unknown>) => Promise<{ data: Float32Array }>>;
  }
  return extractorPromise;
}

/**
 * Runs Xenova/all-MiniLM-L6-v2 in-process via transformers.js — no API
 * key, no network call per request (model weights cached locally after
 * first download), zero marginal cost per document. See
 * docs/decision-log/2026-09-05-rag-document-ingestion.md for why this is
 * the default provider instead of a hosted one.
 */
export const localEmbeddingClient: EmbeddingClient = {
  dimensions: DIMENSIONS,
  async embedTexts(texts: string[]): Promise<number[][]> {
    const extractor = await getExtractor();
    const vectors: number[][] = [];
    for (const text of texts) {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      vectors.push(Array.from(output.data));
    }
    return vectors;
  },
};
