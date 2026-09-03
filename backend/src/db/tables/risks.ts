import {
  insertRow,
  selectByColumn,
  selectById,
  updateApprovalStatus,
  updateRow,
  type ApprovalAuditContext,
} from '../queryTable.js';
import type { Risk, RiskImpact, RiskProbability, RiskSeverity, RiskStatus } from '../types.js';

const TABLE = 'risks';

export async function listRisksByProject(projectId: string): Promise<Risk[]> {
  return selectByColumn<Risk>(TABLE, 'project_id', projectId);
}

export async function listRisksByMeeting(meetingId: string): Promise<Risk[]> {
  return selectByColumn<Risk>(TABLE, 'meeting_id', meetingId);
}

export async function getRiskById(id: string): Promise<Risk | null> {
  return selectById<Risk>(TABLE, id);
}

export async function createRisk(input: {
  project_id: string;
  meeting_id?: string;
  description: string;
  probability?: RiskProbability;
  impact?: RiskImpact;
  severity?: RiskSeverity;
  owner?: string;
  mitigation?: string;
  status?: RiskStatus;
  source_excerpt?: string;
  created_by_agent?: string;
  confidence_type?: Risk['confidence_type'];
  context_flags?: Risk['context_flags'];
  impact_assessment?: Risk['impact_assessment'];
}): Promise<Risk> {
  return insertRow<Risk>(TABLE, input);
}

export async function updateRiskApprovalStatus(
  id: string,
  status: 'approved' | 'rejected',
  context: ApprovalAuditContext,
): Promise<Risk> {
  return updateApprovalStatus<Risk>(TABLE, id, status, context);
}

export async function updateRiskFields(
  id: string,
  patch: Partial<{
    description: string;
    probability: RiskProbability | null;
    impact: RiskImpact | null;
    severity: RiskSeverity | null;
    owner: string | null;
    mitigation: string | null;
    status: RiskStatus;
    confidence_type: Risk['confidence_type'];
    previous_severity: RiskSeverity | null;
    severity_changed_at: string | null;
  }>,
): Promise<Risk> {
  return updateRow<Risk>(TABLE, id, patch);
}
