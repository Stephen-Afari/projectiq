import { describe, it, expect } from 'vitest';
import { getMostRecentMeetingDate } from '../../src/lib/projectMeetings.js';
import type { Meeting } from '../../src/db/types.js';

function meeting(id: string, meeting_date: string): Meeting {
  return {
    id,
    project_id: 'p',
    title: id,
    meeting_date,
    source: null,
    transcript_reference: null,
    summary: null,
    analysis_status: 'completed',
    analysis_error: null,
    created_at: `${meeting_date}T00:00:00.000Z`,
  };
}

describe('getMostRecentMeetingDate', () => {
  it('returns null for a project with no meetings', () => {
    expect(getMostRecentMeetingDate([])).toBeNull();
  });

  it('returns the single meeting date when only one exists', () => {
    expect(getMostRecentMeetingDate([meeting('m1', '2026-02-10')])).toBe('2026-02-10');
  });

  it('returns the most recent date regardless of input order', () => {
    const meetings = [meeting('m1', '2026-02-10'), meeting('m3', '2026-08-24'), meeting('m2', '2026-03-03')];
    expect(getMostRecentMeetingDate(meetings)).toBe('2026-08-24');
  });
});
