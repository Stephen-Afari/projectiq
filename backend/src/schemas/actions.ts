import { z } from 'zod';
import { confidenceTypeValues, requireAtLeastOneField } from './common.js';

export const actionPriorityValues = ['low', 'medium', 'high', 'critical'] as const;
export const actionStatusValues = ['open', 'in_progress', 'done', 'cancelled'] as const;

export const createActionSchema = z.object({
  project_id: z.string().uuid(),
  meeting_id: z.string().uuid().optional(),
  description: z.string().min(1),
  owner: z.string().optional(),
  due_date: z.string().date().optional(),
  priority: z.enum(actionPriorityValues).optional(),
  status: z.enum(actionStatusValues).optional(),
  source_excerpt: z.string().optional(),
  created_by_agent: z.string().optional(),
  confidence_type: z.enum(confidenceTypeValues).optional(),
});

export const editActionSchema = requireAtLeastOneField(
  z.object({
    description: z.string().min(1).optional(),
    owner: z.string().nullable().optional(),
    due_date: z.string().date().nullable().optional(),
    priority: z.enum(actionPriorityValues).optional(),
    status: z.enum(actionStatusValues).optional(),
    confidence_type: z.enum(confidenceTypeValues).optional(),
  }),
);
