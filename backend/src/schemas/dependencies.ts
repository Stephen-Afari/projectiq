import { z } from 'zod';
import { confidenceTypeValues, requireAtLeastOneField } from './common.js';

export const dependencyStatusValues = ['planned', 'in_progress', 'blocked', 'complete'] as const;

export const editDependencySchema = requireAtLeastOneField(
  z.object({
    description: z.string().min(1).optional(),
    upstream_activity: z.string().nullable().optional(),
    downstream_activity: z.string().nullable().optional(),
    owner: z.string().nullable().optional(),
    status: z.enum(dependencyStatusValues).optional(),
    confidence_type: z.enum(confidenceTypeValues).optional(),
  }),
);
