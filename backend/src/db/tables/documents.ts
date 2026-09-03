import { insertRow, selectByColumn, selectById, updateRow } from '../queryTable.js';
import type { DocumentIngestionStatus, ProjectDocument } from '../types.js';

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
  mime_type?: string;
  size_bytes?: number;
  uploaded_by?: string;
}): Promise<ProjectDocument> {
  return insertRow<ProjectDocument>(TABLE, input);
}

export async function updateDocumentIngestionStatus(
  id: string,
  status: DocumentIngestionStatus,
  error?: string | null,
): Promise<ProjectDocument> {
  return updateRow<ProjectDocument>(TABLE, id, {
    ingestion_status: status,
    ingestion_error: error ?? null,
  });
}
