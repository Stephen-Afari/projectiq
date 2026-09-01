import rateLimit from 'express-rate-limit';

/**
 * Scoped to the external-facing webhooks router only (not applied
 * globally — the frontend's existing unauthenticated routes don't need
 * it). 30 requests / 5 minutes per IP: generous for a legitimate
 * integration, tight enough to blunt secret-guessing or abuse.
 */
export const webhookRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests. Try again later.' } },
});
