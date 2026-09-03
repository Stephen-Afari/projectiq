-- ProjectIQ: audit_log — immutable trail for consequential actions
-- (approve, reject, edit, report generation), per CLAUDE.md Security
-- Rules. Previously documented as mandatory but never actually created;
-- see docs/decision-log/2026-09-02-security-hardening.md.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id),
  -- Nullable: a future automated action (e.g. a scheduled process) may
  -- have no human actor. Every write from this phase's routes sets it.
  actor_id uuid references users (id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_organisation_id_idx on audit_log (organisation_id);
create index audit_log_resource_idx on audit_log (resource_type, resource_id);

alter table audit_log enable row level security;

create policy audit_log_isolated on audit_log
  for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());
