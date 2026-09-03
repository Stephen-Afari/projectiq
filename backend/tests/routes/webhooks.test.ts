import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const createMeetingWithTranscript = vi.fn();
const getMeetingById = vi.fn();
const updateMeetingAnalysisStatus = vi.fn();

vi.mock('../../src/services/meetingIngestion.js', () => ({
  createMeetingWithTranscript: (...a: unknown[]) => createMeetingWithTranscript(...a),
}));
vi.mock('../../src/db/index.js', () => ({
  getMeetingById: (...a: unknown[]) => getMeetingById(...a),
  updateMeetingAnalysisStatus: (...a: unknown[]) => updateMeetingAnalysisStatus(...a),
}));

const { webhooksRouter } = await import('../../src/routes/webhooks.js');
const { errorHandler } = await import('../../src/middleware/errorHandler.js');
const { config } = await import('../../src/config.js');

const app = express();
app.use(express.json());
app.use('/api/webhooks', webhooksRouter);
app.use(errorHandler);

const VALID_BODY = {
  project_id: '11111111-1111-1111-1111-111111111111',
  title: 'Steering Committee',
  meeting_date: '2026-02-01',
  transcript: 'Some real transcript content here.',
};

beforeEach(() => {
  createMeetingWithTranscript.mockReset();
  getMeetingById.mockReset();
  updateMeetingAnalysisStatus.mockReset();
});

describe('POST /api/webhooks/n8n/meetings — webhook auth', () => {
  it('rejects a request with no secret header at all', async () => {
    const res = await request(app).post('/api/webhooks/n8n/meetings').send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(createMeetingWithTranscript).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong secret', async () => {
    const res = await request(app)
      .post('/api/webhooks/n8n/meetings')
      .set('X-N8N-Webhook-Secret', 'wrong-secret')
      .send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(createMeetingWithTranscript).not.toHaveBeenCalled();
  });

  it('accepts a request with the correct secret and a valid body', async () => {
    createMeetingWithTranscript.mockResolvedValue({ id: 'meeting-1', ...VALID_BODY });
    const res = await request(app)
      .post('/api/webhooks/n8n/meetings')
      .set('X-N8N-Webhook-Secret', config.n8nWebhookSecret)
      .send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(createMeetingWithTranscript).toHaveBeenCalledTimes(1);
  });

  it('400s on an invalid body even with the correct secret (validation runs after auth)', async () => {
    const res = await request(app)
      .post('/api/webhooks/n8n/meetings')
      .set('X-N8N-Webhook-Secret', config.n8nWebhookSecret)
      .send({ title: 'Missing project_id and transcript' });
    expect(res.status).toBe(400);
    expect(createMeetingWithTranscript).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/webhooks/n8n/meetings/:id/analysis-status — webhook auth', () => {
  it('rejects with a bad secret', async () => {
    const res = await request(app)
      .patch('/api/webhooks/n8n/meetings/meeting-1/analysis-status')
      .set('X-N8N-Webhook-Secret', 'wrong')
      .send({ status: 'failed', error: 'boom' });
    expect(res.status).toBe(401);
    expect(updateMeetingAnalysisStatus).not.toHaveBeenCalled();
  });

  it('accepts with the correct secret', async () => {
    getMeetingById.mockResolvedValue({ id: 'meeting-1', analysis_status: 'pending' });
    updateMeetingAnalysisStatus.mockResolvedValue({ id: 'meeting-1', analysis_status: 'failed' });
    const res = await request(app)
      .patch('/api/webhooks/n8n/meetings/meeting-1/analysis-status')
      .set('X-N8N-Webhook-Secret', config.n8nWebhookSecret)
      .send({ status: 'failed', error: 'boom' });
    expect(res.status).toBe(200);
    expect(updateMeetingAnalysisStatus).toHaveBeenCalledWith('meeting-1', 'failed', 'boom');
  });
});
