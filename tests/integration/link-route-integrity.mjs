#!/usr/bin/env node
// Static guard for the internal navigation contract. Runtime Playwright tests
// prove destinations render; this check catches accidental route renames or
// replacement of deep links with the dashboard fallback during refactors.
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.tsx', 'utf8');
const overview = await readFile('src/features/requests/request-detail/tab-overview.tsx', 'utf8');
const related = await readFile('src/features/requests/request-detail/tab-related.tsx', 'utf8');
const expiring = await readFile('src/features/dashboard/widgets/widget-expiring-contracts.tsx', 'utf8');

const checks = [
  ['request detail route exists', app.includes('path="/requests/:id"')],
  ['supplier detail route exists', app.includes('path="/suppliers/:id"')],
  ['contract detail route exists', app.includes('path="/contracts/:id"')],
  ['sourcing detail route exists', app.includes('path="/sourcing/:id"')],
  ['purchase-order detail route exists', app.includes('path="/purchasing/orders/:id"')],
  ['request overview deep-links supplier by id', overview.includes('`/suppliers/${supplier.id}`')],
  // These deep links used to exist only on the separate Simple request-detail
  // page. That page is gone; the links moved to the Related tab rather than
  // being lost with it, PO entitlement included.
  ['request detail deep-links its contract by id', related.includes('`/contracts/${contract.id}`')],
  ['request detail deep-links its PO only through an entitled branch', related.includes('canOpenPurchaseOrders ?')],
  ['expiring-contract widget deep-links contract by id', expiring.includes('navigate(`/contracts/${c.id}`)')],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exitCode = 1;
