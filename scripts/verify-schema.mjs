// One-off verification: confirms all 11 tables exist and RLS is enabled on
// each, via the same direct SUPABASE_DB_URL connection used to apply
// migrations.
import 'dotenv/config';
import pg from 'pg';

const dbUrl = process.env.SUPABASE_DB_URL;
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const expectedTables = [
  'organisations',
  'users',
  'projects',
  'meetings',
  'documents',
  'actions',
  'risks',
  'issues',
  'decisions',
  'dependencies',
  'change_signals',
  'agent_runs',
];

await client.connect();

const { rows } = await client.query(
  `select c.relname as table_name, c.relrowsecurity as rls_enabled
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname = any($1)
   order by c.relname`,
  [expectedTables],
);

console.log('table'.padEnd(20), 'rls_enabled');
console.log('-'.repeat(35));
for (const row of rows) {
  console.log(row.table_name.padEnd(20), row.rls_enabled);
}

const found = new Set(rows.map((r) => r.table_name));
const missing = expectedTables.filter((t) => !found.has(t));
const rlsOff = rows.filter((r) => !r.rls_enabled).map((r) => r.table_name);

console.log('\nExpected tables:', expectedTables.length, '| Found:', found.size);
if (missing.length) console.log('MISSING TABLES:', missing.join(', '));
if (rlsOff.length) console.log('RLS DISABLED ON:', rlsOff.join(', '));
if (!missing.length && !rlsOff.length) {
  console.log('All tables present with RLS enabled.');
}

await client.end();
