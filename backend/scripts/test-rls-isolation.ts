/**
 * Proves Row Level Security actually isolates two organisations' data —
 * independent of the backend's own org-scoping checks (which are the
 * real authorization boundary for API traffic, since the backend uses
 * the service-role key; see docs/decision-log/
 * 2026-09-02-security-hardening.md). This script bypasses the Express
 * API entirely and talks to Supabase directly with the **anon key**, as
 * a real logged-in user would if the frontend ever queried Supabase
 * directly — exactly the scenario RLS exists to protect.
 *
 * Creates/reuses a second organisation + Supabase Auth user (same
 * find-or-create pattern as backend/scripts/seed.ts), then:
 *   1. Signs in as the second org's user, queries the Apex project by id
 *      — expects zero rows.
 *   2. Signs in as an Apex user, queries the second org's project by id
 *      — expects zero rows.
 * Exits non-zero if either direction leaks data.
 *
 * Run: npm run test:rls
 */
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../src/db/client.js';
import { config } from '../src/config.js';
import {
  getOrganisationByName,
  createOrganisation,
  getUserById,
  createUser,
  listProjectsByOrganisation,
  createProject,
} from '../src/db/index.js';

const APEX_ORG_NAME = 'Apex Manufacturing Ltd';
const APEX_USER_EMAIL = 'priya.nair@apex-manufacturing.example';

const TEST_ORG_NAME = 'RLS Test Org (auto-generated)';
const TEST_PROJECT_NAME = 'RLS Test Project';
const TEST_USER_EMAIL = 'rls-test-user@projectiq-test.example';

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

async function queryAsUser(email: string, password: string, targetProjectId: string) {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Sign-in failed for ${email}: ${signInError.message}`);

  const { data, error } = await client.from('projects').select('id').eq('id', targetProjectId);
  if (error) throw new Error(`Query failed for ${email}: ${error.message}`);

  await client.auth.signOut();
  return data ?? [];
}

async function main() {
  console.log('Setting up RLS isolation test fixtures...');

  const apexOrg = await getOrganisationByName(APEX_ORG_NAME);
  if (!apexOrg) {
    throw new Error(
      `"${APEX_ORG_NAME}" not found — run "npm run seed" first (this test reuses the seeded Apex org/user).`,
    );
  }
  const apexProjects = await listProjectsByOrganisation(apexOrg.id);
  const apexProject = apexProjects[0];
  if (!apexProject) {
    throw new Error(`"${APEX_ORG_NAME}" has no projects — run "npm run seed" first.`);
  }

  let testOrg = await getOrganisationByName(TEST_ORG_NAME);
  if (!testOrg) {
    testOrg = await createOrganisation({ name: TEST_ORG_NAME });
    console.log(`  ✓ created test org (${testOrg.id})`);
  } else {
    console.log(`  ✓ test org already exists (${testOrg.id})`);
  }

  const testProjects = await listProjectsByOrganisation(testOrg.id);
  let testProject = testProjects.find((p) => p.name === TEST_PROJECT_NAME) ?? null;
  if (!testProject) {
    testProject = await createProject({ organisation_id: testOrg.id, name: TEST_PROJECT_NAME });
    console.log(`  ✓ created test project (${testProject.id})`);
  } else {
    console.log(`  ✓ test project already exists (${testProject.id})`);
  }

  const testUserId = await findOrCreateAuthUser(TEST_USER_EMAIL, config.seedDemoPassword);
  const existingTestUser = await getUserById(testUserId);
  if (!existingTestUser) {
    await createUser({
      id: testUserId,
      name: 'RLS Test User',
      email: TEST_USER_EMAIL,
      role: 'viewer',
      organisation_id: testOrg.id,
    });
    console.log(`  ✓ created test user (${TEST_USER_EMAIL})`);
  } else {
    console.log(`  ✓ test user already exists (${TEST_USER_EMAIL})`);
  }

  console.log('\nRunning isolation checks (via anon key, real Supabase Auth sessions)...');

  let failed = false;

  const testOrgSeesApex = await queryAsUser(TEST_USER_EMAIL, config.seedDemoPassword, apexProject.id);
  if (testOrgSeesApex.length === 0) {
    console.log(`  ✓ PASS: ${TEST_USER_EMAIL} (org "${testOrg.name}") cannot read Apex's project`);
  } else {
    console.log(`  ✗ FAIL: ${TEST_USER_EMAIL} could read Apex's project — RLS is not isolating!`);
    failed = true;
  }

  const apexSeesTestOrg = await queryAsUser(APEX_USER_EMAIL, config.seedDemoPassword, testProject.id);
  if (apexSeesTestOrg.length === 0) {
    console.log(`  ✓ PASS: ${APEX_USER_EMAIL} (org "${apexOrg.name}") cannot read the test org's project`);
  } else {
    console.log(`  ✗ FAIL: ${APEX_USER_EMAIL} could read the test org's project — RLS is not isolating!`);
    failed = true;
  }

  if (failed) {
    console.error('\nRLS isolation test FAILED.');
    process.exit(1);
  }
  console.log('\nRLS isolation test PASSED — both directions correctly isolated.');
}

main().catch((err) => {
  console.error('RLS isolation test errored:', err);
  process.exit(1);
});
