import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Project, Meeting } from '../../src/db/types.js';

// runMeetingAnalyst -> runStructuredWithRetry -> llmClient.generateStructured
// is the ONLY seam that touches the Anthropic SDK (confirmed by reading
// services/llm/anthropicClient.ts) — mocking this one module is sufficient
// to fully control the agent's output with zero real network calls.
const generateStructured = vi.fn();
vi.mock('../../src/services/llm/index.js', () => ({
  llmClient: { generateStructured: (...args: unknown[]) => generateStructured(...args) },
}));

const { runMeetingAnalyst } = await import('../../src/agents/meeting-analyst/index.js');

const PROJECT: Project = {
  id: 'project-1',
  organisation_id: 'org-1',
  name: 'Test Programme',
  description: null,
  status: 'active',
  health: 'green',
  start_date: null,
  target_date: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

const MEETING: Meeting = {
  id: 'meeting-1',
  project_id: 'project-1',
  title: 'Kickoff',
  meeting_date: '2026-02-01',
  source: 'upload',
  transcript_reference: 'project-1/meeting-1.txt',
  summary: null,
  analysis_status: 'pending',
  analysis_error: null,
  created_at: '2026-02-01T00:00:00.000Z',
};

const TRANSCRIPT = `Priya: We need to finalise the vendor SOW by Friday.
David: Agreed — I'll own that. Also, the migration timeline is at real risk if their team slips again.
Priya: Noted as a risk then. Let's decide: we're going with phased go-live.`;

const VALID_ANALYSIS = {
  summary: 'Kickoff meeting covering vendor SOW and go-live approach.',
  actions: [
    {
      description: 'Finalise vendor SOW',
      owner: 'David',
      due_date: '2026-02-06',
      priority: 'high',
      source_text: "I'll own that.",
      confidence_type: 'fact',
    },
  ],
  risks: [
    {
      description: 'Migration timeline at risk if vendor slips again',
      probability: 'medium',
      impact: 'high',
      severity: 'high',
      owner: null,
      mitigation: null,
      source_text: 'the migration timeline is at real risk if their team slips again',
      confidence_type: 'inference',
    },
  ],
  issues: [],
  decisions: [
    {
      decision: "We're going with phased go-live",
      decision_owner: 'Priya',
      decision_date: null,
      impact: null,
      source_text: "we're going with phased go-live",
      confidence_type: 'fact',
    },
  ],
  dependencies: [],
  change_signals: [],
};

// Missing required confidence_type on the one action — fails meetingAnalysisSchema.
const INVALID_ANALYSIS = {
  summary: 'Kickoff meeting.',
  actions: [
    {
      description: 'Finalise vendor SOW',
      owner: 'David',
      due_date: '2026-02-06',
      priority: 'high',
      source_text: "I'll own that.",
      // confidence_type omitted — invalid
    },
  ],
  risks: [],
  issues: [],
  decisions: [],
  dependencies: [],
  change_signals: [],
};

beforeEach(() => {
  generateStructured.mockReset();
});

describe('runMeetingAnalyst', () => {
  it('produces a schema-valid result with correct FACT/INFERENCE tags from a valid mocked response', async () => {
    generateStructured.mockResolvedValueOnce({ raw: VALID_ANALYSIS, model: 'claude-mock' });

    const run = await runMeetingAnalyst({ transcript: TRANSCRIPT, project: PROJECT, meeting: MEETING });

    expect(run.validationPassed).toBe(true);
    expect(run.attempts).toBe(1);
    expect(run.result?.actions[0]?.confidence_type).toBe('fact');
    expect(run.result?.risks[0]?.confidence_type).toBe('inference');
    expect(run.result?.decisions[0]?.decision).toBe("We're going with phased go-live");
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });

  it('repairs an invalid first response — retries with a repair prompt and succeeds on the second attempt', async () => {
    generateStructured
      .mockResolvedValueOnce({ raw: INVALID_ANALYSIS, model: 'claude-mock' })
      .mockResolvedValueOnce({ raw: VALID_ANALYSIS, model: 'claude-mock' });

    const run = await runMeetingAnalyst({ transcript: TRANSCRIPT, project: PROJECT, meeting: MEETING });

    expect(run.validationPassed).toBe(true);
    expect(run.attempts).toBe(2);
    expect(generateStructured).toHaveBeenCalledTimes(2);
    // The second call's prompt must actually be a repair prompt referencing the first failure.
    const secondCallArgs = generateStructured.mock.calls[1]?.[0];
    expect(secondCallArgs.user).toContain('did not match the required schema');
  });

  it('fails gracefully (no throw) when every attempt returns invalid JSON', async () => {
    generateStructured.mockResolvedValue({ raw: INVALID_ANALYSIS, model: 'claude-mock' });

    const run = await runMeetingAnalyst({ transcript: TRANSCRIPT, project: PROJECT, meeting: MEETING });

    expect(run.validationPassed).toBe(false);
    expect(run.result).toBeNull();
    expect(run.errorMessage).toBeTruthy();
    expect(generateStructured).toHaveBeenCalledTimes(3); // default maxAttempts
  });
});
