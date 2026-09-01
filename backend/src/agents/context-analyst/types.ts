import type { z } from 'zod';
import type {
  extractedActionSchema,
  extractedDecisionSchema,
  extractedRiskSchema,
} from '../meeting-analyst/schema.js';

export type ExtractedActionWithRef = z.infer<typeof extractedActionSchema> & { ref: string };
export type ExtractedRiskWithRef = z.infer<typeof extractedRiskSchema> & { ref: string };
export type ExtractedDecisionWithRef = z.infer<typeof extractedDecisionSchema> & { ref: string };
