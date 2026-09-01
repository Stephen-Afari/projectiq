import { runStructuredWithRetry } from '../../services/llm/runStructured.js';
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from './prompt.js';
import type { WeeklyReportInput } from './types.js';
import {
  weeklyReportJsonSchema,
  weeklyReportResultSchema,
  type WeeklyReportResult,
} from './schema.js';

const TOOL_NAME = 'record_weekly_report';
const TOOL_DESCRIPTION =
  'Records a structured weekly executive summary: status, key risks, decisions needed, escalations, and management-attention items.';

export interface ExecutiveReportingRunResult {
  validationPassed: boolean;
  result: WeeklyReportResult | null;
  rawOutput: unknown;
  model: string;
  promptVersion: string;
  attempts: number;
  errorMessage: string | null;
}

/**
 * Runs the Executive Reporting Agent: one LLM call turning already-gathered
 * project data (see routes/ai.ts weekly-report handler) into a structured
 * sponsor-facing summary. Pure — no DB writes; the route persists the
 * result to weekly_reports.
 */
export async function runExecutiveReportingAgent(
  input: WeeklyReportInput,
): Promise<ExecutiveReportingRunResult> {
  const run = await runStructuredWithRetry({
    system: buildSystemPrompt(),
    buildInitialUserPrompt: () => buildUserPrompt(input),
    buildRepairPrompt: (previousOutput, validationErrors) =>
      buildRepairPrompt({ ...input, previousOutput, validationErrors }),
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    jsonSchema: weeklyReportJsonSchema,
    zodSchema: weeklyReportResultSchema,
    maxTokens: 4096,
  });

  return { ...run, promptVersion: PROMPT_VERSION };
}
