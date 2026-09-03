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

const DECISION_A = {
  id: 'decision-1',
  project_id: PROJECT_A.id,
  decision: 'Adopt phased go-live',
  approval_status: 'pending',
};
const DECISION_B = { ...DECISION_A, id: 'decision-2', project_id: PROJECT_B.id };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/decisions', () => {
  it('400s when the decision text is missing', async () => {
    const res = await request(app).post('/api/decisions').send({ project_id: PROJECT_A.id });
    expect(res.status).toBe(400);
    expect(db.createDecision).not.toHaveBeenCalled();
  });

  it('creates the decision when the project is in the caller\'s org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.createDecision.mockResolvedValue(DECISION_A);
    const res = await request(app)
      .post('/api/decisions')
      .send({ project_id: PROJECT_A.id, decision: 'Adopt phased go-live' });
    expect(res.status).toBe(201);
  });

  it('404s when the project belongs to a different org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_B);
    const res = await request(app)
      .post('/api/decisions')
      .send({ project_id: PROJECT_B.id, decision: 'Adopt phased go-live' });
    expect(res.status).toBe(404);
    expect(db.createDecision).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/decisions/:id — approval gate', () => {
  it('approves with approved_by derived from the session', async () => {
    db.getDecisionById.mockResolvedValue(DECISION_A);
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.updateDecisionApprovalStatus.mockResolvedValue({ ...DECISION_A, approval_status: 'approved' });

    const res = await request(app)
      .patch(`/api/decisions/${DECISION_A.id}`)
      .send({ approval_status: 'approved', approved_by: 'attacker-id' });

    expect(res.status).toBe(200);
    const context = db.updateDecisionApprovalStatus.mock.calls[0]?.[2];
    expect(context.actorId).toBe(TEST_USER.id);
  });

  it('404s (IDOR guard) across orgs', async () => {
    db.getDecisionById.mockResolvedValue(DECISION_B);
    db.getProjectById.mockResolvedValue(PROJECT_B);
    const res = await request(app).patch(`/api/decisions/${DECISION_B.id}`).send({ approval_status: 'approved' });
    expect(res.status).toBe(404);
    expect(db.updateDecisionApprovalStatus).not.toHaveBeenCalled();
  });

  it('400s on an invalid approval_status', async () => {
    const res = await request(app).patch(`/api/decisions/${DECISION_A.id}`).send({ approval_status: 'sure' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/decisions/:id/edit', () => {
  it('400s on an empty body', async () => {
    const res = await request(app).patch(`/api/decisions/${DECISION_A.id}/edit`).send({});
    expect(res.status).toBe(400);
  });

  it('edits and writes an audit_log row', async () => {
    db.getDecisionById.mockResolvedValue(DECISION_A);
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.updateDecisionFields.mockResolvedValue({ ...DECISION_A, impact: 'Delays go-live by 6 weeks' });

    const res = await request(app)
      .patch(`/api/decisions/${DECISION_A.id}/edit`)
      .send({ impact: 'Delays go-live by 6 weeks' });

    expect(res.status).toBe(200);
    expect(db.createAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'edit', resource_type: 'decisions', resource_id: DECISION_A.id }),
    );
  });
});
