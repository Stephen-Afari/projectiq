import { z } from 'zod';

export const projectStatusValues = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
] as const;
export const projectHealthValues = ['green', 'amber', 'red'] as const;

// organisation_id is NOT accepted here — it's always the authenticated
// caller's own org (req.user.organisationId), never client input, so a
// caller can't create a project inside another organisation.
export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(projectStatusValues).optional(),
  health: z.enum(projectHealthValues).optional(),
  start_date: z.string().date().optional(),
  target_date: z.string().date().optional(),
});
