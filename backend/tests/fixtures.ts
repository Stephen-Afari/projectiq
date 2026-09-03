import type { Action, Decision, Issue, Dependency, ChangeSignal, Risk, Project } from '../src/db/types.js';

// Real UUID-shaped strings — several of these appear in POST bodies that
// zod validates with .uuid(), so they must actually parse as UUIDs, not
// just be unique strings.
/** The authenticated caller every route test runs as (see helpers via inline vi.mock of requireAuth). */
export const TEST_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  organisationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'pm',
  email: 'test-user@projectiq.test',
};

export const OTHER_ORG_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const PROJECT_A: Project = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  organisation_id: TEST_USER.organisationId,
  name: 'Test Programme',
  description: 'Fixture project for automated tests',
  status: 'active',
  health: 'amber',
  start_date: '2026-01-01',
  target_date: '2026-12-31',
  created_at: '2026-01-01T00:00:00.000Z',
};

/** Same shape as PROJECT_A but belongs to a different org — for cross-org 404 assertions. */
export const PROJECT_B: Project = {
  ...PROJECT_A,
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  organisation_id: OTHER_ORG_ID,
  name: 'Other Org Project',
};

function entityBase() {
  return {
    project_id: PROJECT_A.id,
    meeting_id: null,
    source_excerpt: null,
    created_by_agent: null,
    approved_by: null,
    approved_at: null,
    confidence_type: 'fact' as const,
    created_at: '2026-02-01T00:00:00.000Z',
  };
}

// --- Dashboard fixture: known, hand-picked counts (see decision log for the exact numbers this proves) ---

export const FIXTURE_ACTIONS: Action[] = [
  {
    id: 'action-1-approved-overdue-open',
    ...entityBase(),
    approval_status: 'approved',
    description: 'Approved, overdue, still open',
    owner: 'Alice',
    due_date: '2020-01-01',
    priority: 'high',
    status: 'open',
    context_flags: null,
  },
  {
    id: 'action-2-approved-overdue-done',
    ...entityBase(),
    approval_status: 'approved',
    description: 'Approved, past due but done (not counted overdue)',
    owner: 'Bob',
    due_date: '2020-01-01',
    priority: 'low',
    status: 'done',
    context_flags: null,
  },
  {
    id: 'action-3-pending-overdue',
    ...entityBase(),
    approval_status: 'pending',
    description: 'Pending, overdue — must be excluded entirely',
    owner: 'Carol',
    due_date: '2020-01-01',
    priority: 'critical',
    status: 'open',
    context_flags: null,
  },
] as Action[];

export const FIXTURE_RISKS: Risk[] = [
  {
    id: 'risk-1-approved-critical',
    ...entityBase(),
    approval_status: 'approved',
    description: 'Approved critical risk',
    probability: 'high',
    impact: 'high',
    severity: 'critical',
    owner: 'Alice',
    mitigation: null,
    status: 'open',
    context_flags: null,
    impact_assessment: null,
    previous_severity: null,
    severity_changed_at: null,
  },
  {
    id: 'risk-2-approved-worsened',
    ...entityBase(),
    approval_status: 'approved',
    description: 'Approved risk that worsened from medium to high',
    probability: 'medium',
    impact: 'high',
    severity: 'high',
    owner: 'Bob',
    mitigation: null,
    status: 'open',
    context_flags: null,
    impact_assessment: null,
    previous_severity: 'medium',
    severity_changed_at: '2026-02-15T00:00:00.000Z',
  },
  {
    id: 'risk-3-pending-critical',
    ...entityBase(),
    approval_status: 'pending',
    description: 'Pending critical risk — must be excluded',
    probability: 'high',
    impact: 'high',
    severity: 'critical',
    owner: 'Carol',
    mitigation: null,
    status: 'open',
    context_flags: null,
    impact_assessment: null,
    previous_severity: null,
    severity_changed_at: null,
  },
] as Risk[];

export const FIXTURE_DECISIONS: Decision[] = [
  {
    id: 'decision-1-pending',
    ...entityBase(),
    approval_status: 'pending',
    decision: 'Pending decision awaiting approval',
    decision_owner: 'Alice',
    decision_date: null,
    impact: null,
    context_flags: null,
  },
  {
    id: 'decision-2-approved',
    ...entityBase(),
    approval_status: 'approved',
    decision: 'Already-approved decision',
    decision_owner: 'Bob',
    decision_date: '2026-02-01',
    impact: null,
    context_flags: null,
  },
] as Decision[];

export const FIXTURE_ISSUES: Issue[] = [
  {
    id: 'issue-1-approved-open',
    ...entityBase(),
    approval_status: 'approved',
    description: 'Approved open issue',
    owner: 'Alice',
    severity: 'medium',
    status: 'open',
    resolution: null,
  },
] as Issue[];

export const FIXTURE_DEPENDENCIES: Dependency[] = [
  {
    id: 'dependency-1-approved-planned',
    ...entityBase(),
    approval_status: 'approved',
    description: 'Approved planned dependency',
    upstream_activity: 'Design',
    downstream_activity: 'Build',
    owner: 'Bob',
    status: 'planned',
    impact_assessment: null,
  },
] as Dependency[];

export const FIXTURE_CHANGE_SIGNALS: ChangeSignal[] = [
  {
    id: 'change-signal-1-approved-open',
    ...entityBase(),
    approval_status: 'approved',
    change_type: 'scope',
    description: 'Approved open change signal',
    potential_impact: null,
    status: 'open',
    impact_assessment: null,
  },
] as ChangeSignal[];
