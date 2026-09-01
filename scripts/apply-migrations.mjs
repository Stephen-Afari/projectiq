// One-off migration runner: connects directly to SUPABASE_DB_URL (the
// Session Pooler connection string) via `pg` and runs every not-yet-applied
// file in supabase/migrations/ in filename order, tracked in a
// schema_migrations table so re-running this script is idempotent — only
// new migration files execute. Does not use the Supabase CLI and does not
// derive a host from SUPABASE_URL — the connection target comes only from
// SUPABASE_DB_URL.
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL is not set in .env');
  process.exit(1);
}

const url = new URL(dbUrl);
console.log(`Connecting to host: ${url.hostname}:${url.port || 5432}`);

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

await client.connect();
console.log('Connected.');

try {
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows: applied } = await client.query('select filename from schema_migrations');
  const alreadyApplied = new Set(applied.map((r) => r.filename));

  let appliedCount = 0;
  for (const file of files) {
    if (alreadyApplied.has(file)) {
      console.log(`  – ${file} already applied, skipping`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`\nApplying ${file}...`);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (filename) values ($1)', [file]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
    console.log(`  ✓ ${file} applied`);
    appliedCount += 1;
  }

  console.log(
    appliedCount > 0
      ? `\n${appliedCount} migration(s) applied successfully.`
      : '\nNo new migrations to apply — up to date.',
  );
} finally {
  await client.end();
}
