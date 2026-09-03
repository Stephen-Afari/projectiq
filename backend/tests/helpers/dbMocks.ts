import { vi } from 'vitest';

/**
 * One vi.fn() per named export any route file imports from
 * `../db/index.js`, across the WHOLE app (app.ts wires every router, so
 * every route module's top-level import must resolve to something, even
 * in tests that only exercise one router). Built once per test file via
 * `createDbMocks()`, called from inside a self-contained `vi.mock(...)`
 * factory (see routes/*.test.ts) so it isn't subject to vi.mock's
 * hoist-above-const-declarations restriction.
 */
export function createDbMocks() {
  return {
    // projects
    getProjectById: vi.fn(),
    listProjectsByOrganisation: vi.fn(),
    createProject: vi.fn(),
    // meetings
    getMeetingById: vi.fn(),
    listMeetingsByProject: vi.fn(),
    updateMeetingAnalysisStatus: vi.fn(),
    updateMeetingSummary: vi.fn(),
    // users
    listUsersByOrganisation: vi.fn(),
    getUserById: vi.fn(),
    // actions
    createAction: vi.fn(),
    getActionById: vi.fn(),
    updateActionApprovalStatus: vi.fn(),
    updateActionFields: vi.fn(),
    listActionsByProject: vi.fn(),
    listActionsByMeeting: vi.fn(),
    // risks
    createRisk: vi.fn(),
    getRiskById: vi.fn(),
    updateRiskApprovalStatus: vi.fn(),
    updateRiskFields: vi.fn(),
    listRisksByProject: vi.fn(),
    listRisksByMeeting: vi.fn(),
    // issues
    getIssueById: vi.fn(),
    updateIssueApprovalStatus: vi.fn(),
    updateIssueFields: vi.fn(),
    listIssuesByProject: vi.fn(),
    listIssuesByMeeting: vi.fn(),
    // decisions
    createDecision: vi.fn(),
    getDecisionById: vi.fn(),
    updateDecisionApprovalStatus: vi.fn(),
    updateDecisionFields: vi.fn(),
    listDecisionsByProject: vi.fn(),
    listDecisionsByMeeting: vi.fn(),
    // dependencies
    getDependencyById: vi.fn(),
    updateDependencyApprovalStatus: vi.fn(),
    updateDependencyFields: vi.fn(),
    listDependenciesByProject: vi.fn(),
    listDependenciesByMeeting: vi.fn(),
    // change signals
    getChangeSignalById: vi.fn(),
    updateChangeSignalApprovalStatus: vi.fn(),
    updateChangeSignalFields: vi.fn(),
    listChangeSignalsByProject: vi.fn(),
    listChangeSignalsByMeeting: vi.fn(),
    createChangeSignal: vi.fn(),
    createDependency: vi.fn(),
    createIssue: vi.fn(),
    // reports / agent runs / audit
    listWeeklyReportsByProject: vi.fn(),
    createWeeklyReport: vi.fn(),
    createAgentRun: vi.fn(),
    createAuditLogEntry: vi.fn(),
    // documents / RAG chunks
    listDocumentsByProject: vi.fn(),
    getDocumentById: vi.fn(),
    createDocument: vi.fn(),
    updateDocumentIngestionStatus: vi.fn(),
    createProjectChunks: vi.fn(),
    listChunksByDocument: vi.fn(),
    listChunksByProject: vi.fn(),
    searchProjectChunks: vi.fn().mockResolvedValue([]),
  };
}

export type DbMocks = ReturnType<typeof createDbMocks>;
