import type { ChangeSignal, Dependency, Risk, RiskSeverity } from '../db/types.js';

export type HealthLevel = 'green' | 'amber' | 'red';

export interface SubHealth {
  schedule: HealthLevel;
  budget: HealthLevel;
  scope: HealthLevel;
  resources: HealthLevel;
}

const SEVERITY_WEIGHT: Record<RiskSeverity, number> = {
  low: 1,
  medium: 1,
  high: 2,
  critical: 3,
};

function levelFromScore(score: number): HealthLevel {
  if (score >= 3) return 'red';
  if (score >= 1) return 'amber';
  return 'green';
}

/**
 * Deterministic sub-health scoring — not a 5th AI agent. Reads only
 * already-stored, approved data: the Impact Analyst's per-category
 * impact_assessment fields on risks/dependencies/change_signals, plus the
 * overdue-actions count already computed by computeProjectAlerts. A
 * simple, explainable heuristic (see
 * docs/decision-log/2026-09-01-project-dashboard.md), not a judgement call
 * made at dashboard-load time.
 */
export function computeSubHealth(
  risks: Risk[],
  dependencies: Dependency[],
  changeSignals: ChangeSignal[],
  overdueActionsCount: number,
): SubHealth {
  const scores = { schedule: 0, budget: 0, scope: 0, resources: 0 };

  for (const r of risks) {
    if (r.approval_status !== 'approved' || !r.impact_assessment?.applicable) continue;
    const weight = SEVERITY_WEIGHT[r.severity ?? 'medium'];
    if (r.impact_assessment.schedule_impact) scores.schedule += weight;
    if (r.impact_assessment.cost_impact) scores.budget += weight;
    if (r.impact_assessment.scope_impact) scores.scope += weight;
    if (r.impact_assessment.resource_impact) scores.resources += weight;
  }

  for (const item of [...dependencies, ...changeSignals]) {
    if (item.approval_status !== 'approved' || !item.impact_assessment?.applicable) continue;
    if (item.impact_assessment.schedule_impact) scores.schedule += 1;
    if (item.impact_assessment.cost_impact) scores.budget += 1;
    if (item.impact_assessment.scope_impact) scores.scope += 1;
    if (item.impact_assessment.resource_impact) scores.resources += 1;
  }

  scores.schedule += Math.min(overdueActionsCount, 3);

  return {
    schedule: levelFromScore(scores.schedule),
    budget: levelFromScore(scores.budget),
    scope: levelFromScore(scores.scope),
    resources: levelFromScore(scores.resources),
  };
}
