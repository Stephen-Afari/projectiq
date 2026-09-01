import { insertRow, selectAll, selectByColumn, selectById } from '../queryTable.js';
import type { User, UserRole } from '../types.js';

const TABLE = 'users';

// Unscoped — same rationale as listAllProjects: no auth/org session on the
// frontend yet to filter by. Revisit once Phase 3 Auth ships a real session.
export async function listAllUsers(): Promise<User[]> {
  return selectAll<User>(TABLE);
}

export async function listUsersByOrganisation(organisationId: string): Promise<User[]> {
  return selectByColumn<User>(TABLE, 'organisation_id', organisationId);
}

export async function getUserById(id: string): Promise<User | null> {
  return selectById<User>(TABLE, id);
}

export async function createUser(input: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organisation_id: string;
}): Promise<User> {
  return insertRow<User>(TABLE, input);
}
