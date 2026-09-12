#!/usr/bin/env node
// db/schema.sql must describe the database that actually exists.
//
// It did not. signals, required_sections and capture_flags were added to
// service_descriptions in the live store and never reached this file, while
// src/server/api/intake-submit.ts wrote all three. Nothing failed, because the
// columns were there — but a fresh environment provisioned from schema.sql
// would have lacked them, and since that insert sits inside the atomic intake
// transaction, every submission carrying a service description would have
// failed and rolled the whole thing back.
//
// test:table-lists could not catch it: it compares hand-maintained lists *to*
// schema.sql, so a column schema.sql itself is missing is invisible. The only
// thing that can catch it is the database.
//
// Both directions matter, and they mean different things:
//   in the database, not in the file  → a fresh environment is born broken
//   in the file, not in the database  → the migration has not been applied
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireConnection, skipIfUnreachable } from '../lib/live.mjs';

loadEnv();
const sql = neon(requireConnection('schema-drift'));
const schema = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');

// Lines inside a CREATE TABLE body that declare a constraint, not a column.
const CONSTRAINT = /^\s*(PRIMARY\s+KEY|UNIQUE|CHECK|CONSTRAINT|FOREIGN\s+KEY|EXCLUDE)\b/i;

/**
 * Column names db/schema.sql would create, per table.
 *
 * Comments come out first, and not for tidiness: `system TEXT NOT NULL,
 * -- ariba, coupa-risk, sirion, sap` puts commas inside a trailing comment, and
 * a parser splitting on commas reads each fragment as another column — and
 * swallows the real column on the next line while it is at it.
 */
function columnsFromSchema(rawSource) {
  const source = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');
  const tables = new Map();
  const add = (table, column) => {
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table).add(column.toLowerCase());
  };

  // CREATE TABLE [IF NOT EXISTS] name ( … );
  const create = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(([\s\S]*?)\n\)/gi;
  for (const match of source.matchAll(create)) {
    const [, table, body] = match;
    let depth = 0;
    let line = '';
    // Split on commas at depth zero so a CHECK(...) or numeric(10,2) does not
    // end a column definition early.
    for (const char of `${body},`) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        const trimmed = line.trim();
        if (trimmed && !CONSTRAINT.test(trimmed)) {
          const name = /^["']?(\w+)["']?/.exec(trimmed)?.[1];
          if (name) add(table, name);
        }
        line = '';
      } else {
        line += char;
      }
    }
  }

  // ALTER TABLE name ADD COLUMN [IF NOT EXISTS] col …  (including multi-column
  // ALTERs, which the suppliers table uses.)
  const alter = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?([\s\S]*?);/gi;
  for (const match of source.matchAll(alter)) {
    const [, table, body] = match;
    const addCol = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi;
    for (const col of body.matchAll(addCol)) add(table, col[1]);
  }

  return tables;
}

const declared = columnsFromSchema(schema);

let live;
try {
  live = await sql.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`);
} catch (error) {
  skipIfUnreachable('schema-drift', error);
  throw error;
}

// Views are projections, not tables the schema declares column-by-column.
const views = new Set((await sql.query(
  "SELECT table_name FROM information_schema.views WHERE table_schema = 'public'")).map((r) => r.table_name));

const actual = new Map();
for (const row of live) {
  if (views.has(row.table_name)) continue;
  if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
  actual.get(row.table_name).add(String(row.column_name).toLowerCase());
}

let failures = 0;
const report = (label, rows) => {
  if (rows.length === 0) { console.log(`  \x1b[32m✓\x1b[0m ${label}`); return; }
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${label}`);
  for (const row of rows) console.error(`      ${row}`);
};

console.log('\nEvery column in the database is in db/schema.sql');

const undeclared = [];
for (const [table, columns] of actual) {
  const fromFile = declared.get(table);
  // A table the file does not declare at all is the table-level check's job
  // (test:table-lists, test:neon-live), not this one.
  if (!fromFile) continue;
  for (const column of columns) {
    if (!fromFile.has(column)) undeclared.push(`${table}.${column} — a fresh environment would not have it`);
  }
}
report('no column exists only in the live database', undeclared);

console.log('\nEvery column in db/schema.sql is in the database');

const unapplied = [];
for (const [table, columns] of declared) {
  const fromDb = actual.get(table);
  if (!fromDb) continue;
  for (const column of columns) {
    if (!fromDb.has(column)) unapplied.push(`${table}.${column} — run npm run migrate:neon-schema`);
  }
}
report('no column is declared but missing', unapplied);

console.log('\nThe guard has teeth');

// A drift check that always passes is worse than none: it says the schema is
// sound while looking at nothing. Remove a column the database really has and
// confirm the comparison notices.
{
  const table = 'service_descriptions';
  const victim = 'signals';
  const stripped = new Map(declared);
  const withoutVictim = new Set(declared.get(table) ?? []);
  withoutVictim.delete(victim);
  stripped.set(table, withoutVictim);

  const wouldFlag = [...(actual.get(table) ?? [])].some((column) => !stripped.get(table).has(column));
  if (actual.get(table)?.has(victim) && wouldFlag) {
    console.log(`  \x1b[32m✓\x1b[0m removing ${table}.${victim} from the parse is detected`);
  } else {
    failures += 1;
    console.error(`  \x1b[31m✗\x1b[0m removing ${table}.${victim} from the parse is NOT detected`);
    console.error(`      the comparison would pass with a column missing — it is checking nothing`);
  }
}

console.log('\nThe parser itself is working');

const parserChecks = [
  ['it found a reasonable number of tables', declared.size >= 30, `${declared.size} tables parsed`],
  ['it picked up ALTER-added columns', declared.get('approval_entries')?.has('assignment_mode') === true,
    'approval_entries.assignment_mode was added by ALTER and should be seen'],
  ['it picked up CREATE-body columns', declared.get('requests')?.has('title') === true,
    'requests.title comes from the CREATE body'],
  ['it did not mistake a constraint for a column', declared.get('stage_history')?.has('primary') !== true,
    'a PRIMARY KEY line was read as a column'],
];
for (const [label, ok, detail] of parserChecks) {
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${detail}`); }
}

// ── Row-level security stays gone ───────────────────────────────────────────
// schema.sql carried 47 `ENABLE ROW LEVEL SECURITY` statements and 47 policies,
// all `FOR ALL USING (true) WITH CHECK (true)` — Supabase scaffolding that
// enforced nothing and read as access control. Removed 2026-09-12. Two ways it
// could come back: someone re-adds the statements to the file, or someone
// applies a policy straight to the database. Both are checked.
//
// This is not a rule against RLS. It is a rule against an *open* policy, which
// is the shape that looks like a control and is not. A policy that genuinely
// restricts something will fail this check, and the person adding it should
// update the check and say so in the ADR.
console.log('\nRow-level security is not back');

const rlsInFile = [...schema.matchAll(/^\s*(?:CREATE\s+POLICY|ALTER\s+TABLE\s+\S+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY)/gim)];
if (rlsInFile.length === 0) {
  console.log('  \x1b[32m✓\x1b[0m db/schema.sql declares no policies and enables RLS on nothing');
} else {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m db/schema.sql has ${rlsInFile.length} RLS statement(s) again`);
}

const livePolicies = await sql`SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'`;
const liveRls = await sql`
  SELECT c.relname AS tablename FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
`;
if (livePolicies.length === 0) {
  console.log('  \x1b[32m✓\x1b[0m the live database has no policies');
} else {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m the live database has ${livePolicies.length} polic(ies): `
    + livePolicies.map((r) => `${r.tablename}.${r.policyname}`).join(', '));
}
if (liveRls.length === 0) {
  console.log('  \x1b[32m✓\x1b[0m no live table has RLS enabled');
} else {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m RLS is enabled on: ${liveRls.map((r) => r.tablename).join(', ')}`);
}

// The applier used to discard every RLS statement, which is how the file came
// to describe 47 tables while the database carried one. A skip is a schema
// nobody gets, so the guard checks those rules went with the statements.
const applier = readFileSync(new URL('../../db/migrations/apply-neon-schema.mjs', import.meta.url), 'utf8');
if (!/CREATE\\s\+POLICY/.test(applier) && !/ENABLE\\s\+ROW/.test(applier)) {
  console.log('  \x1b[32m✓\x1b[0m the applier no longer skips RLS statements');
} else {
  failures += 1;
  console.error('  \x1b[31m✗\x1b[0m apply-neon-schema.mjs still skips RLS statements silently');
}

if (failures > 0) {
  console.error(`\nschema-drift: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nSchema matches the live database.');
