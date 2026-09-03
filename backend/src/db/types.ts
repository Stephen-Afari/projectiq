/**
 * TypeScript mirrors of the Postgres enums and table shapes defined in
 * supabase/migrations/. This file is the single source of truth for what
 * the query helpers in db/tables/*.ts accept and return — keep it in sync
 * with the migrations whenever the schema changes.
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ConfidenceType = 'fact' | 'inference' | 'recommendation';

export type UserRole = 'admin' | 'pm' | 'contributor' | 'viewer';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectHealth = 'green' | 'amber' | 'red';

export type ActionPriority = 'low' | 'medium' | 'high' | 'critical';
export type ActionStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type RiskProbability = 'low' | 'medium' | 'high';
export type RiskImpact = 'low' | 'medium' | 'high';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'open' | 'mitigated' | 'closed' | 'accepted';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export type DependencyStatus = 'planned' | 'in_progress' | 'blocked' | 'complete';

export type ChangeSignalStatus = 'open' | 'acknowledged' | 'resolved';

/** Fields shared by every AI-extracted entity table. */
export interface EntityAuditFields {
  source_excerpt: string | null;
  approval_status: ApprovalStatus;
  created_by_agent: string | null;
  approved_by: string | null;
  approved_at: string | null;
  confidence_type: ConfidenceType | null;
}

/**
 * Written by the Context Analyst (backend/src/agents/context-analyst/) on
 * actions, risks, and decisions. Flags only — never merges or blocks
 * insertion; a human reviewer decides what to do with a flagged duplicate.
 */
export interface ContextFlags {
  is_likely_duplicate: boolean;
  duplicate_of_id: string | null;
  duplicate_reasoning: string | null;
  related_items: Array<{ ref: string; relationship: string; reasoning: string }>;
  confidence_type: ConfidenceType;
}

/**
 * Written by the Impact Analyst (backend/src/agents/impact-analyst/) on
 * risks, dependencies, and change_signals. confidence_type is always
 * "inference" — an impact projection is never a directly-stated fact.
 */
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

export interface Organisation {
  id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organisation_id: string;
  created_at: string;
}

export interface Project {
  id: string;
  organisation_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
}

export type MeetingAnalysisStatus = 'pending' | 'completed' | 'failed';

export interface Meeting {
  id: string;
  project_id: string;
  title: string;
  meeting_date: string;
  source: string | null;
  transcript_reference: string | null;
  summary: string | null;
  analysis_status: MeetingAnalysisStatus;
  analysis_error: string | null;
  created_at: string;
}

export type DocumentIngestionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProjectDocument {
  id: string;
  project_id: string;
  filename: string;
  document_type: string | null;
  storage_url: string | null;
  ingestion_status: DocumentIngestionStatus;
  ingestion_error: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

/**
 * Written by the document ingestion pipeline
 * (backend/src/services/documentIngestion.ts) — one row per chunk of an
 * uploaded document, with its embedding vector. Not an AI-extracted
 * entity (no approval_status/confidence_type) — derived data for a
 * future RAG retrieval phase, always regenerable from the source
 * document. See backend/src/services/embeddings/.
 */
export interface ProjectChunk {
  id: string;
  project_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  section: string | null;
  embedding: number[];
  created_at: string;
}

export interface Action extends EntityAuditFields {
  id: string;
  project_id: string;
  meeting_id: string | null;
  description: string;
  owner: string | null;
  due_date: string | null;
  priority: ActionPriority;
  status: ActionStatus;
  context_flags: ContextFlags | null;
  created_at: string;
}

export interface Risk extends EntityAuditFields {
  id: string;
  project_id: string;
  meeting_id: string | null;
  description: string;
  probability: RiskProbability | null;
  impact: RiskImpact | null;
  severity: RiskSeverity | null;
  owner: string | null;
  mitigation: string | null;
  status: RiskStatus;
  context_flags: ContextFlags | null;
  impact_assessment: ImpactAssessment | null;
  previous_severity: RiskSeverity | null;
  severity_changed_at: string | null;
  created_at: string;
}

export interface Issue extends EntityAuditFields {
  id: string;
  project_id: string;
  meeting_id: string | null;
  description: string;
  owner: string | null;
  severity: IssueSeverity | null;
  status: IssueStatus;
  resolution: string | null;
  created_at: string;
}

export interface Decision extends EntityAuditFields {
  id: string;
  project_id: string;
  meeting_id: string | null;
  decision: string;
  decision_owner: string | null;
  decision_date: string | null;
  impact: string | null;
  context_flags: ContextFlags | null;
  created_at: string;
}

export interface Dependency extends EntityAuditFields {
  id: string;
  project_id: string;
  meeting_id: string | null;
  description: string;
  upstream_activity: string | null;
  downstream_activity: string | null;
  owner: string | null;
  status: DependencyStatus;
  impact_assessment: ImpactAssessment | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organisation_id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before_state: unknown;
  after_state: unknown;
  created_at: string;
}

export interface WeeklyReport {
  id: string;
  project_id: string;
  week_start: string;
  week_end: string;
  status_summary: string;
  report_json: Record<string, unknown>;
  model: string;
  prompt_version: string;
  created_at: string;
}

export interface AgentRun {
  id: string;
  agent_name: string;
  project_id: string | null;
  meeting_id: string | null;
  model: string;
  prompt_version: string;
  input_refs: unknown;
  raw_output: unknown;
  validation_passed: boolean;
  error_message: string | null;
  created_at: string;
}

export interface ChangeSignal extends EntityAuditFields {
  id: string;
  project_id: string;
  meeting_id: string | null;
  change_type: string | null;
  description: string;
  potential_impact: string | null;
  status: ChangeSignalStatus;
  impact_assessment: ImpactAssessment | null;
  created_at: string;
}
