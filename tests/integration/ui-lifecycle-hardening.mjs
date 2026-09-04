#!/usr/bin/env node
// Static regression checks for the UI lifecycle boundary. Browser tests cover
// rendering; these checks prevent future changes from bypassing governed writes.
import { readFileSync } from 'node:fs';

const newRequest = readFileSync('src/features/requests/new-request/new-request-page.tsx', 'utf8');
const contractCheckout = readFileSync('src/features/requests/new-request/contract-call-off-checkout.tsx', 'utf8');
const actionButtons = readFileSync('src/features/requests/request-detail/components/action-buttons.tsx', 'utf8');
const invoiceQueue = readFileSync('src/features/purchasing/invoice-queue-page.tsx', 'utf8');
const portalOnboarding = readFileSync('src/features/suppliers/portal/portal-onboarding.tsx', 'utf8');
const profileRisk = readFileSync('src/features/suppliers/components/profile-risk-tab.tsx', 'utf8');
const onboardingPipeline = readFileSync('src/features/suppliers/onboarding-pipeline-page.tsx', 'utf8');
const lifecycleStepper = readFileSync('src/features/requests/request-detail/components/lifecycle-stepper.tsx', 'utf8');

const checks = [
  ['Expert call-offs use the governed submission seam', newRequest.includes('submitContractCallOff') && newRequest.includes('submitGovernedCheckout')],
  // One intake page serves both densities, so a call-off is the same call-off
  // whichever view the requester is in — there is no longer a second page that
  // could route it differently.
  ['Call-offs use the shared contract checkout', newRequest.includes('ContractCallOffCheckout') && newRequest.includes("route: 'contract-call-off' as const")],
  ['Contract checkout captures call-off timing and delivery', contractCheckout.includes('calloff-start') && contractCheckout.includes('calloff-location')],
  ['Workflow actions are role-gated', actionButtons.includes('roleCanAdvanceStage') && actionButtons.includes('canManageRequest')],
  ['Invoice queue exposes operational transitions', invoiceQueue.includes('useUpdateInvoice') && invoiceQueue.includes('Release payment') && invoiceQueue.includes('Variance')],
  ['Supplier onboarding exposes a persisted completion form', portalOnboarding.includes('useUpdateSupplier') && portalOnboarding.includes('onboarding-duns') && portalOnboarding.includes('Save for review')],
  ['Vendor-manager risk action requires a rationale', profileRisk.includes('recordRiskDecision') && profileRisk.includes('Risk decision rationale')],
  ['Procurement onboarding completion requires a note', onboardingPipeline.includes('Completion note') && onboardingPipeline.includes("onboardingStatus: 'completed'")],
  ['Terminal status without history is shown as intake', lifecycleStepper.includes('inconsistentTerminalState') && lifecycleStepper.includes('shown as intake until the record is repaired')],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log('UI lifecycle hardening checks passed.');
