import { describe, it, expect } from 'vitest';
import { computeProjectAlerts } from '../../src/lib/projectAlerts.js';
import { FIXTURE_ACTIONS, FIXTURE_RISKS, FIXTURE_DECISIONS } from '../fixtures.js';

describe('computeProjectAlerts', () => {
  it('only counts approved, still-open, overdue actions — pending and terminal-status rows are excluded', () => {
    const { overdueActions } = computeProjectAlerts(FIXTURE_ACTIONS, FIXTURE_RISKS, FIXTURE_DECISIONS);
    expect(overdueActions).toHaveLength(1);
    expect(overdueActions[0]?.id).toBe('action-1-approved-overdue-open');
  });

  it('only surfaces approved risks whose previous_severity is set (worsened)', () => {
    const { worseningRisks } = computeProjectAlerts(FIXTURE_ACTIONS, FIXTURE_RISKS, FIXTURE_DECISIONS);
    expect(worseningRisks).toHaveLength(1);
    expect(worseningRisks[0]?.id).toBe('risk-2-approved-worsened');
  });

  it('surfaces pending decisions — the one deliberate not-yet-approved exception', () => {
    const { pendingDecisions } = computeProjectAlerts(FIXTURE_ACTIONS, FIXTURE_RISKS, FIXTURE_DECISIONS);
    expect(pendingDecisions).toHaveLength(1);
    expect(pendingDecisions[0]?.id).toBe('decision-1-pending');
  });

  it('never includes an approved decision in pendingDecisions', () => {
    const { pendingDecisions } = computeProjectAlerts(FIXTURE_ACTIONS, FIXTURE_RISKS, FIXTURE_DECISIONS);
    expect(pendingDecisions.some((d) => d.id === 'decision-2-approved')).toBe(false);
  });

  it('returns empty arrays for empty input', () => {
    expect(computeProjectAlerts([], [], [])).toEqual({
      overdueActions: [],
      worseningRisks: [],
      pendingDecisions: [],
    });
  });
});
