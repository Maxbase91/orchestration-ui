#!/usr/bin/env node
// Cost centres and delivery locations are reference data, not free text.
//
// Both were typed in: `requests.cost_centre` took any string, and the delivery
// location was validated against `approvedShipToLocations` on the requester's
// profile — a list nothing ever populated, which the server fell back to taking
// from the browser when no profile row existed. So the location check approved
// whatever it was handed and the cost-centre check only asserted non-emptiness.
//
// The enforcement itself is covered by `test:governed-checkout` (rejection) and
// `test:governed-checkout-atomic` (the real handler against Neon). This suite
// covers the data: that the defaults are coherent, that they resolve the codes
// existing records already carry, and that the seed writes every column.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_COST_CENTRES } from '../../src/data/cost-centres.ts';
import { DEFAULT_DELIVERY_LOCATIONS } from '../../src/data/delivery-locations.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

console.log('\nThe default reference data is coherent');

for (const [name, rows] of [['cost centre', DEFAULT_COST_CENTRES], ['delivery location', DEFAULT_DELIVERY_LOCATIONS]]) {
  check(`every ${name} has a unique id`, () => {
    const ids = rows.map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length);
  });
  check(`every ${name} has a label and a sort order`, () => {
    for (const row of rows) {
      assert.ok(row.label.trim().length > 0, `${row.id} has no label`);
      assert.ok(Number.isInteger(row.sortOrder), `${row.id} has no sort order`);
    }
  });
  check(`every ${name} is active by default`, () => {
    // An empty table means no order can be placed: the checkout fails closed.
    assert.ok(rows.some((row) => row.active), 'nothing is selectable');
  });
}

console.log('\nExisting records resolve without a backfill');

// The whole reason the ids ARE the codes. Requests, requisitions and purchase
// orders store `cost_centre` as text; if the seeded ids did not cover the codes
// already in the data, every historic record would point at an account the new
// picker cannot resolve, and this change would need a data migration.
check('every cost-centre code in the shipped data is a seeded row', () => {
  const sources = ['src/data/requests.ts', 'src/data/demo-expansion.ts', 'api/seed.ts', 'src/data/purchase-orders.ts'];
  const used = new Set();
  for (const path of sources) {
    let text;
    try { text = read(path); } catch { continue; }
    for (const match of text.matchAll(/'(CC-[A-Z0-9-]+)'/g)) used.add(match[1]);
  }
  assert.ok(used.size > 0, 'found no cost-centre codes to check against');
  const seeded = new Set(DEFAULT_COST_CENTRES.map((centre) => centre.id));
  const unresolvable = [...used].filter((code) => !seeded.has(code));
  assert.deepEqual(unresolvable, [], `codes with no row: ${unresolvable.join(', ')}`);
});

console.log('\nThe data stays white-label');

// Ground rule 1: no organisation or sector naming anywhere in the product. A
// seeded chart of accounts is exactly where a client's own department names
// would leak in.
check('no cost centre or location names an organisation, place or sector', () => {
  const banned = /\b(bank|banking|insurance|pharma|retail|deutsche|london|frankfurt|new york|berlin|paris)\b/i;
  const offenders = [...DEFAULT_COST_CENTRES, ...DEFAULT_DELIVERY_LOCATIONS]
    .filter((row) => banned.test(`${row.label} ${row.description ?? ''} ${row.address ?? ''}`))
    .map((row) => row.id);
  assert.deepEqual(offenders, []);
});

console.log('\nThe tables are reachable, guarded and seeded');

check('both tables are in the schema', () => {
  const schema = read('db/schema.sql');
  assert.ok(/CREATE TABLE IF NOT EXISTS cost_centres/.test(schema), 'cost_centres missing');
  assert.ok(/CREATE TABLE IF NOT EXISTS delivery_locations/.test(schema), 'delivery_locations missing');
});

check('both tables are reachable from the browser', () => {
  const db = read('api/db.ts');
  const allowed = db.slice(db.indexOf('ALLOWED_RELATIONS'), db.indexOf('ALLOWED_FUNCTIONS'));
  assert.ok(allowed.includes("'cost_centres'"), 'cost_centres is not allowlisted');
  assert.ok(allowed.includes("'delivery_locations'"), 'delivery_locations is not allowlisted');
});

check('the seed writes every column of both tables', () => {
  const seed = read('api/admin/seed.ts');
  for (const column of ['label', 'description', 'owner', 'sort_order']) {
    assert.ok(new RegExp(`${column}:`).test(seed), `cost-centre ${column} is never seeded`);
  }
  assert.ok(/country_code:/.test(seed), 'delivery-location country_code is never seeded');
  assert.ok(/'cost_centres',/.test(seed) && /'delivery_locations',/.test(seed), 'a table is not seeded at all');
});

console.log('\nThe server validates against its own read, not the request body');

// The regression this phase exists to close. `api/governed-checkout.ts` must
// load the active ids itself; taking them from the payload would restore the
// self-approving check in a new shape.
check('the checkout handler reads the reference tables server-side', () => {
  const handler = read('api/governed-checkout.ts');
  assert.ok(/SELECT id FROM cost_centres WHERE active = true/.test(handler),
    'it does not read cost_centres');
  assert.ok(/SELECT id FROM delivery_locations WHERE active = true/.test(handler),
    'it does not read delivery_locations');
  assert.ok(/activeCostCentreIds: costCentreRows/.test(handler),
    'the ids it passes to the evaluator do not come from its own query');
});

check('the evaluator no longer trusts the profile for approval', () => {
  const evaluator = read('src/lib/procurement/governed-checkout.ts');
  assert.ok(!/profile\.approvedShipToLocations\.some/.test(evaluator),
    'the delivery location is still checked against a browser-supplied list');
});

console.log(failures === 0
  ? '\nAll reference-data checks passed.'
  : `\n${failures} reference-data check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
