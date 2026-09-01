import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Structured-output contract for the Project Impact Analyst. One
 * assessment per applicable item (risk/dependency/change_signal), keyed by
 * item_ref. confidence_type is locked to "inference" — an impact
 * projection is never a directly-stated fact, per the guardrail. Stored
 * even when applicable is false, so "considered, no material impact" is
 * itself a recorded outcome rather than silence.
 */

export const impactAssessmentAnnotationSchema = z.object({
  item_ref: z.string().min(1),
  applicable: z.boolean(),
  schedule_impact: z.string().nullable(),
  cost_impact: z.string().nullable(),
  scope_impact: z.string().nullable(),
  resource_impact: z.string().nullable(),
  dependency_impact: z.string().nullable(),
  reasoning: z.string().nullable(),
  confidence_type: z.literal('inference'),
});

export const impactAnalysisResultSchema = z.object({
  assessments: z.array(impactAssessmentAnnotationSchema),
});

export type ImpactAssessmentAnnotation = z.infer<typeof impactAssessmentAnnotationSchema>;
export type ImpactAnalysisResult = z.infer<typeof impactAnalysisResultSchema>;

export const impactAnalysisJsonSchema = zodToJsonSchema(impactAnalysisResultSchema) as Record<
  string,
  unknown
>;
