import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { editDependencySchema } from '../schemas/dependencies.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { getDependencyById, updateDependencyApprovalStatus, updateDependencyFields } from '../db/index.js';

export const dependenciesRouter = Router();

dependenciesRouter.patch(
  '/:id',
  validateBody(patchApprovalStatusSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getDependencyById(id);
    if (!existing) throw new ApiError(404, 'Dependency not found');
    const { approval_status, approved_by } = req.body;
    const updated = await updateDependencyApprovalStatus(id, approval_status, approved_by);
    res.json(updated);
  }),
);

dependenciesRouter.patch(
  '/:id/edit',
  validateBody(editDependencySchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getDependencyById(id);
    if (!existing) throw new ApiError(404, 'Dependency not found');
    const updated = await updateDependencyFields(id, req.body);
    res.json(updated);
  }),
);
