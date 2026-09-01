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
};
