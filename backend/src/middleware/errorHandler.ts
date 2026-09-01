import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/ApiError.js';

/** Final Express error middleware — every response follows { error: { message, details? } }. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
}
