export interface Project {
  id: string;
  name: string;
}

export type HealthLevel = 'green' | 'amber' | 'red';

export interface SubHealth {
  schedule: HealthLevel;
  budget: HealthLevel;
  scope: HealthLevel;
  resources: HealthLevel;
}

export interface IntelligenceFeedItem {
  type: 'action' | 'risk' | 'issue' | 'decision' | 'dependency' | 'change_signal';
  id: string;
  text: string;
  confidence_type: ConfidenceType | null;
  created_at: string;
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
  previous_severity: 'low' | 'medium' | 'high' | 'critical' | null;
  severity_changed_at: string | null;
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

export interface ProjectDashboard {
  project: {
    id: string;
    name: string;
    status: string;
    health: HealthLevel;
    start_date: string | null;
    target_date: string | null;
  };
  sub_health: SubHealth;
  new_since_last_meeting: {
    since: string | null;
    actions: number;
    risks: number;
    decisions: number;
    issues: number;
  };
  counts: {
    actions: number;
    risks: number;
    issues: number;
    decisions: number;
    dependencies: number;
    change_signals: number;
  };
  overdue_actions: Action[];
  top_risks: Risk[];
  decisions_needing_attention: Decision[];
  open_issues: Issue[];
  open_dependencies: Dependency[];
  change_signals: ChangeSignal[];
  recent_intelligence: IntelligenceFeedItem[];
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

// Set by lib/authContext.tsx whenever the Supabase Auth session changes —
// avoids threading the current token through every call site below.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
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

export function getProjectDashboard(projectId: string): Promise<ProjectDashboard> {
  return request<ProjectDashboard>(`/projects/${projectId}/dashboard`);
}

/** Drill-down record type — the URL path segment itself, no separate name-mapping layer needed. */
export type RecordType =
  | 'actions'
  | 'risks'
  | 'issues'
  | 'decisions'
  | 'dependencies'
  | 'change-signals';

/** Unfiltered project-scoped list — the drill-down data source (unlike the dashboard, includes non-approved rows). */
export function getProjectRecords<T>(projectId: string, type: RecordType): Promise<T[]> {
  return request<T[]>(`/projects/${projectId}/${type}`);
}

export function getProjectMeetings(projectId: string): Promise<Meeting[]> {
  return request<Meeting[]>(`/projects/${projectId}/meetings`);
}

export interface QueryCitation {
  type: 'action' | 'risk' | 'issue' | 'decision' | 'dependency' | 'change_signal' | 'meeting' | 'document';
  // The document's id (not a chunk id) when type is "document".
  id: string;
  label: string;
  // Page/heading — only present for type "document".
  section?: string | null;
}

export interface QueryAnswerPoint {
  text: string;
  confidence_type: ConfidenceType;
  citations: QueryCitation[];
}

/** A retrieved document passage the answer could cite — matched against a citation by (document_id, section). */
export interface QuerySource {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  section: string | null;
  filename: string;
  document_type: string | null;
  similarity: number;
}

export interface ProjectQueryResponse {
  project: { id: string; name: string };
  question: string;
  answer: QueryAnswerPoint[];
  data_gap: string | null;
  sources: QuerySource[];
}

export function queryProject(projectId: string, question: string): Promise<ProjectQueryResponse> {
  return request<ProjectQueryResponse>('/ai/project-query', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, question }),
  });
}

export type DocumentIngestionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProjectDocument {
  id: string;
  project_id: string;
  filename: string;
  document_type: string | null;
  ingestion_status: DocumentIngestionStatus;
  ingestion_error: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'charter', label: 'Project Charter' },
  { value: 'plan', label: 'Project Plan' },
  { value: 'raid_register', label: 'RAID / Risk Register' },
  { value: 'meeting_minutes', label: 'Previous Meeting Minutes' },
  { value: 'requirements', label: 'Requirements' },
  { value: 'contract', label: 'Contract' },
  { value: 'sop', label: 'SOP' },
  { value: 'change_request', label: 'Change Request' },
  { value: 'status_report', label: 'Status Report' },
  { value: 'budget', label: 'Budget Info' },
  { value: 'other', label: 'Other' },
] as const;

export function listProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  return request<ProjectDocument[]>(`/projects/${projectId}/documents`);
}

/**
 * The one deliberate exception to request()'s JSON-only convention:
 * FormData needs the browser to set its own multipart boundary, so this
 * omits Content-Type entirely rather than reusing request()'s hardcoded
 * 'application/json' header.
 */
export async function uploadDocument(
  projectId: string,
  file: File,
  documentType?: string,
): Promise<{ document: ProjectDocument; chunk_count: number }> {
  const formData = new FormData();
  formData.append('project_id', projectId);
  if (documentType) formData.append('document_type', documentType);
  formData.append('file', file);

  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, body?.error?.details);
  }
  return body;
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

// approved_by is no longer sent — the backend derives it from the
// authenticated session (req.user.id) so a caller can't approve
// something as someone else. See docs/decision-log/
// 2026-09-02-security-hardening.md.
export function patchApproval<T>(
  resource: ResourceKey,
  id: string,
  approvalStatus: 'approved' | 'rejected',
): Promise<T> {
  return request<T>(`/${RESOURCE_PATHS[resource]}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ approval_status: approvalStatus }),
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
