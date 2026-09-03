import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { TEST_USER, PROJECT_A, PROJECT_B } from '../fixtures.js';

vi.mock('../../src/db/index.js', async () => {
  const { createDbMocks } = await import('../helpers/dbMocks.js');
  return createDbMocks();
});
vi.mock('../../src/middleware/requireAuth.js', async () => {
  const { TEST_USER } = await import('../fixtures.js');
  return { requireAuth: (req: any, _res: any, next: any) => { req.user = TEST_USER; next(); } };
});

const db = (await import('../../src/db/index.js')) as unknown as import('../helpers/dbMocks.js').DbMocks;
const { app } = await import('../../src/app.js');

const ACTION_A = {
  id: 'action-1',
  project_id: PROJECT_A.id,
  description: 'Do the thing',
  approval_status: 'pending',
  owner: null,
  due_date: null,
  priority: 'medium',
  status: 'open',
};
const ACTION_B = { ...ACTION_A, id: 'action-2', project_id: PROJECT_B.id };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/actions', () => {
  it('400s when description is missing', async () => {
    const res = await request(app).post('/api/actions').send({ project_id: PROJECT_A.id });
    expect(res.status).toBe(400);
    expect(db.createAction).not.toHaveBeenCalled();
  });

  it('creates the action when the target project is in the caller\'s org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.createAction.mockResolvedValue(ACTION_A);
    const res = await request(app)
      .post('/api/actions')
      .send({ project_id: PROJECT_A.id, description: 'Do the thing' });
    expect(res.status).toBe(201);
  });

  it('404s when the target project belongs to a different org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_B);
    const res = await request(app)
      .post('/api/actions')
      .send({ project_id: PROJECT_B.id, description: 'Do the thing' });
    expect(res.status).toBe(404);
    expect(db.createAction).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/actions/:id — approval, session-derived actor', () => {
  it('approves and derives approved_by from the session, ignoring any client-supplied value', async () => {
    db.getActionById.mockResolvedValue(ACTION_A);
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.updateActionApprovalStatus.mockResolvedValue({ ...ACTION_A, approval_status: 'approved' });

    const res = await request(app)
      .patch(`/api/actions/${ACTION_A.id}`)
      .send({ approval_status: 'approved', approved_by: 'attacker-supplied-id' });

    expect(res.status).toBe(200);
    const [, , context] = db.updateActionApprovalStatus.mock.calls[0]!;
    expect(context.actorId).toBe(TEST_USER.id);
    expect(context.actorId).not.toBe('attacker-supplied-id');
  });

  it('rejects with a valid approval_status value', async () => {
    db.getActionById.mockResolvedValue(ACTION_A);
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.updateActionApprovalStatus.mockResolvedValue({ ...ACTION_A, approval_status: 'rejected' });
    const res = await request(app).patch(`/api/actions/${ACTION_A.id}`).send({ approval_status: 'rejected' });
    expect(res.status).toBe(200);
    expect(res.body.approval_status).toBe('rejected');
  });

  it('400s on an invalid approval_status value', async () => {
    const res = await request(app).patch(`/api/actions/${ACTION_A.id}`).send({ approval_status: 'maybe' });
    expect(res.status).toBe(400);
    expect(db.updateActionApprovalStatus).not.toHaveBeenCalled();
  });

  it('404s when the action does not exist', async () => {
    db.getActionById.mockResolvedValue(null);
    const res = await request(app).patch('/api/actions/nonexistent').send({ approval_status: 'approved' });
    expect(res.status).toBe(404);
  });

  it('404s (IDOR guard) when the action belongs to a project in a different org', async () => {
    db.getActionById.mockResolvedValue(ACTION_B);
    db.getProjectById.mockResolvedValue(PROJECT_B);
    const res = await request(app).patch(`/api/actions/${ACTION_B.id}`).send({ approval_status: 'approved' });
    expect(res.status).toBe(404);
    expect(db.updateActionApprovalStatus).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/actions/:id/edit', () => {
  it('400s on an empty patch body', async () => {
    db.getActionById.mockResolvedValue(ACTION_A);
    db.getProjectById.mockResolvedValue(PROJECT_A);
    const res = await request(app).patch(`/api/actions/${ACTION_A.id}/edit`).send({});
    expect(res.status).toBe(400);
    expect(db.updateActionFields).not.toHaveBeenCalled();
  });

  it('edits and writes an audit_log row', async () => {
    db.getActionById.mockResolvedValue(ACTION_A);
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.updateActionFields.mockResolvedValue({ ...ACTION_A, owner: 'Alice' });
    const res = await request(app).patch(`/api/actions/${ACTION_A.id}/edit`).send({ owner: 'Alice' });
    expect(res.status).toBe(200);
    expect(db.createAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'edit', resource_type: 'actions', resource_id: ACTION_A.id }),
    );
  });
});
