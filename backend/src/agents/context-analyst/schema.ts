import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { confidenceTypeSchema } from '../shared/confidence.js';

/**
 * Structured-output contract for the Project Context Analyst. One
 * annotation per new item (action/risk/decision), keyed by item_ref so the
 * pipeline can merge it back onto the right draft item. The agent never
 * merges/deletes — see prompt.ts — so this schema only ever adds flags.
 */

export const relatedItemSchema = z.object({
  ref: z.string().min(1),
  relationship: z.string().min(1),
  reasoning: z.string().min(1),
});

export const contextAnnotationSchema = z.object({
  item_ref: z.string().min(1),
  is_likely_duplicate: z.boolean(),
  duplicate_of_id: z.string().nullable(),
  duplicate_reasoning: z.string().nullable(),
  related_items: z.array(relatedItemSchema),
  confidence_type: confidenceTypeSchema,
});

export const contextAnalysisResultSchema = z.object({
  annotations: z.array(contextAnnotationSchema),
});

export type ContextAnnotation = z.infer<typeof contextAnnotationSchema>;
export type ContextAnalysisResult = z.infer<typeof contextAnalysisResultSchema>;

export const contextAnalysisJsonSchema = zodToJsonSchema(contextAnalysisResultSchema) as Record<
  string,
  unknown
>;
