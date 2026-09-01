import { z } from 'zod';

/** Shared PATCH body for the approval-gated entity tables. */
export const patchApprovalStatusSchema = z.object({
  approval_status: z.enum(['approved', 'rejected']),
  approved_by: z.string().uuid(),
});

export const confidenceTypeValues = ['fact', 'inference', 'recommendation'] as const;

/** Every edit-schema is a partial object; this rejects an empty PATCH body. */
export function requireAtLeastOneField<T extends z.ZodRawShape>(shape: z.ZodObject<T>) {
  return shape.refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });
}
