#!/usr/bin/env node
// A semicolon inside a quoted string is not a statement boundary.
//
// The regression this pins: db/backfills/apply-sql.mjs split every backfill with
// a bare `.split(';')`, so the four semicolons living inside JSON payloads in
// the intake-compliance backfill — "exceeds standard threshold; VP approval
// required" and two like it — cut those rows in half. PostgreSQL rejected the
// fragments with `42601 unterminated quoted string` and the whole transaction
// rolled back, so the recovery could not run at all.
//
// The quieter half was the comment strip: a line filter dropped anything
// starting with `--` before knowing whether it was inside a literal. That one
// does not raise, it writes wrong data.
//
// Offline and no database: the splitter is pure, and this asserts against the
// committed backfill rather than a fixture, so the file that actually has to
// apply is the file under test.

import { readFileSync } from 'node:fs';
import { splitStatements } from '../../db/backfills/split-sql.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};

/** True when every `'` in the statement pairs up, `''` counting as an escape. */
const quotesBalanced = (statement) => {
  let open = false;
  for (let i = 0; i < statement.length; i++) {
    if (statement[i] !== "'") continue;
    if (open && statement[i + 1] === "'") { i += 1; continue; }
    open = !open;
  }
  return !open;
};

console.log('\nThe recovery backfill splits into whole statements');

const BACKFILL = 'db/backfills/2026-09-02-intake-compliance-records.sql';
const source = read(BACKFILL);
const statements = splitStatements(source);

// 39 rows, one per pre-cutover request. Naive splitting yields 43: the four
// semicolons inside JSON strings each add a spurious boundary.
check('exactly 39 statements', statements.length === 39, `got ${statements.length}`);
check('every one is an INSERT',
  statements.every((statement) => statement.startsWith('INSERT INTO')),
  statements.find((statement) => !statement.startsWith('INSERT INTO'))?.slice(0, 60));
check('every one has balanced quotes',
  statements.every(quotesBalanced),
  statements.find((s) => !quotesBalanced(s))?.slice(0, 80));
check('BEGIN and COMMIT are not sent',
  !statements.some((statement) => /^(BEGIN|COMMIT)/i.test(statement)));
// The evidence the split respected the strings rather than getting lucky.
check('the semicolons inside the payloads survived',
  statements.filter((s) => s.includes('threshold; VP approval required')).length === 3,
  `found ${statements.filter((s) => s.includes('threshold; VP approval required')).length}`);
check('and so did the one in the contract detail',
  statements.some((s) => s.includes('No existing contract found; contract must be executed')));

console.log('\nA statement ends only where a statement ends');

const one = (sql) => splitStatements(sql);
check('a semicolon inside a string does not split',
  one("INSERT INTO t VALUES ('a; b');").length === 1);
check('a real semicolon does',
  one("SELECT 1; SELECT 2;").length === 2);
check("'' is an escaped quote, not the end of the literal",
  one("INSERT INTO t VALUES ('it''s; fine');").length === 1);
check('a missing final semicolon still yields the statement',
  one('SELECT 1').length === 1);
check('an empty file yields nothing', one('').length === 0);
check('comments alone yield nothing', one('-- just a note\n/* and another */\n').length === 0);

console.log('\nComments are removed; text that looks like one is not');

check('a line comment is stripped',
  one('SELECT 1; -- trailing note\nSELECT 2;')[1] === 'SELECT 2');
check('a block comment is stripped',
  one('SELECT /* inline */ 1;')[0].replace(/\s+/g, ' ') === 'SELECT 1');
check('a double dash inside a string is data, not a comment',
  one("INSERT INTO t VALUES ('a -- b');")[0].includes("'a -- b'"));
check('a multi-line string keeps a line that starts with a double dash',
  one("INSERT INTO t VALUES ('first\n-- second\n');")[0].includes('-- second'));

console.log('\nDollar-quoted bodies are opaque');

const body = "CREATE FUNCTION f() RETURNS text AS $$ SELECT 'a; b'; -- note\n$$ LANGUAGE sql;";
check('a $$ body is one statement', one(body).length === 1);
check('and keeps what is inside it', one(body)[0].includes("'a; b'") && one(body)[0].includes('-- note'));
const tagged = "DO $tag$ BEGIN PERFORM 'x; y'; END $tag$;";
check('a $tag$ body is one statement', one(tagged).length === 1);

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All SQL splitter checks passed.');
process.exit(failures === 0 ? 0 : 1);
