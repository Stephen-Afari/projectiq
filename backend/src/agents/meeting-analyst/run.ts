import type { Meeting, Project } from '../../db/types.js';
import { runStructuredWithRetry } from '../../services/llm/runStructured.js';
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from './prompt.js';
import { meetingAnalysisJsonSchema, meetingAnalysisSchema, type MeetingAnalysisResult } from './schema.js';

const TOOL_NAME = 'record_meeting_analysis';
const TOOL_DESCRIPTION =
  'Records the structured project intelligence extracted from a meeting transcript.';

export interface MeetingAnalystRunResult {
  validationPassed: boolean;
  result: MeetingAnalysisResult | null;
  rawOutput: unknown;
  model: string;
  promptVersion: string;
  attempts: number;
  errorMessage: string | null;
}

/**
 * Runs the Meeting Analyst agent end to end via the shared
 * runStructuredWithRetry loop (model call → zod validate → repair-prompt
 * retry). Pure extraction — no DB writes here; persistence is orchestrated
 * by backend/src/agents/pipeline.ts, per CLAUDE.md's "agents don't call
 * each other / orchestration happens in routes" convention.
 */
export async function runMeetingAnalyst(input: {
  transcript: string;
  project: Project;
  meeting: Meeting;
}): Promise<MeetingAnalystRunResult> {
  const run = await runStructuredWithRetry({
    system: buildSystemPrompt(),
    buildInitialUserPrompt: () => buildUserPrompt(input),
    buildRepairPrompt: (previousOutput, validationErrors) =>
      buildRepairPrompt({ ...input, previousOutput, validationErrors }),
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    jsonSchema: meetingAnalysisJsonSchema,
    zodSchema: meetingAnalysisSchema,
    maxTokens: 8192,
  });

  return { ...run, promptVersion: PROMPT_VERSION };
}
