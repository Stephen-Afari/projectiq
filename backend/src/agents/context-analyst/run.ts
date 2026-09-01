import { runStructuredWithRetry } from '../../services/llm/runStructured.js';
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from './prompt.js';
import type { ContextAnalystPromptInput } from './prompt.js';
import {
  contextAnalysisJsonSchema,
  contextAnalysisResultSchema,
  type ContextAnalysisResult,
} from './schema.js';

const TOOL_NAME = 'record_context_analysis';
const TOOL_DESCRIPTION =
  'Records duplicate/relationship annotations for newly extracted actions, risks, and decisions.';

export interface ContextAnalystRunResult {
  validationPassed: boolean;
  result: ContextAnalysisResult | null;
  rawOutput: unknown;
  model: string;
  promptVersion: string;
  attempts: number;
  errorMessage: string | null;
}

/**
 * Runs the Project Context Analyst: one LLM call comparing all new
 * actions/risks/decisions from this run against the project's existing
 * records, returning one duplicate/relationship annotation per new item.
 * Pure — no DB writes; the pipeline (backend/src/agents/pipeline.ts) merges
 * the annotations onto the draft items and persists everything together.
 */
export async function runContextAnalyst(
  input: ContextAnalystPromptInput,
): Promise<ContextAnalystRunResult> {
  const run = await runStructuredWithRetry({
    system: buildSystemPrompt(),
    buildInitialUserPrompt: () => buildUserPrompt(input),
    buildRepairPrompt: (previousOutput, validationErrors) =>
      buildRepairPrompt({ ...input, previousOutput, validationErrors }),
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    jsonSchema: contextAnalysisJsonSchema,
    zodSchema: contextAnalysisResultSchema,
    maxTokens: 4096,
  });

  return { ...run, promptVersion: PROMPT_VERSION };
}
