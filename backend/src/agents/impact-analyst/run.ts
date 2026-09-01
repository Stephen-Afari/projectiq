import { runStructuredWithRetry } from '../../services/llm/runStructured.js';
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from './prompt.js';
import type { ImpactAnalystPromptInput } from './prompt.js';
import {
  impactAnalysisJsonSchema,
  impactAnalysisResultSchema,
  type ImpactAnalysisResult,
} from './schema.js';

const TOOL_NAME = 'record_impact_analysis';
const TOOL_DESCRIPTION =
  'Records schedule/cost/scope/resource/dependency impact assessments for risks, dependencies, and change signals.';

export interface ImpactAnalystRunResult {
  validationPassed: boolean;
  result: ImpactAnalysisResult | null;
  rawOutput: unknown;
  model: string;
  promptVersion: string;
  attempts: number;
  errorMessage: string | null;
}

/**
 * Runs the Project Impact Analyst: one LLM call assessing all new
 * risks/dependencies/change_signals from this run. Pure — no DB writes;
 * the pipeline merges assessments onto the draft items and persists
 * everything together.
 */
export async function runImpactAnalyst(
  input: ImpactAnalystPromptInput,
): Promise<ImpactAnalystRunResult> {
  const run = await runStructuredWithRetry({
    system: buildSystemPrompt(),
    buildInitialUserPrompt: () => buildUserPrompt(input),
    buildRepairPrompt: (previousOutput, validationErrors) =>
      buildRepairPrompt({ ...input, previousOutput, validationErrors }),
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    jsonSchema: impactAnalysisJsonSchema,
    zodSchema: impactAnalysisResultSchema,
    maxTokens: 4096,
  });

  return { ...run, promptVersion: PROMPT_VERSION };
}
