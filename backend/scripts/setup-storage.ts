/**
 * Idempotent Supabase Storage setup: creates the private buckets this app
 * needs — `transcripts` for raw meeting transcript text (see
 * backend/src/services/transcriptStorage.ts and
 * docs/decision-log/2026-08-23-transcript-ingestion.md), and `documents`
 * for uploaded project documents ahead of RAG ingestion (see
 * backend/src/services/documentStorage.ts and
 * docs/decision-log/2026-09-05-rag-document-ingestion.md).
 *
 * Run: npm run setup:storage
 */
import { supabase } from '../src/db/client.js';

interface BucketSpec {
  name: string;
  fileSizeLimit: string;
  allowedMimeTypes: string[];
}

const BUCKETS: BucketSpec[] = [
  {
    name: 'transcripts',
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['text/plain', 'text/markdown'],
  },
  {
    name: 'documents',
    fileSizeLimit: '20MB',
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'text/plain',
    ],
  },
];

async function setupStorage() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  for (const spec of BUCKETS) {
    if (buckets.some((b) => b.name === spec.name)) {
      console.log(`Bucket "${spec.name}" already exists.`);
      continue;
    }

    const { error: createError } = await supabase.storage.createBucket(spec.name, {
      public: false,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    });
    if (createError) throw createError;

    console.log(`Bucket "${spec.name}" created.`);
  }
}

setupStorage().catch((err) => {
  console.error('Storage setup failed:', err);
  process.exit(1);
});
