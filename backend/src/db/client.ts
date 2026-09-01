import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Privileged Supabase client, authenticated with the service-role key.
 * Backend-only — never import this module from `frontend/`. The
 * service-role key bypasses Row Level Security entirely, so every function
 * built on top of this client (see db/tables/*.ts) must explicitly filter
 * by organisation_id/project_id itself; RLS is not a safety net here.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
