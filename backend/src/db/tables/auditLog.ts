import { supabase } from '../client.js';
import type { AuditLog } from '../types.js';

const TABLE = 'audit_log';

// Uses `supabase` directly rather than queryTable.ts's insertRow, so this
// module has no dependency on queryTable.ts — queryTable.ts's own
// updateApprovalStatus calls createAuditLogEntry, and a cycle between the
// two would exist otherwise.
export async function createAuditLogEntry(input: {
  organisation_id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before_state?: unknown;
  after_state?: unknown;
}): Promise<AuditLog> {
  const { data, error } = await supabase.from(TABLE).insert(input).select().single();
  if (error) throw new Error(`[db] ${TABLE}.createAuditLogEntry failed: ${error.message}`);
  return data as AuditLog;
}
