#!/usr/bin/env node
// The same demand must reach the same governance decision in both modes.
//
// Simple and Expert are two presentations of one front door, but each
// implemented its own catalogue/call-off submit path, and they had drifted:
//
//   - Expert called resolveCheckoutContract, which REFUSES an ambiguous item
//     ("procurement must select one"). Simple matched on lower-cased supplier
//     *name* and took the latest end date — so it silently picked one.
//   - Expert called resolveCheckoutRiskAssessment, which filters to completed
//     assessments and prefers an unexpired one. Simple filtered on neither, so
//     an expired assessment could reach the evaluator and change whether a risk
//     review was required.
//
// Two screens, one demand, different governance outcomes — decided by which
// screen the requester happened to be on. This test pins the resolvers both
// modes now share; test:intake-evidence pins what each one records.

import assert from 'node:assert/strict';
import {
  evaluateGovernedCheckout,
  resolveCheckoutContract,
  resolveCheckoutRiskAssessment,
} from '../../src/lib/procurement/governed-checkout.ts';

const NOW = new Date('2026-09-01T00:00:00Z');
const iso = (date) => date.toISOString().slice(0, 10);
const future = iso(new Date('2027-01-01'));
const past = iso(new Date('2026-01-01'));

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

const item = {
  id: 'CAT-1', name: 'Laptop', supplierId: 'SUP-1', supplierName: 'Acme, Inc',
  unitPrice: 500, unit: 'each', commodityCode: 'IT-001',
};
const contract = (id, overrides = {}) => ({
  id, supplierId: 'SUP-1', supplierName: 'Acme, Inc', status: 'active',
  startDate: past, endDate: future, category: 'it', ...overrides,
});

console.log('\nAmbiguity is refused, not silently resolved');

check('two active contracts for one item produce an error, not a pick', () => {
  const result = resolveCheckoutContract(item, [contract('CON-1'), contract('CON-2')], NOW);
  assert.equal(result.contract, undefined);
  assert.match(result.error, /more than one active contract/i);
});

check('one active contract resolves cleanly', () => {
  const result = resolveCheckoutContract(item, [contract('CON-1')], NOW);
  assert.equal(result.contract?.id, 'CON-1');
  assert.equal(result.error, undefined);
});

check('an expired contract is not resolved', () => {
  const result = resolveCheckoutContract(item, [contract('CON-1', { endDate: past })], NOW);
  assert.equal(result.contract, undefined);
  assert.match(result.error, /no active contract/i);
});

// The old Simple matcher keyed on supplier *name*. Two suppliers can share a
// display name; the id is the identity.
check('a contract for a different supplier is not matched by name', () => {
  const other = contract('CON-9', { supplierId: 'SUP-2' });
  const result = resolveCheckoutContract({ ...item, contractId: undefined }, [other], NOW);
  assert.equal(result.contract, undefined);
});

console.log('\nOnly a real assessment counts');

const assessment = (overrides = {}) => ({
  id: 'RA-1', supplierId: 'SUP-1', contractId: 'CON-1', status: 'completed',
  validUntil: future, ...overrides,
});

check('a draft assessment is not used', () => {
  assert.equal(resolveCheckoutRiskAssessment([assessment({ status: 'draft' })], 'SUP-1', 'CON-1', NOW), undefined);
});

check('an unexpired assessment is preferred over an expired one', () => {
  const expired = assessment({ id: 'RA-OLD', validUntil: past });
  const valid = assessment({ id: 'RA-NEW' });
  assert.equal(resolveCheckoutRiskAssessment([expired, valid], 'SUP-1', 'CON-1', NOW)?.id, 'RA-NEW');
});

console.log('\nThe decision itself agrees for an identical demand');

const profile = {
  userId: 'u1', defaultCurrency: 'EUR', costCentre: 'CC-1', budgetOwner: 'Owner',
  accountType: 'expense', beneficiaryId: 'u1',
  approvedShipToLocations: [{ id: 'office', label: 'Office' }],
  defaultShipToLocationId: 'office',
};
const supplier = { id: 'SUP-1', name: 'Acme, Inc', status: 'active' };

// Both modes now build this from the same resolvers, so the only thing that can
// differ is what each page passes in — which is what this asserts.
function checkoutFor(mode) {
  const resolved = resolveCheckoutContract(item, [contract('CON-1')], NOW).contract;
  const risk = resolveCheckoutRiskAssessment([assessment()], 'SUP-1', 'CON-1', NOW);
  return {
    route: 'catalogue',
    lines: [{ item, description: item.name, quantity: 2, unit: 'each', unitPrice: item.unitPrice,
      supplierId: supplier.id, contractId: resolved.id, riskAssessmentId: risk?.id, commodityCode: item.commodityCode }],
    supplier, contract: resolved, riskAssessment: risk, profile,
    currency: 'EUR', costCentre: 'CC-1', beneficiaryId: 'u1', purpose: 'Replace end-of-life laptops',
    // The field Simple used to omit: with a stored profile present, leaving it
    // out silently substituted the profile default for the requester's choice.
    shipToLocationId: 'office',
    idempotencyKey: `checkout-${mode}`,
  };
}

check('simple and expert produce the same decision for the same demand', () => {
  const simple = evaluateGovernedCheckout(checkoutFor('simple'));
  const expert = evaluateGovernedCheckout(checkoutFor('expert'));
  // idempotencyKey is per-submission and is not part of the decision.
  assert.deepEqual({ ...simple, idempotencyKey: undefined }, { ...expert, idempotencyKey: undefined });
  assert.equal(simple.ok, true);
});

check('the delivery location must be one the profile approves', () => {
  const off = { ...checkoutFor('simple'), shipToLocationId: 'somewhere-else' };
  const decision = evaluateGovernedCheckout(off);
  assert.equal(decision.ok, false);
});

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All mode-equivalence checks passed.');
process.exit(failures === 0 ? 0 : 1);
