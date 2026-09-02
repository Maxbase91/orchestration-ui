#!/usr/bin/env node
// The hand-maintained table lists must agree with the schema.
//
// The schema is defined once, in db/schema.sql, and then re-listed by hand:
//
//   api/db.ts                                   ALLOWED_RELATIONS — what the browser may reach
//   tests/integration/neon-live-validation.mjs  expectedTables — what the live guard checks
//
// They drifted once, silently and lossily: `intake_compliance_records` is in
// the schema, is in ALLOWED_RELATIONS, and is written on every intake — but it
// was in neither the migration's copy list nor the guard. Thirty-nine rows of
// intake determination, the evidence the Compliance tab reads, were left behind
// and nothing said so. (The copy list is gone with the migration; those rows are
// now recovered by db/backfills/2026-09-02-intake-compliance-records.sql.)
//
// This does not merge the lists — they serve different purposes, and a table can
// legitimately be in one and not the other. It requires every difference to be
// *declared*, so an omission has to be deliberate.

import { existsSync, readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
};

/** Table names from a `const NAME = [ 'a', 'b' ];` literal. */
function listFrom(source, name) {
  const start = source.indexOf(`${name} = [`);
  if (start === -1) return null;
  const body = source.slice(start, source.indexOf('];', start));
  return new Set([...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
}

/** Table names from a `new Set([...])` literal. */
function setFrom(source, name) {
  const start = source.indexOf(`${name} = new Set([`);
  if (start === -1) return null;
  const body = source.slice(start, source.indexOf(']);', start));
  return new Set([...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
}

const SCHEMA = read('db/schema.sql');
const schemaTables = new Set(
  [...SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase()),
);
const schemaViews = new Set(
  [...SCHEMA.matchAll(/CREATE (?:OR REPLACE )?VIEW\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase()),
);

const allowed = setFrom(read('api/db.ts'), 'ALLOWED_RELATIONS');
const guarded = listFrom(read('tests/integration/neon-live-validation.mjs'), 'const expectedTables');

console.log('\nEvery list was found and parsed');
check('schema.sql defines tables', schemaTables.size > 30, `${schemaTables.size} tables`);
check('api/db.ts ALLOWED_RELATIONS', allowed && allowed.size > 30, `${allowed?.size}`);
check('the post-migration guard list', guarded && guarded.size > 30, `${guarded?.size}`);

const missing = (from, against) => [...from].filter((table) => !against.has(table));

console.log('\nNothing is exposed or expected that the schema does not define');
check('every allowlisted relation is a schema table or view',
  missing(allowed, new Set([...schemaTables, ...schemaViews])).length === 0,
  missing(allowed, new Set([...schemaTables, ...schemaViews])).join(', '));
check('every guarded table is defined in the schema',
  missing(guarded, schemaTables).length === 0, missing(guarded, schemaTables).join(', '));

console.log('\nNothing the app can write is left out of the guard');
// A relation the browser may write is application-owned data. If it is not
// guarded, nothing reports when it goes missing from the live database.
const writable = [...allowed].filter((table) => schemaTables.has(table));
check('every writable table is in the live guard',
  missing(new Set(writable), guarded).length === 0,
  missing(new Set(writable), guarded).join(', '));

// Named explicitly: this is the table whose omission lost data.
console.log('\nThe one that was actually lost');
check('its recovery backfill is committed',
  existsSync(new URL('db/backfills/2026-09-02-intake-compliance-records.sql', ROOT)));
check('intake_compliance_records is guarded', guarded.has('intake_compliance_records'));
check('intake_compliance_records is reachable', allowed.has('intake_compliance_records'));

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All table-list checks passed.');
process.exit(failures === 0 ? 0 : 1);
