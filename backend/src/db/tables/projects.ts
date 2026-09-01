import { insertRow, selectAll, selectByColumn, selectById } from '../queryTable.js';
import type { Project, ProjectHealth, ProjectStatus } from '../types.js';

const TABLE = 'projects';

// Unscoped — there's no auth/org session on the frontend yet to filter by.
// Revisit once Phase 3 Auth ships a real session (then this should become
// listProjectsByOrganisation using the caller's org, or stay admin-only).
export async function listAllProjects(): Promise<Project[]> {
  return selectAll<Project>(TABLE);
}

export async function listProjectsByOrganisation(organisationId: string): Promise<Project[]> {
  return selectByColumn<Project>(TABLE, 'organisation_id', organisationId);
}

export async function getProjectById(id: string): Promise<Project | null> {
  return selectById<Project>(TABLE, id);
}

export async function createProject(input: {
  organisation_id: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  health?: ProjectHealth;
  start_date?: string;
  target_date?: string;
}): Promise<Project> {
  return insertRow<Project>(TABLE, input);
}
