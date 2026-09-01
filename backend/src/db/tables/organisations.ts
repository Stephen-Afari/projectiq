import { insertRow, selectByColumn, selectById } from '../queryTable.js';
import type { Organisation } from '../types.js';

const TABLE = 'organisations';

export async function getOrganisationById(id: string): Promise<Organisation | null> {
  return selectById<Organisation>(TABLE, id);
}

export async function getOrganisationByName(name: string): Promise<Organisation | null> {
  const matches = await selectByColumn<Organisation>(TABLE, 'name', name);
  return matches[0] ?? null;
}

export async function createOrganisation(input: { name: string }): Promise<Organisation> {
  return insertRow<Organisation>(TABLE, input);
}
