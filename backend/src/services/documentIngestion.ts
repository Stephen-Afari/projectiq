import { config } from '../config.js';
import { ApiError } from '../lib/ApiError.js';
import {
  createDocument,
  createProjectChunks,
  updateDocumentIngestionStatus,
} from '../db/index.js';
import type { ProjectDocument } from '../db/types.js';
import { uploadDocument } from './documentStorage.js';
import { extractText } from './textExtraction.js';
import { chunkSections } from './chunking.js';
import { embeddingClient } from './embeddings/index.js';

/**
 * Uploads a document and runs the full ingestion pipeline (extract ->
 * chunk -> embed -> store) synchronously in one call — same convention
 * as POST /api/ai/analyse-meeting's 3-agent pipeline, no job queue in
 * this MVP. The document row is created before any of the
 * extract/chunk/embed steps run, so a mid-pipeline failure still leaves
 * a `failed`-status row with an error message rather than nothing at
 * all (same "no cross-store transaction" tradeoff already accepted for
 * meetings — see meetingIngestion.ts).
 */
export async function ingestDocument(input: {
  project_id: string;
  filename: string;
  document_type?: string;
  buffer: Buffer;
  mime_type: string;
  uploaded_by: string;
}): Promise<{ document: ProjectDocument; chunkCount: number }> {
  const document = await createDocument({
    project_id: input.project_id,
    filename: input.filename,
    document_type: input.document_type,
    mime_type: input.mime_type,
    size_bytes: input.buffer.length,
    uploaded_by: input.uploaded_by,
  });

  try {
    const path = `${input.project_id}/${document.id}/${input.filename}`;
    await uploadDocument(path, input.buffer, input.mime_type);
    await updateDocumentIngestionStatus(document.id, 'processing');

    const sections = await extractText(input.buffer, input.filename);
    const chunks = chunkSections(sections, config.chunkSize, config.chunkOverlap);

    if (chunks.length === 0) {
      throw new Error('No extractable text found in this document');
    }

    const vectors = await embeddingClient.embedTexts(chunks.map((c) => c.content));

    await createProjectChunks(
      chunks.map((chunk, i) => ({
        project_id: input.project_id,
        document_id: document.id,
        chunk_index: i,
        content: chunk.content,
        section: chunk.section,
        embedding: vectors[i]!,
      })),
    );

    const updated = await updateDocumentIngestionStatus(document.id, 'completed');
    return { document: updated, chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateDocumentIngestionStatus(document.id, 'failed', message);
    throw new ApiError(502, `Document uploaded but ingestion failed: ${message}`);
  }
}
