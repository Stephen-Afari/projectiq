import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createMeetingSchema } from '../schemas/meetings.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { assertProjectAccess } from '../lib/orgAccess.js';
import {
  getMeetingById,
  listActionsByMeeting,
  listRisksByMeeting,
  listIssuesByMeeting,
  listDecisionsByMeeting,
  listDependenciesByMeeting,
  listChangeSignalsByMeeting,
} from '../db/index.js';
import { createMeetingWithTranscript } from '../services/meetingIngestion.js';

export const meetingsRouter = Router();

meetingsRouter.post(
  '/',
  validateBody(createMeetingSchema),
  asyncHandler(async (req, res) => {
    await assertProjectAccess(req.body.project_id, req.user!.organisationId);
    const meeting = await createMeetingWithTranscript(req.body);
    res.status(201).json(meeting);
  }),
);

meetingsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const meeting = await getMeetingById(id);
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    await assertProjectAccess(meeting.project_id, req.user!.organisationId);
    res.json(meeting);
  }),
);

meetingsRouter.get(
  '/:id/results',
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const meeting = await getMeetingById(id);
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    await assertProjectAccess(meeting.project_id, req.user!.organisationId);

    const [actions, risks, issues, decisions, dependencies, changeSignals] = await Promise.all([
      listActionsByMeeting(id),
      listRisksByMeeting(id),
      listIssuesByMeeting(id),
      listDecisionsByMeeting(id),
      listDependenciesByMeeting(id),
      listChangeSignalsByMeeting(id),
    ]);

    res.json({
      meeting,
      actions,
      risks,
      issues,
      decisions,
      dependencies,
      change_signals: changeSignals,
    });
  }),
);
