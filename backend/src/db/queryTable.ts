import { supabase } from './client.js';
import { emitApprovalEvent } from '../services/approvalEvents.js';
import { createAuditLogEntry } from './tables/auditLog.js';

/**
 * Thin, typed wrapper around the repeated select/insert/update pattern used
 * by every table module in db/tables/*.ts. Every table's queries are always
 * scoped by an explicit filter column (project_id or organisation_id) —
 * callers of the table modules can't accidentally issue an unscoped query.
 */
export async function selectByColumn<T>(
  table: string,
  column: string,
  value: string,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq(column, value);
  if (error) throw new Error(`[db] ${table}.selectByColumn(${column}) failed: ${error.message}`);
  return (data ?? []) as T[];
}

export async function selectAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`[db] ${table}.selectAll failed: ${error.message}`);
  return (data ?? []) as T[];
}

export async function selectById<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`[db] ${table}.selectById failed: ${error.message}`);
  return data as T | null;
}

export async function insertRow<T>(table: string, input: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(input).select().single();
  if (error) throw new Error(`[db] ${table}.insertRow failed: ${error.message}`);
  return data as T;
}

/** Bulk variant of insertRow — one round trip for N rows (e.g. a document's chunks). */
export async function insertRows<T>(table: string, inputs: Record<string, unknown>[]): Promise<T[]> {
  if (inputs.length === 0) return [];
  const { data, error } = await supabase.from(table).insert(inputs).select();
  if (error) throw new Error(`[db] ${table}.insertRows failed: ${error.message}`);
  return (data ?? []) as T[];
}

/**
 * Calls a Postgres function via PostgREST's RPC endpoint — needed for
 * queries the fluent .from()/.select() builder can't express, e.g.
 * pgvector's `<=>` similarity ordering (see match_project_chunks).
 */
export async function callRpc<T>(fn: string, params: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(`[db] rpc.${fn} failed: ${error.message}`);
  return (data ?? []) as T[];
}

export async function updateRow<T>(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  if (error) throw new Error(`[db] ${table}.updateRow failed: ${error.message}`);
  return data as T;
}

export interface ApprovalAuditContext {
  actorId: string;
  organisationId: string;
  resourceType: string;
  beforeState: unknown;
}

/**
 * Shared approval-transition helper for the six AI-extracted entity tables.
 * Per CLAUDE.md AI Rules, this is the only sanctioned way those tables move
 * out of 'pending'. `approved_by` is always the verified session actor
 * (context.actorId) — never client-supplied, since routes now derive it
 * from requireAuth's req.user, not request body input. Writes one
 * audit_log row per call (before/after state) — the single funnel point
 * for all six entities' approve/reject actions, so audit coverage can't
 * be forgotten per-route.
 */
export async function updateApprovalStatus<T>(
  table: string,
  id: string,
  status: 'approved' | 'rejected',
  context: ApprovalAuditContext,
): Promise<T> {
  const updated = await updateRow<T>(table, id, {
    approval_status: status,
    approved_by: context.actorId,
    approved_at: new Date().toISOString(),
  });

  await createAuditLogEntry({
    organisation_id: context.organisationId,
    actor_id: context.actorId,
    action: status,
    resource_type: context.resourceType,
    resource_id: id,
    before_state: context.beforeState,
    after_state: updated,
  });

  // Fires only for 'approved' — never 'pending' (unreachable via this
  // function) or 'rejected'. Best-effort; never blocks/fails this call.
  if (status === 'approved') {
    await emitApprovalEvent(table, updated);
  }

  return updated;
}
