import { describe, it, expect, vi, beforeEach } from 'vitest';

const emitApprovalEvent = vi.fn().mockResolvedValue(undefined);
const createAuditLogEntry = vi.fn().mockResolvedValue({ id: 'audit-1' });

// updateRow (the sibling helper updateApprovalStatus calls) talks to
// Supabase via supabase.from(table).update(patch).eq('id', id).select().single()
// — a minimal fake chain is enough, no real Supabase client involved.
const FAKE_UPDATED_ROW = { id: 'action-1', approval_status: 'approved', approved_by: 'actor-1' };
const single = vi.fn().mockResolvedValue({ data: FAKE_UPDATED_ROW, error: null });
const select = vi.fn(() => ({ single }));
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));

vi.mock('../../src/db/client.js', () => ({ supabase: { from: (...args: unknown[]) => from(...args) } }));
vi.mock('../../src/services/approvalEvents.js', () => ({
  emitApprovalEvent: (...args: unknown[]) => emitApprovalEvent(...args),
}));
vi.mock('../../src/db/tables/auditLog.js', () => ({
  createAuditLogEntry: (...args: unknown[]) => createAuditLogEntry(...args),
}));

const { updateApprovalStatus } = await import('../../src/db/queryTable.js');

const CONTEXT = {
  actorId: 'actor-1',
  organisationId: 'org-1',
  resourceType: 'actions',
  beforeState: { id: 'action-1', approval_status: 'pending' },
};

beforeEach(() => {
  emitApprovalEvent.mockClear();
  createAuditLogEntry.mockClear();
  single.mockClear();
});

describe('updateApprovalStatus — the approval-gate security property', () => {
  it('fires the downstream automation event when status is "approved"', async () => {
    await updateApprovalStatus('actions', 'action-1', 'approved', CONTEXT);
    expect(emitApprovalEvent).toHaveBeenCalledTimes(1);
    expect(emitApprovalEvent).toHaveBeenCalledWith('actions', FAKE_UPDATED_ROW);
  });

  it('NEVER fires the downstream automation event when status is "rejected"', async () => {
    await updateApprovalStatus('actions', 'action-1', 'rejected', CONTEXT);
    expect(emitApprovalEvent).not.toHaveBeenCalled();
  });

  it('writes exactly one audit_log row per call, with correct actor/org/before/after state', async () => {
    await updateApprovalStatus('actions', 'action-1', 'approved', CONTEXT);
    expect(createAuditLogEntry).toHaveBeenCalledTimes(1);
    expect(createAuditLogEntry).toHaveBeenCalledWith({
      organisation_id: 'org-1',
      actor_id: 'actor-1',
      action: 'approved',
      resource_type: 'actions',
      resource_id: 'action-1',
      before_state: CONTEXT.beforeState,
      after_state: FAKE_UPDATED_ROW,
    });
  });

  it('always sets approved_by to the session actor, never anything else', async () => {
    await updateApprovalStatus('actions', 'action-1', 'approved', CONTEXT);
    const patchArg = update.mock.calls.at(-1)?.[0];
    expect(patchArg.approved_by).toBe('actor-1');
  });
});
