#!/usr/bin/env node
// Static regression checks for the UI lifecycle boundary. Browser tests cover
// rendering; these checks prevent future changes from bypassing governed writes.
import { readFileSync } from 'node:fs';

const newRequest = readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8');
const simpleRequest = readFileSync('src/features/requests/new-request/simple-new-request-page.tsx', 'utf8');
const contractCheckout = readFileSync('src/features/requests/new-request/contract-call-off-checkout.tsx', 'utf8');
const actionButtons = readFileSync('src/features/requests/request-detail/components/action-buttons.tsx', 'utf8');
const invoiceQueue = readFileSync('src/features/purchasing/invoice-queue-page.tsx', 'utf8');
const portalOnboarding = readFileSync('src/features/suppliers/portal/portal-onboarding.tsx', 'utf8');

const checks = [
  ['Expert call-offs use the governed submission seam', newRequest.includes('submitContractCallOff') && newRequest.includes('submitGovernedCheckout')],
  ['Simple call-offs use the shared contract checkout', simpleRequest.includes('ContractCallOffCheckout') && simpleRequest.includes("route: requestRoute === 'catalogue' ? 'catalogue' as const : 'contract-call-off' as const")],
  ['Contract checkout captures call-off timing and delivery', contractCheckout.includes('calloff-start') && contractCheckout.includes('calloff-location')],
  ['Workflow actions are role-gated', actionButtons.includes('roleCanAdvanceStage') && actionButtons.includes('canManageRequest')],
  ['Invoice queue exposes operational transitions', invoiceQueue.includes('useUpdateInvoice') && invoiceQueue.includes('Release payment') && invoiceQueue.includes('Variance')],
  ['Supplier onboarding exposes a persisted completion form', portalOnboarding.includes('useUpdateSupplier') && portalOnboarding.includes('onboarding-duns') && portalOnboarding.includes('Save for review')],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log('UI lifecycle hardening checks passed.');
