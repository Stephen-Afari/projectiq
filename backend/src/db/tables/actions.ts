import {
  insertRow,
  selectByColumn,
  selectById,
  updateApprovalStatus,
  updateRow,
  type ApprovalAuditContext,
} from '../queryTable.js';
import type { Action, ActionPriority, ActionStatus } from '../types.js';

const TABLE = 'actions';

export async function listActionsByProject(projectId: string): Promise<Action[]> {
  return selectByColumn<Action>(TABLE, 'project_id', projectId);
}

export async function listActionsByMeeting(meetingId: string): Promise<Action[]> {
  return selectByColumn<Action>(TABLE, 'meeting_id', meetingId);
}

export async function getActionById(id: string): Promise<Action | null> {
  return selectById<Action>(TABLE, id);
}

export async function createAction(input: {
  project_id: string;
  meeting_id?: string;
  description: string;
  owner?: string;
  due_date?: string;
  priority?: ActionPriority;
  status?: ActionStatus;
  source_excerpt?: string;
  created_by_agent?: string;
  confidence_type?: Action['confidence_type'];
  context_flags?: Action['context_flags'];
}): Promise<Action> {
  return insertRow<Action>(TABLE, input);
}

export async function updateActionApprovalStatus(
  id: string,
  status: 'approved' | 'rejected',
  context: ApprovalAuditContext,
): Promise<Action> {
  return updateApprovalStatus<Action>(TABLE, id, status, context);
}

export async function updateActionFields(
  id: string,
  patch: Partial<{
    description: string;
    owner: string | null;
    due_date: string | null;
    priority: ActionPriority;
    status: ActionStatus;
    confidence_type: Action['confidence_type'];
  }>,
): Promise<Action> {
  return updateRow<Action>(TABLE, id, patch);
}
