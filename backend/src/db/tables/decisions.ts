import { insertRow, selectByColumn, selectById, updateApprovalStatus, updateRow } from '../queryTable.js';
import type { Decision } from '../types.js';

const TABLE = 'decisions';

export async function listDecisionsByProject(projectId: string): Promise<Decision[]> {
  return selectByColumn<Decision>(TABLE, 'project_id', projectId);
}

export async function listDecisionsByMeeting(meetingId: string): Promise<Decision[]> {
  return selectByColumn<Decision>(TABLE, 'meeting_id', meetingId);
}

export async function getDecisionById(id: string): Promise<Decision | null> {
  return selectById<Decision>(TABLE, id);
}

export async function createDecision(input: {
  project_id: string;
  meeting_id?: string;
  decision: string;
  decision_owner?: string;
  decision_date?: string;
  impact?: string;
  source_excerpt?: string;
  created_by_agent?: string;
  confidence_type?: Decision['confidence_type'];
  context_flags?: Decision['context_flags'];
}): Promise<Decision> {
  return insertRow<Decision>(TABLE, input);
}

export async function updateDecisionApprovalStatus(
  id: string,
  status: 'approved' | 'rejected',
  approvedBy: string,
): Promise<Decision> {
  return updateApprovalStatus<Decision>(TABLE, id, status, approvedBy);
}

export async function updateDecisionFields(
  id: string,
  patch: Partial<{
    decision: string;
    decision_owner: string | null;
    decision_date: string | null;
    impact: string | null;
    confidence_type: Decision['confidence_type'];
  }>,
): Promise<Decision> {
  return updateRow<Decision>(TABLE, id, patch);
}
