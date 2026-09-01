import { insertRow, selectByColumn } from '../queryTable.js';
import type { WeeklyReport } from '../types.js';

const TABLE = 'weekly_reports';

export async function listWeeklyReportsByProject(projectId: string): Promise<WeeklyReport[]> {
  return selectByColumn<WeeklyReport>(TABLE, 'project_id', projectId);
}

export async function createWeeklyReport(input: {
  project_id: string;
  week_start: string;
  week_end: string;
  status_summary: string;
  report_json: Record<string, unknown>;
  model: string;
  prompt_version: string;
}): Promise<WeeklyReport> {
  return insertRow<WeeklyReport>(TABLE, input);
}
