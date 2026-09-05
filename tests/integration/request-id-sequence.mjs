#!/usr/bin/env node
// Request ids come from the database, not from Math.random().
//
// The wizard minted `REQ-2025-` + 4 random digits: 9,000 ids shared by every
// user, the year hardcoded, and a fresh id on every submit click. Two failures,
// not one:
//
//   Collision — by the birthday bound, more likely than not after ~112
//   requests. And a collision did NOT surface as a duplicate key: intake-submit
//   found the existing row and replayed it, so the new submission was silently
//   discarded and the requester got back an id belonging to someone else's
//   request, whose requisition and PO the governed checkout would then return.
//
//   Retry — because the id was regenerated per click, `checkout-${id}` and
//   `intake-${id}` differed on every attempt, so the idempotency index on
//   purchase_requisitions could never match a user-initiated retry. Every retry
//   made a second record instead of replaying the first.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireConnection, skipIfUnreachable } from '../lib/live.mjs';

loadEnv();
const connectionString = requireConnection('request-id-sequence');
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

console.log('\nThe random generator is gone');

const form = read('src/features/requests/new-request/intake-form-data.ts');
const page = read('src/features/requests/new-request/new-request-page.tsx');
check('intake-form-data no longer exports generateRequestId', () => {
  if (/generateRequestId/.test(form)) throw new Error('still there');
});
check('no Math.random id generator remains in the wizard', () => {
  if (/Math\.random/.test(form) || /Math\.random/.test(page)) throw new Error('still there');
});
check('the wizard has no call site left', () => {
  if (/generateRequestId/.test(page)) throw new Error('still calls it');
});

console.log('\nOne id per attempt, reused on retry');

check('the attempt id is held in a ref', () => {
  if (!/attemptIdRef/.test(page)) throw new Error('no ref');
  if (!/attemptIdRef\.current \?\?= await nextRequestId\(\)/.test(page)) throw new Error('not memoised per attempt');
});
check('the three submit paths share it', () => {
  const claims = page.match(/await claimRequestId\(\)/g) ?? [];
  if (claims.length !== 3) throw new Error(`${claims.length} call sites, expected 3`);
});
check('draft save deliberately mints its own', () => {
  if (!/const id = await nextRequestId\(\)/.test(page)) throw new Error('draft save does not mint separately');
});
check('the id is released once a submission is confirmed', () => {
  if (!/attemptIdRef\.current = null/.test(page)) throw new Error('never cleared, so the next demand reuses it');
});

console.log('\nThe fallback cannot burn the sequence');

const requests = read('src/lib/db/requests.ts');
check('nextRequestId calls the RPC', () => {
  if (!/db\.rpc\('next_request_id'\)/.test(requests)) throw new Error('no rpc call');
});
check('its degraded-mode id does NOT match the high-water pattern', () => {
  const match = requests.match(/return `REQ-\$\{new Date\(\)\.getFullYear\(\)\}-T\$\{Date\.now\(\)\.toString\(36\)\}`/);
  if (!match) throw new Error('fallback shape changed — re-check it against the setval pattern');
  // The literal a fallback would produce, tested against the schema's regex.
  const sample = `REQ-2026-T${Date.now().toString(36)}`;
  if (/^REQ-\d{4}-(\d+)$/.test(sample)) throw new Error(`${sample} would set the sequence`);
});

console.log('\nThe function is reachable through the one data boundary');

const dispatcher = read('api/db.ts');
check('next_request_id is allowlisted', () => {
  if (!/'next_request_id'/.test(dispatcher)) throw new Error('not in ALLOWED_FUNCTIONS');
});

console.log('\nThe sequence itself behaves');

let ids;
try {
  ids = (await sql.query('SELECT next_request_id() AS a, next_request_id() AS b, next_request_id() AS c'))[0];
} catch (error) {
  skipIfUnreachable('request-id-sequence', error);
  throw error;
}
check('it returns REQ-YYYY-NNNNN', () => {
  for (const id of [ids.a, ids.b, ids.c]) {
    if (!/^REQ-\d{4}-\d{5,}$/.test(id)) throw new Error(`${id} is not the expected shape`);
  }
});
check('successive calls strictly increase', () => {
  const [a, b, c] = [ids.a, ids.b, ids.c].map((id) => Number(id.split('-')[2]));
  if (!(a < b && b < c)) throw new Error(`${ids.a}, ${ids.b}, ${ids.c}`);
});
check('it clears every id already in the table', () => {
  const issued = Number(ids.a.split('-')[2]);
  if (issued <= 9970) throw new Error(`issued ${issued}, at or below the shipped high-water mark`);
});

const clash = await sql.query('SELECT count(*)::int AS n FROM requests WHERE id = $1 OR id = $2 OR id = $3',
  [ids.a, ids.b, ids.c]);
check('none of them collides with an existing request', () => {
  if (clash[0].n !== 0) throw new Error(`${clash[0].n} collisions`);
});

const above = await sql.query(
  "SELECT count(*)::int AS n FROM requests WHERE substring(id from '^REQ-\\d{4}-(\\d+)$')::bigint >= $1",
  [Number(ids.a.split('-')[2])]);
check('the high-water mark cleared every year, not just the latest', () => {
  if (above[0].n !== 0) throw new Error(`${above[0].n} existing ids at or above the sequence`);
});

if (failures > 0) {
  console.error(`\nrequest-id-sequence: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nRequest id sequence checks passed.');
