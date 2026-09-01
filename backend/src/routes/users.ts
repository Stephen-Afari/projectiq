import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { listAllUsers } from '../db/index.js';

export const usersRouter = Router();

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listAllUsers());
  }),
);
