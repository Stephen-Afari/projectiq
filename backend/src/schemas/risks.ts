import { z } from 'zod';
import { confidenceTypeValues, requireAtLeastOneField } from './common.js';

export const riskLevelValues = ['low', 'medium', 'high'] as const;
export const riskSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export const riskStatusValues = ['open', 'mitigated', 'closed', 'accepted'] as const;

export const createRiskSchema = z.object({
  project_id: z.string().uuid(),
  meeting_id: z.string().uuid().optional(),
  description: z.string().min(1),
  probability: z.enum(riskLevelValues).optional(),
  impact: z.enum(riskLevelValues).optional(),
  severity: z.enum(riskSeverityValues).optional(),
  owner: z.string().optional(),
  mitigation: z.string().optional(),
  status: z.enum(riskStatusValues).optional(),
  source_excerpt: z.string().optional(),
  created_by_agent: z.string().optional(),
  confidence_type: z.enum(confidenceTypeValues).optional(),
});

export const editRiskSchema = requireAtLeastOneField(
  z.object({
    description: z.string().min(1).optional(),
    probability: z.enum(riskLevelValues).nullable().optional(),
    impact: z.enum(riskLevelValues).nullable().optional(),
    severity: z.enum(riskSeverityValues).nullable().optional(),
    owner: z.string().nullable().optional(),
    mitigation: z.string().nullable().optional(),
    status: z.enum(riskStatusValues).optional(),
    confidence_type: z.enum(confidenceTypeValues).optional(),
  }),
);
