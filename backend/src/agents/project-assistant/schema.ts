import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { confidenceTypeSchema } from '../shared/confidence.js';

/**
 * Structured-output contract for the Project Assistant (Q&A over one
 * project's retrieved data). Mirrors the Executive Reporting Agent's
 * shape — an array of confidence-typed statements, not free prose — plus
 * two guardrails specific to answering an arbitrary question: `citations`
 * (which records ground each statement) and `data_gap` (a required,
 * structural field forcing the model to say what's missing rather than
 * silently answering incompletely).
 */

export const queryCitationSchema = z.object({
  type: z.enum(['action', 'risk', 'issue', 'decision', 'dependency', 'change_signal', 'meeting']),
  id: z.string().min(1),
  label: z.string().min(1),
});

export const queryAnswerPointSchema = z.object({
  text: z.string().min(1),
  confidence_type: confidenceTypeSchema,
  citations: z.array(queryCitationSchema),
});

export const projectQueryResultSchema = z.object({
  answer: z.array(queryAnswerPointSchema).min(1),
  // Null when the retrieved data fully answers the question. Otherwise a
  // short statement of exactly what's missing — the hallucination guard:
  // the model must fill this in rather than inventing an answer.
  data_gap: z.string().nullable(),
});

export type QueryCitation = z.infer<typeof queryCitationSchema>;
export type QueryAnswerPoint = z.infer<typeof queryAnswerPointSchema>;
export type ProjectQueryResult = z.infer<typeof projectQueryResultSchema>;

export const projectQueryJsonSchema = zodToJsonSchema(projectQueryResultSchema) as Record<
  string,
  unknown
>;
