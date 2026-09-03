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
const createMeetingWithTranscript = vi.fn();
vi.mock('../../src/services/meetingIngestion.js', () => ({
  createMeetingWithTranscript: (...a: unknown[]) => createMeetingWithTranscript(...a),
}));

const db = (await import('../../src/db/index.js')) as unknown as import('../helpers/dbMocks.js').DbMocks;
const { app } = await import('../../src/app.js');

const MEETING_A = {
  id: 'meeting-1',
  project_id: PROJECT_A.id,
  title: 'Kickoff',
  meeting_date: '2026-02-01',
};
const MEETING_B = { ...MEETING_A, id: 'meeting-2', project_id: PROJECT_B.id };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/meetings', () => {
  it('400s when required fields are missing', async () => {
    const res = await request(app).post('/api/meetings').send({});
    expect(res.status).toBe(400);
    expect(createMeetingWithTranscript).not.toHaveBeenCalled();
  });

  it('400s on an invalid meeting_date format', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .send({ project_id: PROJECT_A.id, title: 'X', meeting_date: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('creates a meeting when the project belongs to the caller\'s org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_A);
    createMeetingWithTranscript.mockResolvedValue(MEETING_A);
    const res = await request(app)
      .post('/api/meetings')
      .send({ project_id: PROJECT_A.id, title: 'Kickoff', meeting_date: '2026-02-01' });
    expect(res.status).toBe(201);
    expect(createMeetingWithTranscript).toHaveBeenCalledTimes(1);
  });

  it('404s (org-scoped) when the project belongs to a different org', async () => {
    db.getProjectById.mockResolvedValue(PROJECT_B);
    const res = await request(app)
      .post('/api/meetings')
      .send({ project_id: PROJECT_B.id, title: 'Kickoff', meeting_date: '2026-02-01' });
    expect(res.status).toBe(404);
    expect(createMeetingWithTranscript).not.toHaveBeenCalled();
  });
});

describe('GET /api/meetings/:id — org isolation', () => {
  it('returns the meeting when its project belongs to the caller\'s org', async () => {
    db.getMeetingById.mockResolvedValue(MEETING_A);
    db.getProjectById.mockResolvedValue(PROJECT_A);
    const res = await request(app).get(`/api/meetings/${MEETING_A.id}`);
    expect(res.status).toBe(200);
  });

  it('404s when the meeting\'s project belongs to a different org', async () => {
    db.getMeetingById.mockResolvedValue(MEETING_B);
    db.getProjectById.mockResolvedValue(PROJECT_B);
    const res = await request(app).get(`/api/meetings/${MEETING_B.id}`);
    expect(res.status).toBe(404);
  });

  it('404s when the meeting does not exist', async () => {
    db.getMeetingById.mockResolvedValue(null);
    const res = await request(app).get('/api/meetings/nonexistent');
    expect(res.status).toBe(404);
  });
});
