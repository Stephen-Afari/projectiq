import rateLimit from 'express-rate-limit';

/**
 * General ceiling for all /api traffic (webhooks additionally carry their
 * own tighter limiter — see webhookRateLimit.ts, layered on top of this
 * one, not a replacement for it). 300 requests / 15 minutes per IP:
 * generous for normal interactive use, bounded against abuse/DoS now that
 * every route is reachable by anyone who can authenticate (or, before
 * this phase, by anyone at all).
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests. Try again later.' } },
});
