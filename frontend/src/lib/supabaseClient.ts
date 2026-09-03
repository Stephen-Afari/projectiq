import { createClient } from '@supabase/supabase-js';

/**
 * Anon-key client for auth only (sign in/out, session tracking) — per
 * CLAUDE.md Security Rules ("frontend uses the anon key + RLS"). The
 * frontend never queries application tables directly with this client;
 * all data access still goes through the Express API (lib/api.ts), which
 * verifies the session's JWT server-side. See
 * docs/decision-log/2026-09-02-security-hardening.md.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);
