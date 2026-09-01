export interface Project {
  id: string;
  name: string;
}

export interface Meeting {
  id: string;
  project_id: string;
  title: string;
  meeting_date: string;
  transcript_reference: string | null;
  summary: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type ConfidenceType = 'fact' | 'inference' | 'recommendation';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ContextFlags {
  is_likely_duplicate: boolean;
  duplicate_of_id: string | null;
  duplicate_reasoning: string | null;
  related_items: Array<{ ref: string; relationship: string; reasoning: string }>;
  confidence_type: ConfidenceType;
}

export interface ImpactAssessment {
  applicable: boolean;
  schedule_impact: string | null;
  cost_impact: string | null;
  scope_impact: string | null;
  resource_impact: string | null;
  dependency_impact: string | null;
  reasoning: string | null;
  confidence_type: 'inference';
}

interface EntityBase {
  id: string;
  project_id: string;
  meeting_id: string | null;
  source_excerpt: string | null;
  approval_status: ApprovalStatus;
  created_by_agent: string | null;
  approved_by: string | null;
  approved_at: string | null;
  confidence_type: ConfidenceType | null;
  created_at: string;
}

export interface Action extends EntityBase {
  description: string;
  owner: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  context_flags: ContextFlags | null;
}

export interface Risk extends EntityBase {
  description: string;
  probability: 'low' | 'medium' | 'high' | null;
  impact: 'low' | 'medium' | 'high' | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  owner: string | null;
  mitigation: string | null;
  status: string;
  context_flags: ContextFlags | null;
  impact_assessment: ImpactAssessment | null;
}

export interface Issue extends EntityBase {
  description: string;
  owner: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  status: string;
  resolution: string | null;
}

export interface Decision extends EntityBase {
  decision: string;
  decision_owner: string | null;
  decision_date: string | null;
  impact: string | null;
  context_flags: ContextFlags | null;
}

export interface Dependency extends EntityBase {
  description: string;
  upstream_activity: string | null;
  downstream_activity: string | null;
  owner: string | null;
  status: string;
  impact_assessment: ImpactAssessment | null;
}

export interface ChangeSignal extends EntityBase {
  change_type: string | null;
  description: string;
  potential_impact: string | null;
  status: string;
  impact_assessment: ImpactAssessment | null;
}

export interface MeetingResults {
  meeting: Meeting;
  actions: Action[];
  risks: Risk[];
  issues: Issue[];
  decisions: Decision[];
  dependencies: Dependency[];
  change_signals: ChangeSignal[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, body?.error?.details);
  }
  return body as T;
}

export function listProjects(): Promise<Project[]> {
  return request<Project[]>('/projects');
}

export function listUsers(): Promise<User[]> {
  return request<User[]>('/users');
}

export interface CreateMeetingInput {
  project_id: string;
  title: string;
  meeting_date: string;
  transcript_text: string;
  source?: string;
}

export function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  return request<Meeting>('/meetings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function analyseMeeting(meetingId: string): Promise<unknown> {
  return request('/ai/analyse-meeting', {
    method: 'POST',
    body: JSON.stringify({ meeting_id: meetingId }),
  });
}

export function getMeetingResults(meetingId: string): Promise<MeetingResults> {
  return request<MeetingResults>(`/meetings/${meetingId}/results`);
}

/** Maps a MeetingResults key to its API URL segment (change_signals -> change-signals). */
export type ResourceKey =
  | 'actions'
  | 'risks'
  | 'issues'
  | 'decisions'
  | 'dependencies'
  | 'change_signals';

const RESOURCE_PATHS: Record<ResourceKey, string> = {
  actions: 'actions',
  risks: 'risks',
  issues: 'issues',
  decisions: 'decisions',
  dependencies: 'dependencies',
  change_signals: 'change-signals',
};

export function patchApproval<T>(
  resource: ResourceKey,
  id: string,
  approvalStatus: 'approved' | 'rejected',
  approvedBy: string,
): Promise<T> {
  return request<T>(`/${RESOURCE_PATHS[resource]}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ approval_status: approvalStatus, approved_by: approvedBy }),
  });
}

export function patchEdit<T>(
  resource: ResourceKey,
  id: string,
  fields: Record<string, unknown>,
): Promise<T> {
  return request<T>(`/${RESOURCE_PATHS[resource]}/${id}/edit`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}
