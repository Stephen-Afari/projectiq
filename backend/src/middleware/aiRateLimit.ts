import rateLimit from 'express-rate-limit';

/**
 * Tighter limit specific to /api/ai/* — every call here costs a real
 * Claude API request, so the DoS/cost exposure is higher than a plain DB
 * read. Keyed by the authenticated caller (req.user.id, set by
 * requireAuth, which runs before this on the route chain) rather than IP,
 * so it's a genuine per-user budget, not something a shared office IP
 * would trip for everyone at once.
 */
export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
  message: { error: { message: 'Too many AI requests. Try again later.' } },
});
