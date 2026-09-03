import { z } from 'zod';

/**
 * Payload contract for POST /api/webhooks/n8n/meetings — field names match
 * the n8n workflow's incoming JSON exactly (`transcript`, not
 * `transcript_text` as used internally by createMeetingWithTranscript).
 */
export const n8nMeetingIngestionSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1),
  meeting_date: z.string().date(),
  source: z.string().optional(),
  transcript: z
    .string()
    .max(200_000, 'Transcript is too large (200,000 character limit)')
    .refine((s) => s.trim().length > 0, 'Transcript cannot be empty'),
});

/**
 * Payload for PATCH /api/webhooks/n8n/meetings/:id/analysis-status — the
 * Meeting Analysis workflow's failure-branch fallback for marking a
 * meeting as needing attention when it can't rely on the backend having
 * done so itself (e.g. a network failure means analyse-meeting never ran).
 * Scoped to exactly what that branch needs: only 'failed' is settable via
 * this route — moving a meeting to 'completed' only ever happens as a
 * side effect of a real successful analysis run.
 */
export const markAnalysisStatusSchema = z.object({
  status: z.literal('failed'),
  error: z.string().optional(),
});
