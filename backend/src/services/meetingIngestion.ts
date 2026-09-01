import { ApiError } from '../lib/ApiError.js';
import { createMeeting, getProjectById, updateMeetingTranscriptReference } from '../db/index.js';
import type { Meeting } from '../db/types.js';
import { uploadTranscript } from './transcriptStorage.js';

/**
 * Shared by POST /api/meetings (frontend, no auth) and POST
 * /api/webhooks/n8n/meetings (external, secret-verified) — both create a
 * meeting and store its transcript the same way. Throws ApiError(400) if
 * the project doesn't exist, ApiError(502) if transcript storage fails
 * (the meeting row still exists in that case — no cross-store transaction,
 * see docs/decision-log/2026-08-23-transcript-ingestion.md).
 */
export async function createMeetingWithTranscript(input: {
  project_id: string;
  title: string;
  meeting_date: string;
  source?: string;
  transcript_text?: string;
}): Promise<Meeting> {
  const { transcript_text, ...meetingFields } = input;

  const project = await getProjectById(meetingFields.project_id);
  if (!project) {
    throw new ApiError(400, 'Project not found', { field: 'project_id' });
  }

  const meeting = await createMeeting(meetingFields);

  if (!transcript_text) {
    return meeting;
  }

  const path = `${meeting.project_id}/${meeting.id}.txt`;
  try {
    await uploadTranscript(path, transcript_text);
  } catch (err) {
    console.error(err);
    throw new ApiError(502, 'Meeting was created but the transcript could not be stored. Try again.');
  }
  return updateMeetingTranscriptReference(meeting.id, path);
}
