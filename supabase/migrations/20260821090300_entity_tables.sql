-- ProjectIQ: the six AI-extracted entity tables.
--
-- Every table here shares an audit-field pattern (see CLAUDE.md Database
-- Conventions): approval_status (human approval gate, default 'pending'),
-- source_excerpt (citation back to the source meeting/record),
-- created_by_agent (which of the four agents produced it, null for
-- human-entered records), approved_by/approved_at (who/when approved),
-- and confidence_type (fact/inference/recommendation, null until an agent
-- tags it). meeting_id is nullable on every table, including dependencies
-- and any table where a record may originate outside a meeting (e.g. later
-- from the Project Impact Analyst).

create table actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  meeting_id uuid references meetings (id),
  description text not null,
  owner text,
  due_date date,
  priority action_priority not null default 'medium',
  status action_status not null default 'open',
  source_excerpt text,
  approval_status approval_status not null default 'pending',
  created_by_agent text,
  approved_by uuid references users (id),
  approved_at timestamptz,
  confidence_type confidence_type,
  created_at timestamptz not null default now()
);

create index actions_project_id_idx on actions (project_id);
create index actions_meeting_id_idx on actions (meeting_id);
create index actions_approval_status_idx on actions (approval_status);
create index actions_status_idx on actions (status);

create table risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  meeting_id uuid references meetings (id),
  description text not null,
  probability risk_probability,
  impact risk_impact,
  severity risk_severity,
  owner text,
  mitigation text,
  status risk_status not null default 'open',
  source_excerpt text,
  approval_status approval_status not null default 'pending',
  created_by_agent text,
  approved_by uuid references users (id),
  approved_at timestamptz,
  confidence_type confidence_type,
  created_at timestamptz not null default now()
);

create index risks_project_id_idx on risks (project_id);
create index risks_meeting_id_idx on risks (meeting_id);
create index risks_approval_status_idx on risks (approval_status);
create index risks_status_idx on risks (status);

create table issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  meeting_id uuid references meetings (id),
  description text not null,
  owner text,
  severity issue_severity,
  status issue_status not null default 'open',
  resolution text,
  source_excerpt text,
  approval_status approval_status not null default 'pending',
  created_by_agent text,
  approved_by uuid references users (id),
  approved_at timestamptz,
  confidence_type confidence_type,
  created_at timestamptz not null default now()
);

create index issues_project_id_idx on issues (project_id);
create index issues_meeting_id_idx on issues (meeting_id);
create index issues_approval_status_idx on issues (approval_status);
create index issues_status_idx on issues (status);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  meeting_id uuid references meetings (id),
  decision text not null,
  decision_owner text,
  decision_date date,
  impact text,
  source_excerpt text,
  approval_status approval_status not null default 'pending',
  created_by_agent text,
  approved_by uuid references users (id),
  approved_at timestamptz,
  confidence_type confidence_type,
  created_at timestamptz not null default now()
);

create index decisions_project_id_idx on decisions (project_id);
create index decisions_meeting_id_idx on decisions (meeting_id);
create index decisions_approval_status_idx on decisions (approval_status);

create table dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  meeting_id uuid references meetings (id),
  description text not null,
  upstream_activity text,
  downstream_activity text,
  owner text,
  status dependency_status not null default 'planned',
  source_excerpt text,
  approval_status approval_status not null default 'pending',
  created_by_agent text,
  approved_by uuid references users (id),
  approved_at timestamptz,
  confidence_type confidence_type,
  created_at timestamptz not null default now()
);

create index dependencies_project_id_idx on dependencies (project_id);
create index dependencies_meeting_id_idx on dependencies (meeting_id);
create index dependencies_approval_status_idx on dependencies (approval_status);
create index dependencies_status_idx on dependencies (status);

create table change_signals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  meeting_id uuid references meetings (id),
  change_type text,
  description text not null,
  potential_impact text,
  status change_signal_status not null default 'open',
  source_excerpt text,
  approval_status approval_status not null default 'pending',
  created_by_agent text,
  approved_by uuid references users (id),
  approved_at timestamptz,
  confidence_type confidence_type,
  created_at timestamptz not null default now()
);

create index change_signals_project_id_idx on change_signals (project_id);
create index change_signals_meeting_id_idx on change_signals (meeting_id);
create index change_signals_approval_status_idx on change_signals (approval_status);
create index change_signals_status_idx on change_signals (status);
