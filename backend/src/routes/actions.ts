import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createActionSchema, editActionSchema } from '../schemas/actions.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { createAction, getActionById, updateActionApprovalStatus, updateActionFields } from '../db/index.js';

export const actionsRouter = Router();

actionsRouter.post(
  '/',
  validateBody(createActionSchema),
  asyncHandler(async (req, res) => {
    const action = await createAction(req.body);
    res.status(201).json(action);
  }),
);

actionsRouter.patch(
  '/:id',
  validateBody(patchApprovalStatusSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getActionById(id);
    if (!existing) throw new ApiError(404, 'Action not found');
    const { approval_status, approved_by } = req.body;
    const updated = await updateActionApprovalStatus(id, approval_status, approved_by);
    res.json(updated);
  }),
);

actionsRouter.patch(
  '/:id/edit',
  validateBody(editActionSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getActionById(id);
    if (!existing) throw new ApiError(404, 'Action not found');
    const updated = await updateActionFields(id, req.body);
    res.json(updated);
  }),
);
