import type { Meeting } from '../db/types.js';

/**
 * Shared by GET /api/projects/:id/dashboard ("new since last meeting")
 * and POST /api/ai/project-query ("what changed since our last
 * meeting?") — both need the same cutoff. Null if the project has no
 * meetings yet.
 */
export function getMostRecentMeetingDate(meetings: Meeting[]): string | null {
  const sorted = meetings.slice().sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1));
  return sorted[0]?.meeting_date ?? null;
}
