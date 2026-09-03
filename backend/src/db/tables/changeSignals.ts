import {
  insertRow,
  selectByColumn,
  selectById,
  updateApprovalStatus,
  updateRow,
  type ApprovalAuditContext,
} from '../queryTable.js';
import type { ChangeSignal, ChangeSignalStatus } from '../types.js';

const TABLE = 'change_signals';

export async function listChangeSignalsByProject(projectId: string): Promise<ChangeSignal[]> {
  return selectByColumn<ChangeSignal>(TABLE, 'project_id', projectId);
}

export async function listChangeSignalsByMeeting(meetingId: string): Promise<ChangeSignal[]> {
  return selectByColumn<ChangeSignal>(TABLE, 'meeting_id', meetingId);
}

export async function getChangeSignalById(id: string): Promise<ChangeSignal | null> {
  return selectById<ChangeSignal>(TABLE, id);
}

export async function createChangeSignal(input: {
  project_id: string;
  meeting_id?: string;
  change_type?: string;
  description: string;
  potential_impact?: string;
  status?: ChangeSignalStatus;
  source_excerpt?: string;
  created_by_agent?: string;
  confidence_type?: ChangeSignal['confidence_type'];
  impact_assessment?: ChangeSignal['impact_assessment'];
}): Promise<ChangeSignal> {
  return insertRow<ChangeSignal>(TABLE, input);
}

export async function updateChangeSignalApprovalStatus(
  id: string,
  status: 'approved' | 'rejected',
  context: ApprovalAuditContext,
): Promise<ChangeSignal> {
  return updateApprovalStatus<ChangeSignal>(TABLE, id, status, context);
}

export async function updateChangeSignalFields(
  id: string,
  patch: Partial<{
    change_type: string;
    description: string;
    potential_impact: string | null;
    status: ChangeSignalStatus;
    confidence_type: ChangeSignal['confidence_type'];
  }>,
): Promise<ChangeSignal> {
  return updateRow<ChangeSignal>(TABLE, id, patch);
}
