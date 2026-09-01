import { z } from 'zod';
import { confidenceTypeValues, requireAtLeastOneField } from './common.js';

export const changeSignalTypeValues = ['scope', 'schedule', 'cost', 'resource', 'requirement'] as const;
export const changeSignalStatusValues = ['open', 'acknowledged', 'resolved'] as const;

export const editChangeSignalSchema = requireAtLeastOneField(
  z.object({
    change_type: z.enum(changeSignalTypeValues).optional(),
    description: z.string().min(1).optional(),
    potential_impact: z.string().nullable().optional(),
    status: z.enum(changeSignalStatusValues).optional(),
    confidence_type: z.enum(confidenceTypeValues).optional(),
  }),
);
