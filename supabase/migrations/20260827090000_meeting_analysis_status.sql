-- ProjectIQ: meeting analysis status, for idempotent POST /api/ai/analyse-meeting
-- and n8n's "mark meeting as needing attention" failure path. See
-- docs/decision-log/2026-08-27-n8n-meeting-analysis-workflow.md.

create type meeting_analysis_status as enum ('pending', 'completed', 'failed');

alter table meetings add column analysis_status meeting_analysis_status not null default 'pending';
alter table meetings add column analysis_error text;
