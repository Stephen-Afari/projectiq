-- ProjectIQ: weekly_reports — persisted output of the Executive Reporting
-- Agent (Agent 4), one row per generated report. report_json holds the
-- full structured, confidence-typed agent output; status_summary is a
-- short plain-text rendering (joined status_narrative) for email/quick
-- display without re-parsing JSON. See
-- docs/decision-log/2026-08-30-executive-reporting-agent-weekly-report.md.

create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  week_start timestamptz not null,
  week_end timestamptz not null,
  status_summary text not null,
  report_json jsonb not null,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create index weekly_reports_project_id_idx on weekly_reports (project_id);

alter table weekly_reports enable row level security;

create policy weekly_reports_isolated on weekly_reports
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = weekly_reports.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = weekly_reports.project_id
        and p.organisation_id = public.current_organisation_id()
    )
  );
