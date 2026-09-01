-- ProjectIQ: Row Level Security.
--
-- current_organisation_id() looks up the caller's organisation via
-- public.users, keyed by auth.uid(). It is SECURITY DEFINER so it can read
-- users regardless of the caller's own row-level access.
--
-- The service-role key (used by the backend) bypasses RLS entirely by
-- Supabase design — these policies are the isolation boundary for the
-- frontend's anon/authenticated key and any other direct DB access, not the
-- backend's only safeguard. The backend's db module (backend/src/db) still
-- always scopes queries by an explicit organisationId/projectId parameter.

create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id from public.users where id = auth.uid()
$$;

-- organisations

alter table organisations enable row level security;

create policy organisations_isolated on organisations
  for all
  using (id = public.current_organisation_id())
  with check (id = public.current_organisation_id());

-- users, projects (direct organisation_id column)

alter table users enable row level security;

create policy users_isolated on users
  for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

alter table projects enable row level security;

create policy projects_isolated on projects
  for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

-- meetings, documents, and the six entity tables (scoped via project_id)

alter table meetings enable row level security;

create policy meetings_isolated on meetings
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = meetings.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = meetings.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );

alter table documents enable row level security;

create policy documents_isolated on documents
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = documents.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = documents.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );

alter table actions enable row level security;

create policy actions_isolated on actions
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = actions.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = actions.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );

alter table risks enable row level security;

create policy risks_isolated on risks
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = risks.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = risks.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );

alter table issues enable row level security;

create policy issues_isolated on issues
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = issues.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = issues.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );

alter table decisions enable row level security;

create policy decisions_isolated on decisions
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = decisions.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = decisions.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );

alter table dependencies enable row level security;

create policy dependencies_isolated on dependencies
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = dependencies.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = dependencies.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );

alter table change_signals enable row level security;

create policy change_signals_isolated on change_signals
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = change_signals.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = change_signals.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );
