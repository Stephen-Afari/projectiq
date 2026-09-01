/**
 * Idempotent Supabase Storage setup: creates the private `transcripts`
 * bucket used to store raw meeting transcript text (see
 * backend/src/services/transcriptStorage.ts and
 * docs/decision-log/2026-08-23-transcript-ingestion.md).
 *
 * Run: npm run setup:storage
 */
import { supabase } from '../src/db/client.js';

const BUCKET = 'transcripts';

async function setupStorage() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  if (buckets.some((b) => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" already exists.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['text/plain', 'text/markdown'],
  });
  if (createError) throw createError;

  console.log(`Bucket "${BUCKET}" created.`);
}

setupStorage().catch((err) => {
  console.error('Storage setup failed:', err);
  process.exit(1);
});
