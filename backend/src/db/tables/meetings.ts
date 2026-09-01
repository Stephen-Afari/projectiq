import { insertRow, selectByColumn, selectById, updateRow } from '../queryTable.js';
import type { Meeting, MeetingAnalysisStatus } from '../types.js';

const TABLE = 'meetings';

export async function listMeetingsByProject(projectId: string): Promise<Meeting[]> {
  return selectByColumn<Meeting>(TABLE, 'project_id', projectId);
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  return selectById<Meeting>(TABLE, id);
}

export async function createMeeting(input: {
  project_id: string;
  title: string;
  meeting_date: string;
  source?: string;
  transcript_reference?: string;
  summary?: string;
}): Promise<Meeting> {
  return insertRow<Meeting>(TABLE, input);
}

export async function updateMeetingTranscriptReference(
  id: string,
  transcriptReference: string,
): Promise<Meeting> {
  return updateRow<Meeting>(TABLE, id, { transcript_reference: transcriptReference });
}

export async function updateMeetingSummary(id: string, summary: string): Promise<Meeting> {
  return updateRow<Meeting>(TABLE, id, { summary });
}

export async function updateMeetingAnalysisStatus(
  id: string,
  status: MeetingAnalysisStatus,
  error?: string | null,
): Promise<Meeting> {
  return updateRow<Meeting>(TABLE, id, { analysis_status: status, analysis_error: error ?? null });
}
