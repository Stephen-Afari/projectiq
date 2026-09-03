import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createRiskSchema, editRiskSchema } from '../schemas/risks.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { assertProjectAccess } from '../lib/orgAccess.js';
import {
  createAuditLogEntry,
  createRisk,
  getRiskById,
  updateRiskApprovalStatus,
  updateRiskFields,
} from '../db/index.js';
import type { RiskSeverity } from '../db/index.js';

export const risksRouter = Router();

const SEVERITY_RANK: Record<RiskSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

risksRouter.post(
  '/',
  validateBody(createRiskSchema),
  asyncHandler(async (req, res) => {
    await assertProjectAccess(req.body.project_id, req.user!.organisationId);
    const risk = await createRisk(req.body);
    res.status(201).json(risk);
  }),
);

risksRouter.patch(
  '/:id',
  validateBody(patchApprovalStatusSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getRiskById(id);
    if (!existing) throw new ApiError(404, 'Risk not found');
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const updated = await updateRiskApprovalStatus(id, req.body.approval_status, {
      actorId: req.user!.id,
      organisationId: req.user!.organisationId,
      resourceType: 'risks',
      beforeState: existing,
    });
    res.json(updated);
  }),
);

risksRouter.patch(
  '/:id/edit',
  validateBody(editRiskSchema),
  asyncHandler(async (req, res) => {
    const id = requireId(req.params.id);
    const existing = await getRiskById(id);
    if (!existing) throw new ApiError(404, 'Risk not found');
    await assertProjectAccess(existing.project_id, req.user!.organisationId);

    const patch = { ...req.body };
    const newSeverity: RiskSeverity | undefined = req.body.severity;
    // Records a worsening baseline for the Project Alerts workflow — only
    // when this edit actually makes severity worse than it was. Cleared
    // implicitly the next time severity is edited to something not worse.
    if (
      newSeverity &&
      existing.severity &&
      SEVERITY_RANK[newSeverity] > SEVERITY_RANK[existing.severity]
    ) {
      patch.previous_severity = existing.severity;
      patch.severity_changed_at = new Date().toISOString();
    } else if (newSeverity && (!existing.severity || SEVERITY_RANK[newSeverity] <= SEVERITY_RANK[existing.severity])) {
      patch.previous_severity = null;
      patch.severity_changed_at = null;
    }

    const updated = await updateRiskFields(id, patch);
    await createAuditLogEntry({
      organisation_id: req.user!.organisationId,
      actor_id: req.user!.id,
      action: 'edit',
      resource_type: 'risks',
      resource_id: id,
      before_state: existing,
      after_state: updated,
    });
    res.json(updated);
  }),
);
