/**
 * Attached by requireAuth (backend/src/middleware/requireAuth.ts) after
 * verifying the caller's Supabase Auth JWT and looking up their
 * public.users row. Every authenticated route reads organisationId from
 * here, never from client-supplied input — see backend/src/lib/orgAccess.ts.
 */
export interface AuthenticatedUser {
  id: string;
  organisationId: string;
  role: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
