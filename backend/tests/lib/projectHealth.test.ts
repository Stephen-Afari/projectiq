import { describe, it, expect } from 'vitest';
import { computeSubHealth } from '../../src/lib/projectHealth.js';
import type { ChangeSignal, Dependency, Risk } from '../../src/db/types.js';

function risk(overrides: Partial<Risk>): Risk {
  return {
    id: 'r',
    project_id: 'p',
    meeting_id: null,
    description: 'x',
    probability: 'high',
    impact: 'high',
    severity: 'high',
    owner: null,
    mitigation: null,
    status: 'open',
    source_excerpt: null,
    approval_status: 'approved',
    created_by_agent: null,
    approved_by: null,
    approved_at: null,
    confidence_type: 'inference',
    context_flags: null,
    impact_assessment: null,
    previous_severity: null,
    severity_changed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeSubHealth', () => {
  it('is all green with no contributing data and zero overdue actions', () => {
    const result = computeSubHealth([], [] as Dependency[], [] as ChangeSignal[], 0);
    expect(result).toEqual({ schedule: 'green', budget: 'green', scope: 'green', resources: 'green' });
  });

  it('ignores a risk whose impact_assessment.applicable is false', () => {
    const risks = [
      risk({
        severity: 'critical',
        impact_assessment: {
          applicable: false,
          schedule_impact: null,
          cost_impact: null,
          scope_impact: null,
          resource_impact: null,
          dependency_impact: null,
          reasoning: 'no material impact',
          confidence_type: 'inference',
        },
      }),
    ];
    const result = computeSubHealth(risks, [] as Dependency[], [] as ChangeSignal[], 0);
    expect(result.schedule).toBe('green');
  });

  it('ignores a pending (not approved) risk even if it would otherwise score red', () => {
    const risks = [
      risk({
        approval_status: 'pending',
        severity: 'critical',
        impact_assessment: {
          applicable: true,
          schedule_impact: 'major delay',
          cost_impact: null,
          scope_impact: null,
          resource_impact: null,
          dependency_impact: null,
          reasoning: 'x',
          confidence_type: 'inference',
        },
      }),
    ];
    const result = computeSubHealth(risks, [] as Dependency[], [] as ChangeSignal[], 0);
    expect(result.schedule).toBe('green');
  });

  it('scores schedule red from a single approved critical risk with schedule_impact (weight 3)', () => {
    const risks = [
      risk({
        severity: 'critical',
        impact_assessment: {
          applicable: true,
          schedule_impact: 'major delay',
          cost_impact: null,
          scope_impact: null,
          resource_impact: null,
          dependency_impact: null,
          reasoning: 'x',
          confidence_type: 'inference',
        },
      }),
    ];
    const result = computeSubHealth(risks, [] as Dependency[], [] as ChangeSignal[], 0);
    expect(result.schedule).toBe('red');
  });

  it('scores schedule amber from overdue actions alone (min(count,3), 1-2 = amber)', () => {
    const result = computeSubHealth([], [] as Dependency[], [] as ChangeSignal[], 2);
    expect(result.schedule).toBe('amber');
  });

  it('caps the overdue-actions contribution at 3 (schedule red at exactly 3, no higher)', () => {
    const resultAtCap = computeSubHealth([], [] as Dependency[], [] as ChangeSignal[], 3);
    const resultAboveCap = computeSubHealth([], [] as Dependency[], [] as ChangeSignal[], 50);
    expect(resultAtCap.schedule).toBe('red');
    expect(resultAboveCap.schedule).toBe('red');
  });
});
