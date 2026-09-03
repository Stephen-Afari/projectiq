import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { editChangeSignalSchema } from '../schemas/changeSignals.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { assertProjectAccess } from '../lib/orgAccess.js';
import {
  createAuditLogEntry,
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
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateChangeSignalApprovalStatus(id, req.body.approval_status, {
      actorId: req.user!.id,
      organisationId: req.user!.organisationId,
      resourceType: 'change_signals',
      beforeState: existing,
    });
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
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateChangeSignalFields(id, req.body);
    await createAuditLogEntry({
      organisation_id: req.user!.organisationId,
      actor_id: req.user!.id,
      action: 'edit',
      resource_type: 'change_signals',
      resource_id: id,
      before_state: existing,
      after_state: updated,
    });
    res.json(updated);
  }),
);
