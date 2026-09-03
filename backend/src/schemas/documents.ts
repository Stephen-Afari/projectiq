import { z } from 'zod';

/**
 * Suggested categories from the task's own list — document_type stays
 * free text at the schema/DB level (matches the existing column), this
 * is just what the frontend's dropdown offers.
 */
export const documentTypeValues = [
  'charter',
  'plan',
  'raid_register',
  'meeting_minutes',
  'requirements',
  'contract',
  'sop',
  'change_request',
  'status_report',
  'budget',
  'other',
] as const;

/**
 * Validates the multipart *text* fields of POST /api/documents — the
 * file itself is handled by multer (req.file), not by this schema.
 */
export const uploadDocumentSchema = z.object({
  project_id: z.string().uuid(),
  document_type: z.string().min(1).max(100).optional(),
});
