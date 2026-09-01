import { z } from 'zod';
import { confidenceTypeValues, requireAtLeastOneField } from './common.js';

export const createDecisionSchema = z.object({
  project_id: z.string().uuid(),
  meeting_id: z.string().uuid().optional(),
  decision: z.string().min(1),
  decision_owner: z.string().optional(),
  decision_date: z.string().date().optional(),
  impact: z.string().optional(),
  source_excerpt: z.string().optional(),
  created_by_agent: z.string().optional(),
  confidence_type: z.enum(confidenceTypeValues).optional(),
});

export const editDecisionSchema = requireAtLeastOneField(
  z.object({
    decision: z.string().min(1).optional(),
    decision_owner: z.string().nullable().optional(),
    decision_date: z.string().date().nullable().optional(),
    impact: z.string().nullable().optional(),
    confidence_type: z.enum(confidenceTypeValues).optional(),
  }),
);
