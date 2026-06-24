#!/usr/bin/env node
// Verifies supplier master-data completeness (RTE-04).
//
// Self-contained — mirrors src/lib/procurement/supplier-data.ts. Keep in sync.
// Run: node tests/integration/supplier-data.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

function evaluateSupplierData(supplier) {
  if (!supplier) return { complete: true, issues: [] };
  const issues = [];
  if (supplier.onboardingStatus === 'not-started') issues.push('Supplier not onboarded');
  else if (supplier.onboardingStatus === 'in-progress') issues.push('Supplier onboarding in progress');
  const expired = (supplier.certifications ?? []).filter((c) => c.status === 'expired').length;
  if (expired > 0) issues.push(`${expired} expired certification${expired > 1 ? 's' : ''}`);
  return { complete: issues.length === 0, issues };
}

console.log('Completeness');
check('no supplier → complete (not an issue)', evaluateSupplierData(undefined).complete);
check('fully onboarded, valid certs → complete', evaluateSupplierData({ onboardingStatus: 'completed', certifications: [{ status: 'valid' }] }).complete);
check('not-started onboarding → issue', !evaluateSupplierData({ onboardingStatus: 'not-started' }).complete);
check('in-progress onboarding → issue', !evaluateSupplierData({ onboardingStatus: 'in-progress' }).complete);
check('expired certification → issue', !evaluateSupplierData({ onboardingStatus: 'completed', certifications: [{ status: 'expired' }] }).complete);
check('multiple issues accumulate', evaluateSupplierData({ onboardingStatus: 'not-started', certifications: [{ status: 'expired' }, { status: 'expired' }] }).issues.length === 2);
check('expiring (not expired) cert is fine', evaluateSupplierData({ onboardingStatus: 'completed', certifications: [{ status: 'expiring' }] }).complete);

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All supplier-data checks passed.');
