import type { Action, Decision, Risk } from '../db/types.js';

const NON_TERMINAL_ACTION_STATUSES = new Set(['open', 'in_progress']);

export interface ProjectAlerts {
  overdueActions: Action[];
  worseningRisks: Risk[];
  pendingDecisions: Decision[];
}

/**
 * Shared by GET /api/projects/:id/alerts (the daily digest) and
 * POST /api/ai/weekly-report (the Executive Reporting Agent's escalations
 * section) — both need "what needs attention right now" computed
 * identically. Only ever surfaces approved actions/risks; pendingDecisions
 * is the one deliberately not-yet-approved category, reported for human
 * visibility only.
 */
export function computeProjectAlerts(actions: Action[], risks: Risk[], decisions: Decision[]): ProjectAlerts {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, safe to compare lexicographically

  const overdueActions = actions.filter(
    (a) =>
      a.approval_status === 'approved' &&
      a.due_date !== null &&
      a.due_date < today &&
      NON_TERMINAL_ACTION_STATUSES.has(a.status),
  );

  const worseningRisks = risks.filter(
    (r) => r.approval_status === 'approved' && r.previous_severity !== null,
  );

  const pendingDecisions = decisions.filter((d) => d.approval_status === 'pending');

  return { overdueActions, worseningRisks, pendingDecisions };
}
