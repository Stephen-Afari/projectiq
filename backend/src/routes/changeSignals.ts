import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { editChangeSignalSchema } from '../schemas/changeSignals.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import {
  getChangeSignalById,
  updateChangeSignalApprovalStatus,
  updateChangeSignalFields,
} from '../db/index.js';

export const changeSignalsRouter = Router();

changeSignalsRouter.patch(
  '/:id',
  validateBody(patchApprovalStatusSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getChangeSignalById(id);
    if (!existing) throw new ApiError(404, 'Change signal not found');
    const { approval_status, approved_by } = req.body;
    const updated = await updateChangeSignalApprovalStatus(id, approval_status, approved_by);
    res.json(updated);
  }),
);

changeSignalsRouter.patch(
  '/:id/edit',
  validateBody(editChangeSignalSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getChangeSignalById(id);
    if (!existing) throw new ApiError(404, 'Change signal not found');
    const updated = await updateChangeSignalFields(id, req.body);
    res.json(updated);
  }),
);
