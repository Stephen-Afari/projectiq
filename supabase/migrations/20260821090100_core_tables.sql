-- ProjectIQ: organisations, users, projects.
-- users.id references auth.users(id) so RLS can key off auth.uid() once
-- Supabase Auth is wired in a later phase; no login flow exists yet.

create table organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users (id),
  name text not null,
  email text not null unique,
  role user_role not null default 'contributor',
  organisation_id uuid not null references organisations (id),
  created_at timestamptz not null default now()
);

create index users_organisation_id_idx on users (organisation_id);

create table projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id),
  name text not null,
  description text,
  status project_status not null default 'planning',
  health project_health not null default 'green',
  start_date date,
  target_date date,
  created_at timestamptz not null default now()
);

create index projects_organisation_id_idx on projects (organisation_id);
