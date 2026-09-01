import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';

/** Parses req.body against `schema`; 400s with a structured error on failure. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          message: 'Validation failed',
          details: result.error.flatten(),
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
