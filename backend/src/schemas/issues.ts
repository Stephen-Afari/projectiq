import { z } from 'zod';
import { confidenceTypeValues, requireAtLeastOneField } from './common.js';

export const issueSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export const issueStatusValues = ['open', 'investigating', 'resolved', 'closed'] as const;

export const createIssueSchema = z.object({
  project_id: z.string().uuid(),
  meeting_id: z.string().uuid().optional(),
  description: z.string().min(1),
  owner: z.string().optional(),
  severity: z.enum(issueSeverityValues).optional(),
  status: z.enum(issueStatusValues).optional(),
  resolution: z.string().optional(),
  source_excerpt: z.string().optional(),
  created_by_agent: z.string().optional(),
  confidence_type: z.enum(confidenceTypeValues).optional(),
});

export const editIssueSchema = requireAtLeastOneField(
  z.object({
    description: z.string().min(1).optional(),
    owner: z.string().nullable().optional(),
    severity: z.enum(issueSeverityValues).nullable().optional(),
    status: z.enum(issueStatusValues).optional(),
    resolution: z.string().nullable().optional(),
    confidence_type: z.enum(confidenceTypeValues).optional(),
  }),
);
