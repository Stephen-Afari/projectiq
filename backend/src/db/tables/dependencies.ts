import {
  insertRow,
  selectByColumn,
  selectById,
  updateApprovalStatus,
  updateRow,
  type ApprovalAuditContext,
} from '../queryTable.js';
import type { Dependency, DependencyStatus } from '../types.js';

const TABLE = 'dependencies';

export async function listDependenciesByProject(projectId: string): Promise<Dependency[]> {
  return selectByColumn<Dependency>(TABLE, 'project_id', projectId);
}

export async function listDependenciesByMeeting(meetingId: string): Promise<Dependency[]> {
  return selectByColumn<Dependency>(TABLE, 'meeting_id', meetingId);
}

export async function getDependencyById(id: string): Promise<Dependency | null> {
  return selectById<Dependency>(TABLE, id);
}

export async function createDependency(input: {
  project_id: string;
  meeting_id?: string;
  description: string;
  upstream_activity?: string;
  downstream_activity?: string;
  owner?: string;
  status?: DependencyStatus;
  source_excerpt?: string;
  created_by_agent?: string;
  confidence_type?: Dependency['confidence_type'];
  impact_assessment?: Dependency['impact_assessment'];
}): Promise<Dependency> {
  return insertRow<Dependency>(TABLE, input);
}

export async function updateDependencyApprovalStatus(
  id: string,
  status: 'approved' | 'rejected',
  context: ApprovalAuditContext,
): Promise<Dependency> {
  return updateApprovalStatus<Dependency>(TABLE, id, status, context);
}

export async function updateDependencyFields(
  id: string,
  patch: Partial<{
    description: string;
    upstream_activity: string | null;
    downstream_activity: string | null;
    owner: string | null;
    status: DependencyStatus;
    confidence_type: Dependency['confidence_type'];
  }>,
): Promise<Dependency> {
  return updateRow<Dependency>(TABLE, id, patch);
}
