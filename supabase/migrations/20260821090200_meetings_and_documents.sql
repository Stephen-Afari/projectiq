-- ProjectIQ: meetings and documents, both scoped to a project.

create table meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  title text not null,
  meeting_date date not null,
  source text,
  transcript_reference text,
  summary text,
  created_at timestamptz not null default now()
);

create index meetings_project_id_idx on meetings (project_id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  filename text not null,
  document_type text,
  storage_url text,
  created_at timestamptz not null default now()
);

create index documents_project_id_idx on documents (project_id);
