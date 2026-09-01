import { insertRow } from '../queryTable.js';
import type { AgentRun } from '../types.js';

const TABLE = 'agent_runs';

export async function createAgentRun(input: {
  agent_name: string;
  project_id?: string;
  meeting_id?: string;
  model: string;
  prompt_version: string;
  input_refs?: unknown;
  raw_output?: unknown;
  validation_passed: boolean;
  error_message?: string | null;
}): Promise<AgentRun> {
  return insertRow<AgentRun>(TABLE, input);
}
