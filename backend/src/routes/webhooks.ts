import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { verifyWebhookSecret } from '../middleware/verifyWebhookSecret.js';
import { webhookRateLimit } from '../middleware/webhookRateLimit.js';
import { markAnalysisStatusSchema, n8nMeetingIngestionSchema } from '../schemas/webhooks.js';
import { createMeetingWithTranscript } from '../services/meetingIngestion.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { getMeetingById, updateMeetingAnalysisStatus } from '../db/index.js';

export const webhooksRouter = Router();

webhooksRouter.post(
  '/n8n/meetings',
  webhookRateLimit,
  verifyWebhookSecret,
  validateBody(n8nMeetingIngestionSchema),
  asyncHandler(async (req, res) => {
    const { transcript, ...meetingFields } = req.body;
    const meeting = await createMeetingWithTranscript({
      ...meetingFields,
      transcript_text: transcript,
    });
    res.status(201).json(meeting);
  }),
);

webhooksRouter.patch(
  '/n8n/meetings/:id/analysis-status',
  webhookRateLimit,
  verifyWebhookSecret,
  validateBody(markAnalysisStatusSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getMeetingById(id);
    if (!existing) throw new ApiError(404, 'Meeting not found');
    const { status, error } = req.body;
    const updated = await updateMeetingAnalysisStatus(id, status, error);
    res.json(updated);
  }),
);
