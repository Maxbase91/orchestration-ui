#!/usr/bin/env node
// Every action that changes a request refreshes everything that shows it.
//
// Each action used to pick its own subset of caches by hand, and the subsets
// disagreed. Reassigning invalidated only `requests` although the server also
// wrote stage history, so the handover appeared nowhere until a reload.
// Referring back missed approvals and the workflow instance. Creating a PO
// refreshed purchase orders and not the request it belonged to. Approving from
// the Approvals tab refreshed approvals alone. Every one of those left a screen
// showing something that was no longer true — the reported "I approved one
// request and it didn't refresh automatically".
//
// Static by design: this is about which call sites exist, not about behaviour a
// live database can demonstrate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

console.log('\nThe lifecycle key set is one list');

const client = read('src/lib/query-client.ts');
check('it exists and is exported', () => {
  assert.match(client, /export const REQUEST_LIFECYCLE_KEYS/);
  assert.match(client, /export function invalidateRequestViews/);
});
for (const key of ['requests', 'stage-history', 'approvals', 'workflow-instances', 'audit-entries', 'purchase-orders']) {
  check(`it covers ${key}`, () => {
    assert.match(client, new RegExp(`'${key}'`), `${key} is missing, so screens reading it go stale`);
  });
}

console.log('\nEvery action that moves a request uses it');

const SURFACES = [
  ['request header actions', 'src/features/requests/request-detail/components/action-buttons.tsx'],
  ['approvals tab', 'src/features/requests/request-detail/tab-approvals.tsx'],
  ['approvals queue', 'src/features/approvals/components/approval-card.tsx'],
  ['reassign', 'src/features/requests/request-detail/components/reassign-dialog.tsx'],
  ['refer back', 'src/features/requests/request-detail/components/refer-back-dialog.tsx'],
  ['escalate', 'src/features/requests/request-detail/components/escalate-dialog.tsx'],
  // The Active Workflows board is not here: it is view-only since 2026-09-26
  // and moves nothing, so it has nothing to refresh (test:workflows-board-ui).
];
for (const [label, path] of SURFACES) {
  check(`${label} refreshes the whole set`, () => {
    assert.match(read(path), /invalidateRequestViews\(/, 'still picks its own subset by hand');
  });
}

check('raising a PO refreshes the request it belongs to', () => {
  assert.match(read('src/lib/db/hooks/use-purchase-orders.ts'), /invalidateRequestViews\(/,
    'the order list refreshes and the request does not');
});
check('a goods receipt refreshes the request it moved', () => {
  const hook = read('src/lib/db/hooks/use-goods-receipts.ts');
  assert.match(hook, /'requests'/, 'the request keeps its old stage on screen');
  assert.match(hook, /'stage-history'/, 'the timeline does not show the receipt');
});

console.log('\nNobody is left picking their own subset');

for (const [label, path] of SURFACES) {
  check(`${label} has no leftover single-key calls`, () => {
    const source = read(path);
    const singles = source.match(/invalidateQueries\(\{ queryKey: \['[a-z-]+'\] \}\)/g) ?? [];
    assert.equal(singles.length, 0,
      `${singles.length} hand-picked invalidation(s) remain: ${singles.join(', ')}`);
  });
}

if (failures > 0) { console.error(`\nrefresh-after-action: ${failures} check(s) failed.`); process.exit(1); }
console.log('\nRefresh-after-action checks passed.');
