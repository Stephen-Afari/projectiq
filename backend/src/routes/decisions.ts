import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createDecisionSchema, editDecisionSchema } from '../schemas/decisions.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import {
  createDecision,
  getDecisionById,
  updateDecisionApprovalStatus,
  updateDecisionFields,
} from '../db/index.js';

export const decisionsRouter = Router();

decisionsRouter.post(
  '/',
  validateBody(createDecisionSchema),
  asyncHandler(async (req, res) => {
    const decision = await createDecision(req.body);
    res.status(201).json(decision);
  }),
);

decisionsRouter.patch(
  '/:id',
  validateBody(patchApprovalStatusSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getDecisionById(id);
    if (!existing) throw new ApiError(404, 'Decision not found');
    const { approval_status, approved_by } = req.body;
    const updated = await updateDecisionApprovalStatus(id, approval_status, approved_by);
    res.json(updated);
  }),
);

decisionsRouter.patch(
  '/:id/edit',
  validateBody(editDecisionSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getDecisionById(id);
    if (!existing) throw new ApiError(404, 'Decision not found');
    const updated = await updateDecisionFields(id, req.body);
    res.json(updated);
  }),
);
