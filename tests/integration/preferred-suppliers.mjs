#!/usr/bin/env node
// A category's preferred suppliers are a maintained list, and they are used.
//
// There was no list. `Supplier.preferred` was read by the preferred-supplier
// check and held by no column, so every "preferred" answer came from a
// performance heuristic nobody could see or correct; sourcing events went out
// without the category's preferred suppliers; and the supplier recommender kept
// its own hard-coded category → keyword map and printed an "accuracy" figure
// measured by nothing.
//
// Run: npm run test:preferred-suppliers

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourcingInvitees } from '../../src/lib/procurement/sourcing-invitees.ts';
import { isPreferredSupplier } from '../../src/lib/procurement/supplier-preference.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${label}\n      ${e.message}`); }
};

const directory = new Map([
  ['S1', { id: 'S1', name: 'Named Ltd' }],
  ['S2', { id: 'S2', name: 'Shortlisted Ltd' }],
  ['S3', { id: 'S3', name: 'Preferred A' }],
  ['S4', { id: 'S4', name: 'Preferred B' }],
]);
const lookup = (id) => (id ? directory.get(id) : undefined);

console.log('Sourcing invites the category’s preferred suppliers');
check('named, shortlist and preferred suppliers are all invited', () => {
  const out = sourcingInvitees({ namedSupplierId: 'S1', shortlistIds: ['S2'], preferredIds: ['S3', 'S4'], lookup });
  assert.deepEqual(out.map((i) => `${i.id}:${i.reason}`), ['S1:named', 'S2:shortlist', 'S3:preferred', 'S4:preferred']);
});
check('with nobody named, the preferred suppliers are still invited', () => {
  const out = sourcingInvitees({ namedSupplierId: null, shortlistIds: [], preferredIds: ['S3', 'S4'], lookup });
  assert.deepEqual(out.map((i) => i.id), ['S3', 'S4']);
});
check('a preferred supplier the requester also named is invited once, as named', () => {
  const out = sourcingInvitees({ namedSupplierId: 'S3', shortlistIds: [], preferredIds: ['S3', 'S4'], lookup });
  assert.deepEqual(out.map((i) => `${i.id}:${i.reason}`), ['S3:named', 'S4:preferred']);
});
check('an id not in the directory is not invited', () => {
  assert.equal(sourcingInvitees({ shortlistIds: [], preferredIds: ['GONE'], lookup }).length, 0);
});

console.log('\nThe list decides "preferred" when the category has one');
const strong = { id: 'S9', activeContracts: 3, riskRating: 'low', performanceScore: 95 };
const weak = { id: 'S8', activeContracts: 0, riskRating: 'low', performanceScore: 10 };
check('on the list → preferred, even if the old heuristic would say no', () =>
  assert.equal(isPreferredSupplier(weak, { preferredIds: ['S8'] }, DEFAULT_POLICY_CONFIG), true));
check('off the list → not preferred, even if the old heuristic would say yes', () =>
  assert.equal(isPreferredSupplier(strong, { preferredIds: ['S1'] }, DEFAULT_POLICY_CONFIG), false));
check('no list for the category → the heuristic still answers', () =>
  assert.equal(isPreferredSupplier(strong, { preferredIds: [] }, DEFAULT_POLICY_CONFIG), true));

console.log('\nThe screens read configuration, and claim nothing unmeasured');
const actions = read('src/features/requests/request-detail/components/action-buttons.tsx');
const recommender = read('src/features/requests/new-request/components/supplier-recommender-card.tsx');
const categoriesPage = read('src/features/admin/categories-page.tsx');
const dbBoundary = read('api/db.ts');
check('creating a sourcing event invites through sourcingInvitees with the category list', () => {
  assert.ok(/sourcingInvitees\(\{[\s\S]*preferredIds: preferredSupplierIds/.test(actions));
});
check('the recommender has no hard-coded category → keyword map', () =>
  assert.ok(!/CATEGORY_KEYWORDS/.test(recommender) && /supplierTags/.test(recommender)));
check('the recommender prints no accuracy figure', () => assert.ok(!/accuracy \$\{/.test(recommender)));
check('Categories maintains preferred suppliers and supplier tags', () =>
  assert.ok(/useSetCategoryPreferredSuppliers/.test(categoriesPage) && /cat-supplier-tags/.test(categoriesPage)));
check('the preferred-supplier table is reachable through /api/db', () =>
  assert.ok(dbBoundary.includes("'category_preferred_suppliers'")));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('Preferred suppliers are a maintained list, and it is used.');
