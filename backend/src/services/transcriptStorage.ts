import { supabase } from '../db/client.js';

const BUCKET = 'transcripts';

/**
 * Uploads raw transcript text to the private `transcripts` bucket at
 * `path` (convention: `<project_id>/<meeting_id>.txt`, set by the caller).
 * Backend-only — the frontend never talks to Supabase Storage directly,
 * only to POST /api/meetings.
 */
export async function uploadTranscript(path: string, text: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, text, {
    contentType: 'text/plain',
    upsert: true,
  });
  if (error) throw new Error(`[storage] uploadTranscript(${path}) failed: ${error.message}`);
}

/** Downloads and returns the raw transcript text stored at `path`. */
export async function downloadTranscript(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`[storage] downloadTranscript(${path}) failed: ${error.message}`);
  return data.text();
}
