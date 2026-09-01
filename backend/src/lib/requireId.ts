import { ApiError } from './ApiError.js';

/** Express route params are typed string | undefined; this narrows and 400s if absent. */
export function requireId(id: string | undefined): string {
  if (!id) throw new ApiError(400, 'Missing id parameter');
  return id;
}
