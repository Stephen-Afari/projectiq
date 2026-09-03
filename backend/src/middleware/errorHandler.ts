import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ApiError } from '../lib/ApiError.js';

/** Final Express error middleware — every response follows { error: { message, details? } }. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
    return;
  }
  // A file exceeding the multer size limit (or another upload-shape
  // problem) is caller error, not a server fault — 400, not 500.
  if (err instanceof MulterError) {
    res.status(400).json({ error: { message: `Upload error: ${err.message}` } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
}
