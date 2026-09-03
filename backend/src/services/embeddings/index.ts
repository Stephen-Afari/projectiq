import { config } from '../../config.js';
import { localEmbeddingClient } from './localClient.js';
import type { EmbeddingClient } from './types.js';

export type { EmbeddingClient } from './types.js';

function createEmbeddingClient(): EmbeddingClient {
  switch (config.embeddingProvider) {
    case 'local':
      return localEmbeddingClient;
    default:
      throw new Error(`[embeddings] Unknown EMBEDDING_PROVIDER: ${config.embeddingProvider}`);
  }
}

export const embeddingClient: EmbeddingClient = createEmbeddingClient();
