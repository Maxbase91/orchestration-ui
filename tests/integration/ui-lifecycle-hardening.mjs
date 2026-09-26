#!/usr/bin/env node
// Static regression checks for the UI lifecycle boundary. Browser tests cover
// rendering; these checks prevent future changes from bypassing governed writes.
import { readFileSync } from 'node:fs';

const newRequest = readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8');
const callOffBuilder = readFileSync('src/features/requests/new-request/call-off.ts', 'utf8');
// A call-off's details are asked in the conversation (call-off-agenda.ts) since
// the call-off form went with the Details step (2026-09-26).
const callOffAgenda = readFileSync('src/features/requests/new-request/conversation/call-off-agenda.ts', 'utf8');
const conversation = readFileSync('src/features/requests/new-request/conversation/intake-conversation.tsx', 'utf8');
const actionButtons = readFileSync('src/features/requests/request-detail/components/action-buttons.tsx', 'utf8');
const invoiceQueue = readFileSync('src/features/purchasing/invoice-queue-page.tsx', 'utf8');
const portalOnboarding = readFileSync('src/features/suppliers/portal/portal-onboarding.tsx', 'utf8');
const profileRisk = readFileSync('src/features/suppliers/components/profile-risk-tab.tsx', 'utf8');
const onboardingPipeline = readFileSync('src/features/suppliers/onboarding-pipeline-page.tsx', 'utf8');
const lifecycleStepper = readFileSync('src/features/requests/request-detail/components/lifecycle-stepper.tsx', 'utf8');

const checks = [
  ['Call-offs use the governed submission seam', newRequest.includes('submitCallOff') && newRequest.includes('submitGovernedCheckout')],
  // One intake page serves both densities, so a call-off is the same call-off
  // whichever view the requester is in — there is no longer a second page that
  // could route it differently.
  // Built once (call-off.ts) for the Channel page and for submit.
  ['Call-offs use the shared contract checkout', conversation.includes('applyCallOffAnswer(') && newRequest.includes('buildCallOff(') && callOffBuilder.includes("route: 'contract-call-off'")],
  ['A call-off is asked its timing and delivery', ["field: 'needBy'", "field: 'serviceEndDate'", "field: 'deliveryLocation'", "field: 'costCentre'"].every((field) => callOffAgenda.includes(field))],
  ['Workflow actions are role-gated', actionButtons.includes('roleCanAdvanceStage') && actionButtons.includes('canManageRequest')],
  ['Invoice queue exposes operational transitions', invoiceQueue.includes('useUpdateInvoice') && invoiceQueue.includes('Release payment') && invoiceQueue.includes('Variance')],
  ['Supplier onboarding exposes a persisted completion form', portalOnboarding.includes('useUpdateSupplier') && portalOnboarding.includes('onboarding-duns') && portalOnboarding.includes('Save for review')],
  ['Vendor-manager risk action requires a rationale', profileRisk.includes('recordRiskDecision') && profileRisk.includes('Risk decision rationale')],
  ['Procurement onboarding completion requires a note', onboardingPipeline.includes('Completion note') && onboardingPipeline.includes("onboardingStatus: 'completed'")],
  ['Terminal status without history is shown as intake', lifecycleStepper.includes('inconsistentTerminalState') && lifecycleStepper.includes('shown as intake until the record is repaired')],
  // A PO names a supplier other systems act on. Create PO fell back to
  // SUP-001 — a real supplier nobody chose — with the id as its name, and to
  // "today + 30 days" for a missing delivery date.
  ['A PO is never raised against an invented supplier', !/\?\?\s*'SUP-\d/.test(actionButtons) && actionButtons.includes('poBlockers')],
  ['A PO is never given an invented delivery date', !/Date\.now\(\)\s*\+\s*30\s*\*\s*86400/.test(actionButtons)],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log('UI lifecycle hardening checks passed.');
