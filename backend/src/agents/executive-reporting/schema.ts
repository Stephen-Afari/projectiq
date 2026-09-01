import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { confidenceTypeSchema } from '../shared/confidence.js';

/**
 * Structured-output contract for the Executive Reporting Agent. Every
 * summary line is individually confidence-typed — a sponsor reading the
 * report must be able to tell a plain restatement of data (fact) from the
 * agent's own judgement (inference) from a suggested next step
 * (recommendation), same guardrail as every other agent, applied to
 * narrative text instead of extracted entities.
 */

export const weeklyReportItemSchema = z.object({
  text: z.string().min(1),
  confidence_type: confidenceTypeSchema,
});

export const weeklyReportResultSchema = z.object({
  status_narrative: z.array(weeklyReportItemSchema).min(1),
  key_risks: z.array(weeklyReportItemSchema),
  decisions_needed: z.array(weeklyReportItemSchema),
  escalations: z.array(weeklyReportItemSchema),
  management_attention_items: z.array(weeklyReportItemSchema),
});

export type WeeklyReportItem = z.infer<typeof weeklyReportItemSchema>;
export type WeeklyReportResult = z.infer<typeof weeklyReportResultSchema>;

export const weeklyReportJsonSchema = zodToJsonSchema(weeklyReportResultSchema) as Record<
  string,
  unknown
>;
