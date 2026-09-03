/**
 * ProjectIQ database module.
 *
 * Wraps the Supabase Postgres schema defined in supabase/migrations/ with
 * typed, per-table query helpers. Uses the service-role key (see client.ts)
 * which bypasses Row Level Security — every exported function here always
 * takes an explicit organisationId/projectId (or record id) and filters on
 * it, so callers can't accidentally issue an unscoped cross-tenant query
 * even though the DB itself wouldn't stop them.
 *
 * Six of these tables (actions, risks, issues, decisions, dependencies,
 * change_signals) are AI-extracted entity tables: every row starts with
 * approval_status = 'pending' and only moves to 'approved'/'rejected' via
 * the update*ApprovalStatus() functions, which record who approved it and
 * when (CLAUDE.md AI Rules — no consequential change without human
 * approval, always audited).
 */

export * from './types.js';

export * from './tables/organisations.js';
export * from './tables/users.js';
export * from './tables/projects.js';
export * from './tables/meetings.js';
export * from './tables/documents.js';
export * from './tables/actions.js';
export * from './tables/risks.js';
export * from './tables/issues.js';
export * from './tables/decisions.js';
export * from './tables/dependencies.js';
export * from './tables/changeSignals.js';
export * from './tables/agentRuns.js';
export * from './tables/weeklyReports.js';
export * from './tables/auditLog.js';
export * from './tables/projectChunks.js';
