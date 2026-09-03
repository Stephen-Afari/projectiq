-- ProjectIQ: document ingestion status, mirroring meetings.analysis_status
-- exactly (20260827090000_meeting_analysis_status.sql) — same idempotent-
-- pipeline-status pattern, now for the upload -> extract -> chunk -> embed
-- pipeline. See docs/decision-log/2026-09-05-rag-document-ingestion.md.

create type document_ingestion_status as enum ('pending', 'processing', 'completed', 'failed');

alter table documents add column ingestion_status document_ingestion_status not null default 'pending';
alter table documents add column ingestion_error text;
alter table documents add column mime_type text;
alter table documents add column size_bytes bigint;
alter table documents add column uploaded_by uuid references users (id);
