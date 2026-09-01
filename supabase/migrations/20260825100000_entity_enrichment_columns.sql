-- ProjectIQ: enrichment columns written by the Context Analyst and Impact
-- Analyst agents (see docs/decision-log/2026-08-25-context-and-impact-agents.md).
-- Both are nullable JSONB — AI-derived annotation data, not yet a
-- first-class normalized entity. Added only on the tables each agent
-- actually targets, not blanket-added everywhere:
--   context_flags: actions, risks, decisions (Context Analyst's scope)
--   impact_assessment: risks, dependencies, change_signals (Impact
--     Analyst's scope, "especially risks, dependencies, change signals")
-- risks gets both columns; issues gets neither.

alter table actions add column context_flags jsonb;
alter table decisions add column context_flags jsonb;

alter table risks add column context_flags jsonb;
alter table risks add column impact_assessment jsonb;

alter table dependencies add column impact_assessment jsonb;
alter table change_signals add column impact_assessment jsonb;
