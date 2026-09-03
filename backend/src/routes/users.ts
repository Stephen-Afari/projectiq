import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { listUsersByOrganisation } from '../db/index.js';

export const usersRouter = Router();

// Scoped to the caller's own organisation (req.user.organisationId, set
// by requireAuth) — previously an unscoped list of every user across
// every org; see docs/decision-log/2026-09-02-security-hardening.md.
usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listUsersByOrganisation(req.user!.organisationId));
  }),
);
