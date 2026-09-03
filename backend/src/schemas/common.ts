import { z } from 'zod';

/**
 * Shared PATCH body for the approval-gated entity tables. approved_by is
 * NOT accepted here — it's derived server-side from the authenticated
 * session (req.user.id, set by requireAuth), never from client input, so
 * a caller can't approve something as someone else. See
 * docs/decision-log/2026-09-02-security-hardening.md.
 */
export const patchApprovalStatusSchema = z.object({
  approval_status: z.enum(['approved', 'rejected']),
});

export const confidenceTypeValues = ['fact', 'inference', 'recommendation'] as const;

/** Every edit-schema is a partial object; this rejects an empty PATCH body. */
export function requireAtLeastOneField<T extends z.ZodRawShape>(shape: z.ZodObject<T>) {
  return shape.refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });
}
