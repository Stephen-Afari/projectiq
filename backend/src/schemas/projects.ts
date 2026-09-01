import { z } from 'zod';

export const projectStatusValues = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
] as const;
export const projectHealthValues = ['green', 'amber', 'red'] as const;

export const createProjectSchema = z.object({
  organisation_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(projectStatusValues).optional(),
  health: z.enum(projectHealthValues).optional(),
  start_date: z.string().date().optional(),
  target_date: z.string().date().optional(),
});
