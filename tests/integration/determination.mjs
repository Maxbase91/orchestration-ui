#!/usr/bin/env node
// Verifies contract-type and sourcing-type determination.
//
// Self-contained — mirrors src/lib/procurement/determination.ts. Keep in sync.
// Run: node tests/integration/determination.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

function determineContractType(i) {
  if (i.channel === 'catalogue' || i.channel === 'direct-po') return { type: 'none' };
  if (i.category === 'contract-renewal') return { type: 'renew' };
  if (i.channel === 'framework-call-off' || i.hasFrameworkOrContract) return { type: 'sow' };
  return { type: 'new-msa' };
}
function determineSourcingType(i) {
  if (i.channel === 'catalogue' || i.channel === 'direct-po' || i.channel === 'framework-call-off') return { type: 'none' };
  if (i.category === 'contract-renewal') return { type: 'renewal' };
  if (i.hasExistingSupplierRelationship) return { type: 'benchmarking' };
  return { type: 'new-event' };
}

console.log('Contract type');
check('catalogue → none', determineContractType({ channel: 'catalogue', category: 'goods', hasFrameworkOrContract: false }).type === 'none');
check('direct-po → none', determineContractType({ channel: 'direct-po', category: 'goods', hasFrameworkOrContract: false }).type === 'none');
check('contract-renewal category → renew', determineContractType({ channel: 'procurement-led', category: 'contract-renewal', hasFrameworkOrContract: true }).type === 'renew');
check('framework-call-off → sow', determineContractType({ channel: 'framework-call-off', category: 'services', hasFrameworkOrContract: true }).type === 'sow');
check('existing contract on supplier → sow', determineContractType({ channel: 'procurement-led', category: 'services', hasFrameworkOrContract: true }).type === 'sow');
check('no agreement → new-msa', determineContractType({ channel: 'procurement-led', category: 'consulting', hasFrameworkOrContract: false }).type === 'new-msa');

console.log('Sourcing type');
check('catalogue → none', determineSourcingType({ channel: 'catalogue', category: 'goods', hasExistingSupplierRelationship: false }).type === 'none');
check('framework-call-off → none', determineSourcingType({ channel: 'framework-call-off', category: 'services', hasExistingSupplierRelationship: true }).type === 'none');
check('contract-renewal category → renewal', determineSourcingType({ channel: 'procurement-led', category: 'contract-renewal', hasExistingSupplierRelationship: true }).type === 'renewal');
check('incumbent relationship → benchmarking', determineSourcingType({ channel: 'procurement-led', category: 'consulting', hasExistingSupplierRelationship: true }).type === 'benchmarking');
check('no relationship → new-event', determineSourcingType({ channel: 'procurement-led', category: 'consulting', hasExistingSupplierRelationship: false }).type === 'new-event');
check('business-led new supplier → new-event', determineSourcingType({ channel: 'business-led', category: 'goods', hasExistingSupplierRelationship: false }).type === 'new-event');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All determination checks passed.');
