import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../db/client.js';
import { getUserById } from '../db/index.js';
import { ApiError } from '../lib/ApiError.js';

/**
 * Verifies the caller's Supabase Auth session and attaches req.user.
 * Applied to every router except health (liveness, must stay open) and
 * webhooks (n8n uses its own shared-secret auth, not a user session — see
 * middleware/verifyWebhookSecret.ts). 401 if the bearer token is missing
 * or invalid; 403 if the Supabase Auth account has no matching
 * public.users row (an org membership must exist — see db/tables/users.ts,
 * seeded via backend/scripts/seed.ts).
 *
 * Uses the service-role client to verify the token: supabase.auth.getUser
 * calls Supabase's Auth API to validate the JWT regardless of which key
 * the client instance itself was constructed with; this is not a DB query
 * and doesn't touch RLS.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      throw new ApiError(401, 'Missing bearer token');
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new ApiError(401, 'Invalid or expired session');
    }

    const appUser = await getUserById(data.user.id);
    if (!appUser) {
      throw new ApiError(403, 'No ProjectIQ organisation membership for this account');
    }

    req.user = {
      id: appUser.id,
      organisationId: appUser.organisation_id,
      role: appUser.role,
      email: appUser.email,
    };
    next();
  } catch (err) {
    next(err);
  }
}
