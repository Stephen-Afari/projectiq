import { z } from 'zod';

export const analyseMeetingSchema = z.object({
  meeting_id: z.string().uuid(),
  // Bypasses the idempotency short-circuit (see routes/ai.ts) for
  // deliberate re-analysis, e.g. after a transcript correction.
  force: z.boolean().optional(),
});

export const weeklyReportSchema = z.object({
  project_id: z.string().uuid(),
  // ISO 8601 timestamp; "new items" and escalations are computed relative
  // to this. Defaults to 7 days before now in the route if omitted, so a
  // scheduled caller (n8n) doesn't need to compute it itself.
  week_start: z.string().min(1).optional(),
});
