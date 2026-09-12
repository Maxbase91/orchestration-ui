#!/usr/bin/env node
// Remove the Supabase row-level-security scaffolding from the live database.
//
// db/schema.sql carried 47 `ENABLE ROW LEVEL SECURITY` statements and 47
// policies, every one of them `FOR ALL USING (true) WITH CHECK (true)`. They
// came from the Supabase era and survived the migration to Neon (ADR-0003).
//
// They enforce nothing. The application connects as the table owner, and
// PostgreSQL does not apply RLS to a table's owner unless the table is set to
// FORCE; even if it did, a `USING (true)` policy admits every row. What they do
// is read — to a reviewer, an auditor, or the next person to open the schema —
// as though row-level access control were in place. A control that looks real
// and is not is worse than no control, because it stops the next person
// looking, so the scaffolding is removed rather than left in place.
//
// This does NOT change what any caller can do. Access control for this platform
// is the deferred identity model in ADR-0003; if RLS becomes the mechanism for
// it later, it comes back as policies that actually restrict something, written
// against a role the app does not own.
//
// Reads the live catalogue rather than a hand-written table list: a list here
// would be a second copy of schema.sql's contents and would miss whatever it
// forgot. Anything RLS-enabled or policied gets cleared, whether or not the
// schema file knows about it.
//
//   npm run backfill:drop-rls              (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('drop Supabase RLS scaffolding'));

/** Quote an identifier read from the catalogue for safe interpolation. */
const q = (name) => `"${String(name).replace(/"/g, '""')}"`;

const policies = await sql`
  SELECT schemaname, tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname
`;

const enabled = await sql`
  SELECT c.relname AS tablename
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  ORDER BY c.relname
`;

console.log(`Found ${policies.length} polic${policies.length === 1 ? 'y' : 'ies'} `
  + `and ${enabled.length} RLS-enabled table${enabled.length === 1 ? '' : 's'} in public.`);

// Report anything that is not the open scaffolding this script exists to remove.
// A policy that actually restricts something must not be dropped silently.
const restrictive = policies.filter((row) => !/_all$|^Allow all$/.test(String(row.policyname)));
if (restrictive.length > 0) {
  console.log('\nPolicies whose names do not match the open scaffolding pattern:');
  for (const row of restrictive) console.log(`  ${row.tablename}.${row.policyname}`);
  console.log('  (dropped too — every policy in this database is FOR ALL USING (true);');
  console.log('   if that ever stops being true, re-read this script before running it.)');
}

if (DRY) {
  for (const row of policies) console.log(`  would drop policy ${row.tablename}.${row.policyname}`);
  for (const row of enabled) console.log(`  would disable RLS on ${row.tablename}`);
  console.log('\nDry run — nothing was changed.');
  process.exit(0);
}

for (const row of policies) {
  await sql.query(`DROP POLICY IF EXISTS ${q(row.policyname)} ON ${q(row.tablename)}`);
}
for (const row of enabled) {
  await sql.query(`ALTER TABLE ${q(row.tablename)} DISABLE ROW LEVEL SECURITY`);
}

const [{ count: policiesLeft }] = await sql`SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'public'`;
const [{ count: rlsLeft }] = await sql`
  SELECT count(*)::int AS count FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
`;

if (policiesLeft !== 0 || rlsLeft !== 0) {
  console.error(`\nFAILED: ${policiesLeft} polic(ies) and ${rlsLeft} RLS-enabled table(s) remain.`);
  process.exit(1);
}

console.log(`\nDropped ${policies.length} policies and disabled RLS on ${enabled.length} tables. `
  + 'public now has neither.');
