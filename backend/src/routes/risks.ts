import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { createRiskSchema, editRiskSchema } from '../schemas/risks.js';
import { patchApprovalStatusSchema } from '../schemas/common.js';
import { ApiError } from '../lib/ApiError.js';
import { requireId } from '../lib/requireId.js';
import { createRisk, getRiskById, updateRiskApprovalStatus, updateRiskFields } from '../db/index.js';
import type { RiskSeverity } from '../db/index.js';

export const risksRouter = Router();

const SEVERITY_RANK: Record<RiskSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

risksRouter.post(
  '/',
  validateBody(createRiskSchema),
  asyncHandler(async (req, res) => {
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
    const { approval_status, approved_by } = req.body;
    const updated = await updateRiskApprovalStatus(id, approval_status, approved_by);
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
    res.json(updated);
  }),
);
