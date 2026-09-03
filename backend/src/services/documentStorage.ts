import { supabase } from '../db/client.js';

const BUCKET = 'documents';

/**
 * Uploads a document's raw bytes to the private `documents` bucket at
 * `path` (convention: `<project_id>/<document_id>/<original_filename>`,
 * set by the caller — mirrors `transcripts/<project_id>/<meeting_id>.txt`
 * in transcriptStorage.ts). Backend-only — the frontend never talks to
 * Supabase Storage directly, only to POST /api/documents.
 */
export async function uploadDocument(path: string, buffer: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`[storage] uploadDocument(${path}) failed: ${error.message}`);
}
