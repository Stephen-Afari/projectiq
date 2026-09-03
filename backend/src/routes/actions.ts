import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createActionSchema, editActionSchema } from '../schemas/actions.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { assertProjectAccess } from '../lib/orgAccess.js';
import {
  createAction,
  createAuditLogEntry,
  getActionById,
  updateActionApprovalStatus,
  updateActionFields,
} from '../db/index.js';

export const actionsRouter = Router();

actionsRouter.post(
  '/',
  validateBody(createActionSchema),
  asyncHandler(async (req, res) => {
    await assertProjectAccess(req.body.project_id, req.user!.organisationId);
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
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateActionApprovalStatus(id, req.body.approval_status, {
      actorId: req.user!.id,
      organisationId: req.user!.organisationId,
      resourceType: 'actions',
      beforeState: existing,
    });
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
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateActionFields(id, req.body);
    await createAuditLogEntry({
      organisation_id: req.user!.organisationId,
      actor_id: req.user!.id,
      action: 'edit',
      resource_type: 'actions',
      resource_id: id,
      before_state: existing,
      after_state: updated,
    });
    res.json(updated);
  }),
);
