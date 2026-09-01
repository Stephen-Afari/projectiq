import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { ApiError } from '../lib/ApiError.js';

/**
 * Guards external webhook routes (currently POST /api/webhooks/n8n/meetings)
 * with a shared secret, per CLAUDE.md Security Rules: "All webhooks (n8n →
 * API, API → n8n) must verify a signature/secret." Express 4 auto-catches
 * synchronous throws from regular middleware, so this doesn't need
 * asyncHandler.
 */
export function verifyWebhookSecret(req: Request, _res: Response, next: NextFunction) {
  const provided = req.header('x-n8n-webhook-secret');
  if (!config.n8nWebhookSecret || !provided || provided !== config.n8nWebhookSecret) {
    throw new ApiError(401, 'Invalid or missing webhook secret');
  }
  next();
}
