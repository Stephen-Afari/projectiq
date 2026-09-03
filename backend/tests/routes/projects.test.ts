import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import {
  TEST_USER,
  PROJECT_A,
  PROJECT_B,
  FIXTURE_ACTIONS,
  FIXTURE_RISKS,
  FIXTURE_DECISIONS,
  FIXTURE_ISSUES,
  FIXTURE_DEPENDENCIES,
  FIXTURE_CHANGE_SIGNALS,
} from '../fixtures.js';

// Self-contained factories (no reference to outer-scope consts) so they're
// safe under vi.mock's hoist-to-top-of-file behavior — see
// tests/helpers/dbMocks.ts for why.
vi.mock('../../src/db/index.js', async () => {
  const { createDbMocks } = await import('../helpers/dbMocks.js');
  return createDbMocks();
});
vi.mock('../../src/middleware/requireAuth.js', async () => {
  const { TEST_USER } = await import('../fixtures.js');
  return {
    requireAuth: (req: any, _res: any, next: any) => {
      req.user = TEST_USER;
      next();
    },
  };
});

const db = (await import('../../src/db/index.js')) as unknown as import('../helpers/dbMocks.js').DbMocks;
const { app } = await import('../../src/app.js');

beforeEach(() => {
  vi.clearAllMocks();
  db.listMeetingsByProject.mockResolvedValue([]);
});

describe('GET /api/projects', () => {
  it('401s with no Authorization header handling is covered by requireAuth.test.ts; here confirm org-scoping', async () => {
    db.listProjectsByOrganisation.mockResolvedValue([PROJECT_A]);
    const res = await request(app).get('/api/projects').set('Authorization', 'Bearer any');
    expect(res.status).toBe(200);
    expect(db.listProjectsByOrganisation).toHaveBeenCalledWith(TEST_USER.organisationId);
    expect(res.body).toEqual([PROJECT_A]);
  });
});

describe('POST /api/projects', () => {
  it('400s with validation details when name is missing', async () => {
    const res = await request(app).post('/api/projects').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details).toBeDefined();
    expect(db.createProject).not.toHaveBeenCalled();
  });

  it('always creates the project in the caller\'s own org, ignoring any client-supplied organisation_id', async () => {
    db.createProject.mockResolvedValue({ ...PROJECT_A, id: 'new-project' });
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'New Project', organisation_id: 'someone-elses-org' });
    expect(res.status).toBe(201);
    const createArg = db.createProject.mock.calls[0]?.[0];
    expect(createArg.organisation_id).toBe(TEST_USER.organisationId);
  });
});

describe('GET /api/projects/:id — org isolation', () => {
  it('returns the project when it belongs to the caller\'s org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_A);
    const res = await request(app).get(`/api/projects/${PROJECT_A.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(PROJECT_A.id);
  });

  it('404s (not 403) when the project belongs to a different org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_B); // organisation_id !== TEST_USER.organisationId
    const res = await request(app).get(`/api/projects/${PROJECT_B.id}`);
    expect(res.status).toBe(404);
  });

  it('404s when the project does not exist at all', async () => {
    db.getProjectById.mockResolvedValue(null);
    const res = await request(app).get('/api/projects/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/projects/:id/dashboard — aggregation over a known fixture', () => {
  beforeEach(() => {
    db.getProjectById.mockResolvedValue(PROJECT_A);
    db.listActionsByProject.mockResolvedValue(FIXTURE_ACTIONS);
    db.listRisksByProject.mockResolvedValue(FIXTURE_RISKS);
    db.listDecisionsByProject.mockResolvedValue(FIXTURE_DECISIONS);
    db.listIssuesByProject.mockResolvedValue(FIXTURE_ISSUES);
    db.listDependenciesByProject.mockResolvedValue(FIXTURE_DEPENDENCIES);
    db.listChangeSignalsByProject.mockResolvedValue(FIXTURE_CHANGE_SIGNALS);
  });

  it('counts only approved rows — matches the known fixture exactly', async () => {
    const res = await request(app).get(`/api/projects/${PROJECT_A.id}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({
      actions: 2, // 2 approved of 3 (1 pending excluded)
      risks: 2, // 2 approved of 3 (1 pending excluded)
      issues: 1,
      decisions: 1, // only the approved decision
      dependencies: 1,
      change_signals: 1,
    });
  });

  it('excludes the pending action from overdue_actions even though its due_date is in the past', async () => {
    const res = await request(app).get(`/api/projects/${PROJECT_A.id}/dashboard`);
    expect(res.body.overdue_actions).toHaveLength(1);
    expect(res.body.overdue_actions[0].id).toBe('action-1-approved-overdue-open');
  });

  it('decisions_needing_attention is the deliberate pending-only exception', async () => {
    const res = await request(app).get(`/api/projects/${PROJECT_A.id}/dashboard`);
    expect(res.body.decisions_needing_attention).toHaveLength(1);
    expect(res.body.decisions_needing_attention[0].id).toBe('decision-1-pending');
  });

  it('top_risks only includes approved risks, sorted by severity', async () => {
    const res = await request(app).get(`/api/projects/${PROJECT_A.id}/dashboard`);
    const ids = res.body.top_risks.map((r: { id: string }) => r.id);
    expect(ids).toEqual(['risk-1-approved-critical', 'risk-2-approved-worsened']);
  });

  it('demonstrates the approval gate end to end: approving the pending decision changes the dashboard', async () => {
    const before = await request(app).get(`/api/projects/${PROJECT_A.id}/dashboard`);
    expect(before.body.counts.decisions).toBe(1);
    expect(before.body.decisions_needing_attention).toHaveLength(1);

    // Simulate the pending decision having been approved.
    const approvedFixture = FIXTURE_DECISIONS.map((d) =>
      d.id === 'decision-1-pending' ? { ...d, approval_status: 'approved' as const } : d,
    );
    db.listDecisionsByProject.mockResolvedValue(approvedFixture);

    const after = await request(app).get(`/api/projects/${PROJECT_A.id}/dashboard`);
    expect(after.body.counts.decisions).toBe(2); // now both decisions count
    expect(after.body.decisions_needing_attention).toHaveLength(0); // nothing pending left
  });

  it('no meetings yet → new_since_last_meeting.since is null and all counts are 0', async () => {
    const res = await request(app).get(`/api/projects/${PROJECT_A.id}/dashboard`);
    expect(res.body.new_since_last_meeting).toEqual({ since: null, actions: 0, risks: 0, decisions: 0, issues: 0 });
  });

  it('404s the dashboard for a project in a different org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_B);
    const res = await request(app).get(`/api/projects/${PROJECT_B.id}/dashboard`);
    expect(res.status).toBe(404);
  });
});
