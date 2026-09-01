import type { z } from 'zod';
import type { extractedChangeSignalSchema, extractedDependencySchema, extractedRiskSchema } from '../meeting-analyst/schema.js';
import type { ContextFlags } from '../../db/types.js';

// Risks are enriched with context_flags before Impact Analyst runs (see
// pipeline.ts) — extra grounding for the impact assessment.
export type RiskForImpact = z.infer<typeof extractedRiskSchema> & {
  ref: string;
  context_flags: ContextFlags | null;
};
export type DependencyForImpact = z.infer<typeof extractedDependencySchema> & { ref: string };
export type ChangeSignalForImpact = z.infer<typeof extractedChangeSignalSchema> & { ref: string };
