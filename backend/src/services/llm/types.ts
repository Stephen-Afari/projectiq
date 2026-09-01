/**
 * Provider-agnostic structured-output contract. Every agent (see
 * backend/src/agents/*) talks to this interface, never to an SDK directly —
 * this is the "single place that configures the model/provider" CLAUDE.md
 * requires. Swapping providers means implementing this interface once, not
 * touching agent code.
 */

export interface StructuredCompletionRequest {
  /** System prompt — role, rules, guardrails. */
  system: string;
  /** User-turn content — the actual task input (e.g. the transcript). */
  user: string;
  /** Name of the "tool" the model must call to return its structured answer. */
  toolName: string;
  toolDescription: string;
  /** JSON Schema describing the required tool input shape. */
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
}

export interface StructuredCompletionResult {
  /** Parsed JSON object the model returned — not yet validated by the caller. */
  raw: unknown;
  model: string;
}

export interface LlmClient {
  generateStructured(req: StructuredCompletionRequest): Promise<StructuredCompletionResult>;
}
