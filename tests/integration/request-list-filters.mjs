#!/usr/bin/env node
// Every link into the request list builds its URL the way the list reads it.
//
// Four surfaces linked to /requests with a filter and the list read none of
// them, so each opened the full, unfiltered list: the attention band's "past
// the stage SLA" landed on every request in the system. The links did not even
// share a spelling — `overdue=1` in one place, `overdue=true` in another. The
// contract now lives in request-list-filters.ts; this holds it there.
//
// Run: npm run test:request-list-filters

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import {
  REQUEST_STATUSES, applyRequestListFilters, parseRequestListFilters, requestListHref,
} from '../../src/lib/procurement/request-list-filters.ts';
import { overdueOnMyPlate, referredBackToMe } from '../../src/lib/procurement/personal-queue.ts';

const ROOT = new URL('../../', import.meta.url);
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };
const check = (label, fn) => { try { fn(); ok(label); } catch (e) { bad(label, e.message); } };
const parse = (href) => parseRequestListFilters(new URL(href, 'http://x').searchParams);

console.log('A URL the builder writes is a URL the list reads');
for (const filters of [
  { status: 'sourcing' }, { overdue: true }, { view: 'my-overdue' }, { view: 'sent-back-to-me' },
  { view: 'my-overdue', status: 'approval' },
]) {
  check(`round trip ${JSON.stringify(filters)}`, () => {
    const { ignored, ...back } = parse(requestListHref(filters));
    assert.deepEqual(ignored, []);
    assert.deepEqual(back, filters);
  });
}
check('no filters is the bare path', () => assert.equal(requestListHref({}), '/requests'));

console.log('\nA parameter the list does not understand is reported, not dropped');
check('a misspelt stage', () => assert.deepEqual(parse('/requests?status=aproval').ignored, ['status=aproval']));
check('the other spelling of overdue', () => assert.deepEqual(parse('/requests?overdue=true').ignored, ['overdue=true']));
check('an unknown view', () => assert.deepEqual(parse('/requests?view=everything').ignored, ['view=everything']));
check('every real stage is accepted', () => {
  for (const s of REQUEST_STATUSES) assert.equal(parse(requestListHref({ status: s })).status, s);
});

console.log('\nThe personal views are personal-queue.ts, not a second definition of it');
const rows = [
  { id: 'a', status: 'sourcing', ownerId: 'u1', requestorId: 'u9', isOverdue: true },
  { id: 'b', status: 'sourcing', ownerId: 'u9', requestorId: 'u9', isOverdue: true },
  { id: 'c', status: 'referred-back', ownerId: 'u9', requestorId: 'u1', isOverdue: false },
  { id: 'd', status: 'referred-back', ownerId: 'u1', requestorId: 'u9', isOverdue: false },
];
const ids = (list) => list.map((r) => r.id);
check('my-overdue = overdueOnMyPlate — the count on the band is the rows behind its link', () =>
  assert.deepEqual(ids(applyRequestListFilters(rows, { view: 'my-overdue' }, 'u1')), ids(overdueOnMyPlate(rows, 'u1'))));
check('sent-back-to-me = referredBackToMe', () =>
  assert.deepEqual(ids(applyRequestListFilters(rows, { view: 'sent-back-to-me' }, 'u1')), ids(referredBackToMe(rows, 'u1'))));
check('overdue alone is everyone’s', () =>
  assert.deepEqual(ids(applyRequestListFilters(rows, { overdue: true }, 'u1')), ['a', 'b']));
check('filters combine with AND', () =>
  assert.deepEqual(ids(applyRequestListFilters(rows, { view: 'my-overdue', status: 'approval' }, 'u1')), []));

// ── Nobody hand-builds a filtered list URL again ───────────────────────────
console.log('\nNo module writes a /requests?… URL by hand');
function sources(dir, out = []) {
  for (const entry of readdirSync(new URL(dir, ROOT))) {
    const rel = `${dir}${entry}`;
    if (statSync(new URL(rel, ROOT)).isDirectory()) sources(`${rel}/`, out);
    else if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}
const HAND_BUILT = /['"`]\/requests(?:\/my)?\?/;
const offenders = sources('src/').filter((f) => HAND_BUILT.test(readFileSync(new URL(f, ROOT), 'utf8')));
if (offenders.length) bad(`${offenders.length} module(s) build a list URL by hand`, `${offenders.join(', ')} — use requestListHref`);
else ok('every filtered link goes through requestListHref');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('One URL contract for the request list.');
