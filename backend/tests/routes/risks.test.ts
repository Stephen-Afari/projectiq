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

const RISK_A = {
  id: 'risk-1',
  project_id: PROJECT_A.id,
  description: 'Vendor delay risk',
  approval_status: 'pending',
  severity: 'medium',
  previous_severity: null,
};
const RISK_B = { ...RISK_A, id: 'risk-2', project_id: PROJECT_B.id };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/risks', () => {
  it('400s when description is missing', async () => {
    const res = await request(app).post('/api/risks').send({ project_id: PROJECT_A.id });
    expect(res.status).toBe(400);
    expect(db.createRisk).not.toHaveBeenCalled();
  });

  it('creates the risk when the project is in the caller\'s org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.createRisk.mockResolvedValue(RISK_A);
    const res = await request(app)
      .post('/api/risks')
      .send({ project_id: PROJECT_A.id, description: 'Vendor delay risk' });
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/risks/:id — approval', () => {
  it('404s (IDOR guard) across orgs', async () => {
    db.getRiskById.mockResolvedValue(RISK_B);
    db.getProjectById.mockResolvedValue(PROJECT_B);
    const res = await request(app).patch(`/api/risks/${RISK_B.id}`).send({ approval_status: 'approved' });
    expect(res.status).toBe(404);
    expect(db.updateRiskApprovalStatus).not.toHaveBeenCalled();
  });

  it('approves with approved_by from the session', async () => {
    db.getRiskById.mockResolvedValue(RISK_A);
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.updateRiskApprovalStatus.mockResolvedValue({ ...RISK_A, approval_status: 'approved' });
    const res = await request(app).patch(`/api/risks/${RISK_A.id}`).send({ approval_status: 'approved' });
    expect(res.status).toBe(200);
    const context = db.updateRiskApprovalStatus.mock.calls[0]?.[2];
    expect(context.actorId).toBe(TEST_USER.id);
  });
});

describe('PATCH /api/risks/:id/edit — severity-worsening baseline', () => {
  it('sets previous_severity when the edit raises severity', async () => {
    db.getRiskById.mockResolvedValue({ ...RISK_A, severity: 'medium', previous_severity: null });
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.updateRiskFields.mockResolvedValue({ ...RISK_A, severity: 'high', previous_severity: 'medium' });

    const res = await request(app).patch(`/api/risks/${RISK_A.id}/edit`).send({ severity: 'high' });

    expect(res.status).toBe(200);
    const patchArg = db.updateRiskFields.mock.calls[0]?.[1];
    expect(patchArg.previous_severity).toBe('medium');
    expect(patchArg.severity_changed_at).toBeTruthy();
  });

  it('clears previous_severity when the edit does not worsen severity', async () => {
    db.getRiskById.mockResolvedValue({ ...RISK_A, severity: 'critical', previous_severity: 'high' });
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.updateRiskFields.mockResolvedValue({ ...RISK_A, severity: 'medium', previous_severity: null });

    const res = await request(app).patch(`/api/risks/${RISK_A.id}/edit`).send({ severity: 'medium' });

    expect(res.status).toBe(200);
    const patchArg = db.updateRiskFields.mock.calls[0]?.[1];
    expect(patchArg.previous_severity).toBeNull();
    expect(patchArg.severity_changed_at).toBeNull();
  });

  it('400s on an empty edit body', async () => {
    const res = await request(app).patch(`/api/risks/${RISK_A.id}/edit`).send({});
    expect(res.status).toBe(400);
  });
});
