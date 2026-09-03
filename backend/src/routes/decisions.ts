import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createDecisionSchema, editDecisionSchema } from '../schemas/decisions.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { assertProjectAccess } from '../lib/orgAccess.js';
import {
  createAuditLogEntry,
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
    await assertProjectAccess(req.body.project_id, req.user!.organisationId);
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
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateDecisionApprovalStatus(id, req.body.approval_status, {
      actorId: req.user!.id,
      organisationId: req.user!.organisationId,
      resourceType: 'decisions',
      beforeState: existing,
    });
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
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateDecisionFields(id, req.body);
    await createAuditLogEntry({
      organisation_id: req.user!.organisationId,
      actor_id: req.user!.id,
      action: 'edit',
      resource_type: 'decisions',
      resource_id: id,
      before_state: existing,
      after_state: updated,
    });
    res.json(updated);
  }),
);
