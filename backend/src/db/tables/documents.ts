import { insertRow, selectByColumn, selectById } from '../queryTable.js';
import type { ProjectDocument } from '../types.js';

const TABLE = 'documents';

export async function listDocumentsByProject(projectId: string): Promise<ProjectDocument[]> {
  return selectByColumn<ProjectDocument>(TABLE, 'project_id', projectId);
}

export async function getDocumentById(id: string): Promise<ProjectDocument | null> {
  return selectById<ProjectDocument>(TABLE, id);
}

export async function createDocument(input: {
  project_id: string;
  filename: string;
  document_type?: string;
  storage_url?: string;
}): Promise<ProjectDocument> {
  return insertRow<ProjectDocument>(TABLE, input);
}
