import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './ApiError.js';
import { requireId } from './requireId.js';
import { getProjectById } from '../db/index.js';
import type { Project } from '../db/types.js';

/**
 * The actual authorization boundary for this app (see CLAUDE.md Security
 * Rules — the backend always uses the service-role key, which bypasses
 * RLS entirely, so RLS is defense-in-depth, not the enforcement point).
 * 404s (not 403) when the project belongs to a different organisation —
 * indistinguishable from "doesn't exist" so a caller can't use this to
 * enumerate other orgs' project ids.
 */
export async function assertProjectAccess(
  projectId: string,
  organisationId: string,
): Promise<Project> {
  const project = await getProjectById(projectId);
  if (!project || project.organisation_id !== organisationId) {
    throw new ApiError(404, 'Project not found');
  }
  return project;
}

/**
 * Express middleware for projects.ts's /:id/* sub-routes: loads the
 * project, enforces org ownership, and attaches it to req.project so each
 * handler doesn't re-fetch it. Extracted because ~10 sub-routes in that
 * file all need exactly this same "fetch + org-check" step.
 */
export async function loadProjectInOrg(req: Request, _res: Response, next: NextFunction) {
  try {
    const id = requireId(req.params.id);
    const project = await assertProjectAccess(id, req.user!.organisationId);
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
}

declare global {
  namespace Express {
    interface Request {
      project?: Project;
    }
  }
}
