import type { ZodType } from 'zod';
import { llmClient } from './index.js';

export interface RunStructuredParams<T> {
  system: string;
  buildInitialUserPrompt: () => string;
  /** Called on retry with the previous (invalid) output and the zod validation errors. */
  buildRepairPrompt: (previousOutput: unknown, validationErrors: string) => string;
  toolName: string;
  toolDescription: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: ZodType<T>;
  maxTokens?: number;
  maxAttempts?: number;
}

export interface RunStructuredResult<T> {
  validationPassed: boolean;
  result: T | null;
  rawOutput: unknown;
  model: string;
  attempts: number;
  errorMessage: string | null;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Generic structured-completion runner shared by every agent: calls the
 * model via llmClient, validates the response against `zodSchema`, and —
 * if validation fails — retries with a repair prompt (previous output +
 * exact validation errors) up to `maxAttempts` times. API-level failures
 * (billing, auth, network, rate limit) are not retried, since a repair
 * prompt can't fix those; the failure is returned immediately so the
 * caller can still log the attempt instead of losing it.
 *
 * Originally inline in meeting-analyst/run.ts; extracted once a second and
 * third agent needed the identical loop.
 */
export async function runStructuredWithRetry<T>(
  params: RunStructuredParams<T>,
): Promise<RunStructuredResult<T>> {
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let rawOutput: unknown = null;
  let model = '';
  let lastErrorMessage = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const user =
      attempt === 1
        ? params.buildInitialUserPrompt()
        : params.buildRepairPrompt(rawOutput, lastErrorMessage);

    let completion;
    try {
      completion = await llmClient.generateStructured({
        system: params.system,
        user,
        toolName: params.toolName,
        toolDescription: params.toolDescription,
        jsonSchema: params.jsonSchema,
        maxTokens: params.maxTokens ?? 8192,
      });
    } catch (err) {
      return {
        validationPassed: false,
        result: null,
        rawOutput,
        model,
        attempts: attempt,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }

    rawOutput = completion.raw;
    model = completion.model;

    const parsed = params.zodSchema.safeParse(rawOutput);
    if (parsed.success) {
      return {
        validationPassed: true,
        result: parsed.data,
        rawOutput,
        model,
        attempts: attempt,
        errorMessage: null,
      };
    }

    lastErrorMessage = JSON.stringify(parsed.error.flatten(), null, 2);
  }

  return {
    validationPassed: false,
    result: null,
    rawOutput,
    model,
    attempts: maxAttempts,
    errorMessage: lastErrorMessage,
  };
}
