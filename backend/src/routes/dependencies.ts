import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { editDependencySchema } from '../schemas/dependencies.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { assertProjectAccess } from '../lib/orgAccess.js';
import {
  createAuditLogEntry,
  getDependencyById,
  updateDependencyApprovalStatus,
  updateDependencyFields,
} from '../db/index.js';

export const dependenciesRouter = Router();

dependenciesRouter.patch(
  '/:id',
  validateBody(patchApprovalStatusSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getDependencyById(id);
    if (!existing) throw new ApiError(404, 'Dependency not found');
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateDependencyApprovalStatus(id, req.body.approval_status, {
      actorId: req.user!.id,
      organisationId: req.user!.organisationId,
      resourceType: 'dependencies',
      beforeState: existing,
    });
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
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateDependencyFields(id, req.body);
    await createAuditLogEntry({
      organisation_id: req.user!.organisationId,
      actor_id: req.user!.id,
      action: 'edit',
      resource_type: 'dependencies',
      resource_id: id,
      before_state: existing,
      after_state: updated,
    });
    res.json(updated);
  }),
);
