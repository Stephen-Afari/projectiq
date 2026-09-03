import { z } from 'zod';

export const createMeetingSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1),
  meeting_date: z.string().date(),
  source: z.string().optional(),
  transcript_reference: z.string().optional(),
  summary: z.string().optional(),
  transcript_text: z
    .string()
    .max(200_000, 'Transcript is too large (200,000 character limit)')
    .refine((s) => s.trim().length > 0, 'Transcript cannot be empty')
    .optional(),
});
