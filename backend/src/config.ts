import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Always load the monorepo root .env, regardless of process.cwd() — npm
// workspace scripts (e.g. `npm run seed --workspace=backend`) run with cwd
// set to backend/, where `dotenv/config`'s default lookup would miss it.
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.PORT ?? 3001),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET ?? '',
  // Optional: if unset, approval-event emission is skipped silently (no
  // n8n dependency required for the rest of the app to function).
  n8nApprovalWebhookUrl: process.env.N8N_APPROVAL_WEBHOOK_URL ?? '',
  // Used only to construct the "link back to the project" in alert
  // notifications — no project-detail page exists in the frontend yet,
  // so this points at the intended future URL, not a live page today.
  frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173',
  seedDemoPassword: process.env.SEED_DEMO_PASSWORD ?? 'ProjectIQ-Demo-2026!',
  // Single place that configures which LLM provider/model agents use — see
  // backend/src/services/llm/. 'anthropic' is the only implemented
  // provider today; 'openrouter' is a placeholder for a future dev-time
  // swap, per CLAUDE.md Tech Stack.
  llmProvider: (process.env.LLM_PROVIDER ?? 'anthropic') as 'anthropic' | 'openrouter',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
  // Single place that configures which embedding provider the document
  // ingestion pipeline uses — see backend/src/services/embeddings/.
  // 'local' (Xenova/transformers.js, runs in-process, no API key/cost) is
  // the only implemented provider today; a hosted provider (OpenAI/Voyage)
  // can be added behind the same interface later if quality/scale needs it.
  embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? 'local') as 'local',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2',
  // Character-based sliding window (backend/src/services/chunking.ts) —
  // not token-based, to avoid a tokenizer dependency for a first pass.
  chunkSize: Number(process.env.CHUNK_SIZE ?? 1000),
  chunkOverlap: Number(process.env.CHUNK_OVERLAP ?? 150),
  maxDocumentSizeBytes: Number(process.env.MAX_DOCUMENT_SIZE_BYTES ?? 20 * 1024 * 1024),
  // How many chunks the Project Assistant's retriever pulls per question
  // (backend/src/services/retrieval.ts) and the minimum cosine similarity
  // a chunk must clear to be considered relevant at all — top-k nearest
  // neighbor alone always returns k results even when nothing is
  // actually relevant; the threshold is what makes "the documents don't
  // cover this" a real, distinguishable outcome.
  retrievalTopK: Number(process.env.RETRIEVAL_TOP_K ?? 8),
  retrievalMinSimilarity: Number(process.env.RETRIEVAL_MIN_SIMILARITY ?? 0.3),
};
