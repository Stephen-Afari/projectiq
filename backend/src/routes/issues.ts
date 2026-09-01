import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { editIssueSchema } from '../schemas/issues.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { getIssueById, updateIssueApprovalStatus, updateIssueFields } from '../db/index.js';

export const issuesRouter = Router();

issuesRouter.patch(
  '/:id',
  validateBody(patchApprovalStatusSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getIssueById(id);
    if (!existing) throw new ApiError(404, 'Issue not found');
    const { approval_status, approved_by } = req.body;
    const updated = await updateIssueApprovalStatus(id, approval_status, approved_by);
    res.json(updated);
  }),
);

issuesRouter.patch(
  '/:id/edit',
  validateBody(editIssueSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getIssueById(id);
    if (!existing) throw new ApiError(404, 'Issue not found');
    const updated = await updateIssueFields(id, req.body);
    res.json(updated);
  }),
);
