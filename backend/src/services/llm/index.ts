import { config } from '../../config.js';
import { anthropicClient } from './anthropicClient.js';
import type { LlmClient } from './types.js';

export type { LlmClient, StructuredCompletionRequest, StructuredCompletionResult } from './types.js';

function createLlmClient(): LlmClient {
  switch (config.llmProvider) {
    case 'anthropic':
      return anthropicClient;
    case 'openrouter':
      // Scoped for later (CLAUDE.md: OpenRouter as an optional dev-time
      // provider behind this same interface) — not implemented until a
      // second real case exists, per the no-speculative-abstraction rule.
      throw new Error('[llm] OpenRouter provider is not implemented yet');
    default:
      throw new Error(`[llm] Unknown LLM_PROVIDER: ${config.llmProvider}`);
  }
}

export const llmClient: LlmClient = createLlmClient();
