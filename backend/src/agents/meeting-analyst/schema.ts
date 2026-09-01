import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { confidenceTypeSchema } from '../shared/confidence.js';

/**
 * Structured-output contract for the Meeting Analyst agent. This is the
 * single source of truth: the JSON Schema handed to Claude's tool-use (see
 * ../../services/llm) is derived from this zod schema, and the same zod
 * schema re-validates whatever the model returns — so the "shape Claude is
 * told to produce" and "shape we accept" can never drift apart.
 *
 * Every extracted item carries confidence_type (fact/inference/
 * recommendation) and source_text (a transcript excerpt) — the FACT/
 * INFERENCE/RECOMMENDATION guardrail and traceability requirement from
 * CLAUDE.md AI Rules, enforced structurally rather than left to prose.
 */

const isoDateOrNull = z
  .string()
  .nullable()
  .optional()
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Must be an ISO date (YYYY-MM-DD) or null',
  });

export const extractedActionSchema = z.object({
  description: z.string().min(1),
  owner: z.string().nullable().optional(),
  due_date: isoDateOrNull,
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  source_text: z.string().min(1),
  confidence_type: confidenceTypeSchema,
});

export const extractedRiskSchema = z.object({
  description: z.string().min(1),
  probability: z.enum(['low', 'medium', 'high']).nullable().optional(),
  impact: z.enum(['low', 'medium', 'high']).nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  owner: z.string().nullable().optional(),
  mitigation: z.string().nullable().optional(),
  source_text: z.string().min(1),
  confidence_type: confidenceTypeSchema,
});

export const extractedIssueSchema = z.object({
  description: z.string().min(1),
  owner: z.string().nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  source_text: z.string().min(1),
  confidence_type: confidenceTypeSchema,
});

export const extractedDecisionSchema = z.object({
  decision: z.string().min(1),
  decision_owner: z.string().nullable().optional(),
  decision_date: isoDateOrNull,
  impact: z.string().nullable().optional(),
  source_text: z.string().min(1),
  confidence_type: confidenceTypeSchema,
});

export const extractedDependencySchema = z.object({
  description: z.string().min(1),
  upstream_activity: z.string().nullable().optional(),
  downstream_activity: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  source_text: z.string().min(1),
  confidence_type: confidenceTypeSchema,
});

export const extractedChangeSignalSchema = z.object({
  change_type: z.enum(['scope', 'schedule', 'cost', 'resource', 'requirement']),
  description: z.string().min(1),
  potential_impact: z.string().nullable().optional(),
  source_text: z.string().min(1),
  confidence_type: confidenceTypeSchema,
});

export const meetingAnalysisSchema = z.object({
  summary: z.string().min(1),
  actions: z.array(extractedActionSchema),
  risks: z.array(extractedRiskSchema),
  issues: z.array(extractedIssueSchema),
  decisions: z.array(extractedDecisionSchema),
  dependencies: z.array(extractedDependencySchema),
  change_signals: z.array(extractedChangeSignalSchema),
});

export type MeetingAnalysisResult = z.infer<typeof meetingAnalysisSchema>;

// No `name` option — without it zodToJsonSchema returns the schema object
// directly (no $ref/definitions wrapper), which is what Anthropic's tool
// input_schema needs: a flat JSON Schema object.
export const meetingAnalysisJsonSchema = zodToJsonSchema(meetingAnalysisSchema) as Record<
  string,
  unknown
>;
