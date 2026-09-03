import type {
  Action,
  ChangeSignal,
  Decision,
  Dependency,
  Issue,
  Meeting,
  Project,
  Risk,
} from '../../db/types.js';
import type { SubHealth } from '../../lib/projectHealth.js';
import type { ChunkSearchResult } from '../../services/retrieval.js';

export interface ProjectAssistantInput {
  project: Project;
  subHealth: SubHealth;
  question: string;
  sinceLastMeeting: string | null;
  meetings: Meeting[];
  // Top-k, threshold-passed passages from the project's uploaded
  // documents (backend/src/services/retrieval.ts) — may be empty if
  // nothing relevant was found, which is itself meaningful (see prompt.ts).
  retrievedChunks: ChunkSearchResult[];
  // Approved-only, per the "everything grounds in approved data" rule
  // already established for the dashboard/alerts/weekly-report — except
  // decisions, the one deliberate exception (see decisions below).
  actions: Action[];
  risks: Risk[];
  issues: Issue[];
  dependencies: Dependency[];
  changeSignals: ChangeSignal[];
  // ALL decisions, pending + approved — a PM asking "what needs approval"
  // needs the pending ones specifically, same exception used everywhere
  // else in this app.
  decisions: Decision[];
  overdueActions: Action[];
  worseningRisks: Risk[];
  pendingDecisions: Decision[];
}
