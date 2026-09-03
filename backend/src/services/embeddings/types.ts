/**
 * Provider-agnostic embedding contract — mirrors services/llm/types.ts's
 * LlmClient shape (one interface, one method, one factory switch), kept
 * as a separate interface rather than a method bolted onto LlmClient
 * because Anthropic has no embeddings endpoint at all; this is
 * necessarily a different provider from the rest of the app's model calls.
 */
export interface EmbeddingClient {
  /** Embeds a batch of texts in one call; returns one vector per input, same order. */
  embedTexts(texts: string[]): Promise<number[][]>;
  /** Vector dimensionality this client produces — must match project_chunks.embedding's declared size. */
  readonly dimensions: number;
}
