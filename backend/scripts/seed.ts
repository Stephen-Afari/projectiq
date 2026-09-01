/**
 * Idempotent seed script for the Apex Manufacturing Ltd portfolio demo.
 * Safe to re-run: every step finds-or-creates by a natural key instead of
 * inserting unconditionally.
 *
 * `users.id references auth.users(id)` (see docs/decision-log/2026-08-21-
 * database-schema-and-rls.md), so demo users are created as real Supabase
 * Auth accounts via the admin API — not fabricated UUIDs — using
 * SEED_DEMO_PASSWORD (config.seedDemoPassword) as a fixed, documented
 * password so they're usable for testing once a login UI exists.
 *
 * Run: npm run seed
 */
import { supabase } from '../src/db/client.js';
import { config } from '../src/config.js';
import {
  getOrganisationByName,
  createOrganisation,
  getUserById,
  createUser,
  listProjectsByOrganisation,
  createProject,
  listMeetingsByProject,
  createMeeting,
  listActionsByProject,
  createAction,
  listRisksByProject,
  createRisk,
  listDecisionsByProject,
  createDecision,
} from '../src/db/index.js';
import type { UserRole } from '../src/db/types.js';

const ORG_NAME = 'Apex Manufacturing Ltd';
const PROJECT_NAME = 'ERP Transformation Programme';
const MEETING_TITLE = 'Programme Kickoff';

const DEMO_USERS: { name: string; email: string; role: UserRole }[] = [
  { name: 'Priya Nair', email: 'priya.nair@apex-manufacturing.example', role: 'pm' },
  { name: 'David Chen', email: 'david.chen@apex-manufacturing.example', role: 'admin' },
  { name: 'Michael Osei', email: 'michael.osei@apex-manufacturing.example', role: 'contributor' },
  { name: 'Sarah Whitfield', email: 'sarah.whitfield@apex-manufacturing.example', role: 'contributor' },
  { name: 'Tom Reyes', email: 'tom.reyes@apex-manufacturing.example', role: 'viewer' },
];
// Role labels for logging only — the schema's user_role enum
// (admin/pm/contributor/viewer) doesn't have dedicated Finance/IT/
// Procurement/Vendor values, so each demo person's real-world title is
// tracked here and their closest enum role is used for access purposes.
const DEMO_USER_TITLES = [
  'Project Manager',
  'Finance Lead',
  'IT Lead',
  'Procurement Manager',
  'Vendor PM',
];

async function findOrCreateAuthUser(email: string, password: string): Promise<string> {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error && created.user) return created.user.id;

  let page = 1;
  for (;;) {
    const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) throw listError;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  throw new Error(`Could not find or create auth user for ${email}: ${error?.message}`);
}

async function seed() {
  console.log(`Seeding "${ORG_NAME}"...`);

  let organisation = await getOrganisationByName(ORG_NAME);
  if (!organisation) {
    organisation = await createOrganisation({ name: ORG_NAME });
    console.log(`  ✓ organisation created (${organisation.id})`);
  } else {
    console.log(`  ✓ organisation already exists (${organisation.id})`);
  }

  const userIds: string[] = [];
  for (let i = 0; i < DEMO_USERS.length; i += 1) {
    const demoUser = DEMO_USERS[i]!;
    const title = DEMO_USER_TITLES[i]!;
    const authUserId = await findOrCreateAuthUser(demoUser.email, config.seedDemoPassword);
    const existing = await getUserById(authUserId);
    if (!existing) {
      await createUser({
        id: authUserId,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        organisation_id: organisation.id,
      });
      console.log(`  ✓ user created: ${demoUser.name} (${title}) <${demoUser.email}>`);
    } else {
      console.log(`  ✓ user already exists: ${demoUser.name} (${title}) <${demoUser.email}>`);
    }
    userIds.push(authUserId);
  }

  const existingProjects = await listProjectsByOrganisation(organisation.id);
  let project = existingProjects.find((p) => p.name === PROJECT_NAME) ?? null;
  if (!project) {
    project = await createProject({
      organisation_id: organisation.id,
      name: PROJECT_NAME,
      description:
        'Programme to replace Apex Manufacturing\'s legacy MRP system with a unified ERP platform across finance, procurement, and production planning.',
      status: 'active',
      health: 'amber',
      start_date: '2026-02-01',
      target_date: '2026-12-19',
    });
    console.log(`  ✓ project created (${project.id})`);
  } else {
    console.log(`  ✓ project already exists (${project.id})`);
  }

  const existingMeetings = await listMeetingsByProject(project.id);
  let meeting = existingMeetings.find((m) => m.title === MEETING_TITLE) ?? null;
  if (!meeting) {
    meeting = await createMeeting({
      project_id: project.id,
      title: MEETING_TITLE,
      meeting_date: '2026-02-10',
      source: 'upload',
      summary:
        'Kickoff steering meeting: confirmed scope, timeline risk around vendor data migration, and initial workstream owners.',
    });
    console.log(`  ✓ meeting created (${meeting.id})`);
  } else {
    console.log(`  ✓ meeting already exists (${meeting.id})`);
  }

  const [pm, finance, it, procurement, vendor] = userIds;

  const existingActions = await listActionsByProject(project.id);
  if (existingActions.length === 0) {
    const actionSeeds = [
      {
        description: 'Finalise data migration plan for legacy MRP records',
        owner: 'David Chen',
        due_date: '2026-03-01',
        priority: 'high' as const,
        status: 'in_progress' as const,
      },
      {
        description: 'Confirm vendor SOW for integration workstream',
        owner: 'Tom Reyes',
        due_date: '2026-02-20',
        priority: 'critical' as const,
        status: 'open' as const,
      },
      {
        description: 'Set up UAT environment for finance module',
        owner: 'Sarah Whitfield',
        due_date: '2026-03-15',
        priority: 'medium' as const,
        status: 'open' as const,
      },
      {
        description: 'Circulate updated procurement workflow diagrams',
        owner: 'Michael Osei',
        due_date: '2026-02-25',
        priority: 'low' as const,
        status: 'done' as const,
      },
    ];
    for (const a of actionSeeds) {
      await createAction({
        project_id: project.id,
        meeting_id: meeting.id,
        source_excerpt: `Discussed in ${MEETING_TITLE}`,
        ...a,
      });
    }
    console.log(`  ✓ ${actionSeeds.length} sample actions created`);
  } else {
    console.log(`  ✓ actions already seeded (${existingActions.length} found)`);
  }

  const existingRisks = await listRisksByProject(project.id);
  if (existingRisks.length === 0) {
    const riskSeeds = [
      {
        description: 'Vendor data migration may slip past go-live freeze window',
        probability: 'high' as const,
        impact: 'high' as const,
        severity: 'critical' as const,
        owner: 'David Chen',
        mitigation: 'Add contingency buffer and weekly vendor migration checkpoint.',
        status: 'open' as const,
      },
      {
        description: 'Finance team UAT availability constrained during quarter-end close',
        probability: 'medium' as const,
        impact: 'medium' as const,
        severity: 'medium' as const,
        owner: 'Sarah Whitfield',
        mitigation: 'Schedule UAT sessions outside close week; nominate backup testers.',
        status: 'open' as const,
      },
      {
        description: 'Procurement module scope creep from unapproved integrations',
        probability: 'low' as const,
        impact: 'medium' as const,
        severity: 'low' as const,
        owner: 'Michael Osei',
        mitigation: 'Route all integration requests through change control.',
        status: 'mitigated' as const,
      },
    ];
    for (const r of riskSeeds) {
      await createRisk({
        project_id: project.id,
        meeting_id: meeting.id,
        source_excerpt: `Discussed in ${MEETING_TITLE}`,
        ...r,
      });
    }
    console.log(`  ✓ ${riskSeeds.length} sample risks created`);
  } else {
    console.log(`  ✓ risks already seeded (${existingRisks.length} found)`);
  }

  const existingDecisions = await listDecisionsByProject(project.id);
  if (existingDecisions.length === 0) {
    const decisionSeeds = [
      {
        decision: 'Adopt phased go-live: Finance module first, Procurement and Production to follow.',
        decision_owner: 'Priya Nair',
        decision_date: '2026-02-10',
        impact: 'Reduces cutover risk; extends overall programme timeline by 6 weeks.',
      },
      {
        decision: 'Use vendor-managed migration tooling instead of building in-house scripts.',
        decision_owner: 'David Chen',
        decision_date: '2026-02-10',
        impact: 'Faster migration timeline; adds vendor dependency risk.',
      },
    ];
    for (const d of decisionSeeds) {
      await createDecision({
        project_id: project.id,
        meeting_id: meeting.id,
        source_excerpt: `Discussed in ${MEETING_TITLE}`,
        ...d,
      });
    }
    console.log(`  ✓ ${decisionSeeds.length} sample decisions created`);
  } else {
    console.log(`  ✓ decisions already seeded (${existingDecisions.length} found)`);
  }

  console.log('\nSeed summary:');
  console.log(`  organisation: ${organisation.id}`);
  console.log(`  project:      ${project.id}`);
  console.log(`  meeting:      ${meeting.id}`);
  console.log(`  users:        ${DEMO_USERS.map((u) => u.email).join(', ')}`);
  console.log(`  demo password: set via SEED_DEMO_PASSWORD (not printed here)`);
  console.log(`  pm=${pm} finance=${finance} it=${it} procurement=${procurement} vendor=${vendor}`);
  console.log('\nDone.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
