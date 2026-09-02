import { runStructuredWithRetry } from '../../services/llm/runStructured.js';
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from './prompt.js';
import type { ProjectAssistantInput } from './types.js';
import {
  projectQueryJsonSchema,
  projectQueryResultSchema,
  type ProjectQueryResult,
} from './schema.js';

const TOOL_NAME = 'record_project_query';
const TOOL_DESCRIPTION =
  'Records a grounded, confidence-typed, cited answer to a natural-language question about one project, plus any gap in the underlying data.';

export interface ProjectAssistantRunResult {
  validationPassed: boolean;
  result: ProjectQueryResult | null;
  rawOutput: unknown;
  model: string;
  promptVersion: string;
  attempts: number;
  errorMessage: string | null;
}

/**
 * Runs the Project Assistant: one LLM call answering a question from
 * already-gathered project data (see routes/ai.ts project-query
 * handler). Pure — no DB writes; the route logs to agent_runs and returns
 * the answer directly (nothing is persisted, unlike the weekly report).
 */
export async function runProjectAssistant(
  input: ProjectAssistantInput,
): Promise<ProjectAssistantRunResult> {
  const run = await runStructuredWithRetry({
    system: buildSystemPrompt(),
    buildInitialUserPrompt: () => buildUserPrompt(input),
    buildRepairPrompt: (previousOutput, validationErrors) =>
      buildRepairPrompt({ ...input, previousOutput, validationErrors }),
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    jsonSchema: projectQueryJsonSchema,
    zodSchema: projectQueryResultSchema,
    maxTokens: 4096,
  });

  return { ...run, promptVersion: PROMPT_VERSION };
}
