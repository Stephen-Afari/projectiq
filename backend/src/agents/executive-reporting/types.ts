import type { Action, ChangeSignal, Decision, Project, Risk } from '../../db/types.js';

export interface WeeklyReportInput {
  project: Project;
  weekStart: string;
  weekEnd: string;
  newItemCounts: {
    actions: number;
    risks: number;
    issues: number;
    decisions: number;
    dependencies: number;
    change_signals: number;
  };
  topRisks: Risk[];
  overdueActions: Action[];
  worseningRisks: Risk[];
  pendingDecisions: Decision[];
  openChangeSignals: ChangeSignal[];
}
