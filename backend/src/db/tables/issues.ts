import {
  insertRow,
  selectByColumn,
  selectById,
  updateApprovalStatus,
  updateRow,
  type ApprovalAuditContext,
} from '../queryTable.js';
import type { Issue, IssueSeverity, IssueStatus } from '../types.js';

const TABLE = 'issues';

export async function listIssuesByProject(projectId: string): Promise<Issue[]> {
  return selectByColumn<Issue>(TABLE, 'project_id', projectId);
}

export async function listIssuesByMeeting(meetingId: string): Promise<Issue[]> {
  return selectByColumn<Issue>(TABLE, 'meeting_id', meetingId);
}

export async function getIssueById(id: string): Promise<Issue | null> {
  return selectById<Issue>(TABLE, id);
}

export async function createIssue(input: {
  project_id: string;
  meeting_id?: string;
  description: string;
  owner?: string;
  severity?: IssueSeverity;
  status?: IssueStatus;
  resolution?: string;
  source_excerpt?: string;
  created_by_agent?: string;
  confidence_type?: Issue['confidence_type'];
}): Promise<Issue> {
  return insertRow<Issue>(TABLE, input);
}

export async function updateIssueApprovalStatus(
  id: string,
  status: 'approved' | 'rejected',
  context: ApprovalAuditContext,
): Promise<Issue> {
  return updateApprovalStatus<Issue>(TABLE, id, status, context);
}

export async function updateIssueFields(
  id: string,
  patch: Partial<{
    description: string;
    owner: string | null;
    severity: IssueSeverity | null;
    status: IssueStatus;
    resolution: string | null;
    confidence_type: Issue['confidence_type'];
  }>,
): Promise<Issue> {
  return updateRow<Issue>(TABLE, id, patch);
}
