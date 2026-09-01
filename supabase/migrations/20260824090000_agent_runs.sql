-- ProjectIQ: agent_runs — audit log for every AI agent invocation, per
-- CLAUDE.md AI Rules ("Log every agent invocation ... for auditability and
-- debugging"). First written by the Meeting Analyst agent.

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  project_id uuid references projects (id),
  meeting_id uuid references meetings (id),
  model text not null,
  prompt_version text not null,
  input_refs jsonb,
  raw_output jsonb,
  validation_passed boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index agent_runs_project_id_idx on agent_runs (project_id);
create index agent_runs_meeting_id_idx on agent_runs (meeting_id);

alter table agent_runs enable row level security;

create policy agent_runs_isolated on agent_runs
  for all
  using (
    project_id is null
    or exists (
      select 1 from projects p
      where p.id = agent_runs.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    project_id is null
    or exists (
      select 1 from projects p
      where p.id = agent_runs.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );
