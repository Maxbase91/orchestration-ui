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
//
// It now also pins the *determination*, which was the larger divergence: Simple
// skipped the risk and determination screens entirely, so it derived its own
// channel from a preliminary signal read and recorded no checks at all, while
// Expert ran the full cascade. Both densities now call one evaluator, and the
// only way to keep that true is to assert that the evaluator cannot even tell
// which density it is serving.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  evaluateGovernedCheckout,
  resolveCheckoutContract,
  resolveCheckoutRiskAssessment,
} from '../../src/lib/procurement/governed-checkout.ts';
import { evaluateIntakeDetermination } from '../../src/lib/procurement/intake-determination.ts';
import { buildIntakeComplianceRecord } from '../../src/lib/procurement/intake-compliance-record.ts';
import { resolveDemandChannel } from '../../src/lib/routing/demand-channel.js';
import { routingRules } from '../../src/data/routing-rules.ts';

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

// ── The determination cannot know which density it is serving ───────────────

console.log('\nOne determination, whichever view the requester is in');

const determinationSupplier = (id, overrides = {}) => ({
  id, name: `Supplier ${id}`, country: 'Germany', countryCode: 'DE', riskRating: 'low',
  activeContracts: 1, totalSpend12m: 250000, onboardingStatus: 'completed',
  sraStatus: 'valid', sraExpiryDate: '2027-01-01', screeningStatus: 'clear',
  categories: ['services'], tier: 2, duns: '123456789', address: '1 Example Street',
  primaryContact: 'A. Contact', primaryContactEmail: 'contact@example.com',
  certifications: [], spendHistory: [], performanceScore: 80, ...overrides,
});
const DET_SUPPLIERS = [
  determinationSupplier('SUP-1'),
  determinationSupplier('SUP-EXPIRED', { sraStatus: 'expired', sraExpiryDate: '2026-01-01' }),
];
const bandedChain = (id, threshold) => ({ id, name: id, threshold, description: '', steps: [], referencedBy: [] });
const DET_CHAINS = [bandedChain('AC-001', '< €50,000'), bandedChain('AC-002', '> €50,000')];

const DEMANDS = {
  'goods, €8k': { category: 'goods', estimatedValue: 8000 },
  'software with personal data, €30k': {
    category: 'software', estimatedValue: 30000,
    serviceDescription: { objective: 'CRM licences', scope: 'Holds customer personal data' },
  },
  'material consulting, €400k': { category: 'consulting', estimatedValue: 400000 },
  'urgent services': { isUrgent: true },
  'supplier with an expired SRA': { supplierId: 'SUP-EXPIRED' },
  'no supplier chosen': { supplierId: '' },
};

const determine = (overrides) => evaluateIntakeDetermination({
  category: 'services', estimatedValue: 8000, supplierId: 'SUP-1', isUrgent: false,
  requestTitle: 'Cleaning services', serviceDescription: { objective: 'Weekly cleaning' },
  miniIrq: { privilegedAccess: false, criticalService: false }, now: '2026-09-01',
  suppliers: DET_SUPPLIERS, contracts: [], matchingRiskAssessments: [], routingRules,
  approvalChains: DET_CHAINS, validatorAgent: { name: 'Request Validator', status: 'active' },
  ...overrides,
});

check('the determination takes no density argument at all', () => {
  const source = readFileSync(
    new URL('../../src/lib/procurement/intake-determination.ts', import.meta.url), 'utf8');
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
  // The strongest available form of "the two modes differ only in UI": the
  // decision layer has no way to behave differently, because it is never told.
  assert.equal(/\b(density|experienceMode)\b/.test(code), false);
  assert.equal(/['\"]simple['\"]|['\"]expert['\"]/.test(code), false);
});

check('the compliance record is identical for the same demand', () => {
  for (const [name, overrides] of Object.entries(DEMANDS)) {
    const at = '2026-09-01T00:00:00Z';
    // Both densities call one builder over one determination; building twice is
    // the closest a pure test can get to "Simple submitted it" vs "Expert did".
    const simple = buildIntakeComplianceRecord(determine(overrides), { determinedAt: at });
    const expert = buildIntakeComplianceRecord(determine(overrides), { determinedAt: at });
    assert.deepEqual(simple, expert, name);
  }
});

check('neither density can record a check that did not run', () => {
  for (const [name, overrides] of Object.entries(DEMANDS)) {
    const record = buildIntakeComplianceRecord(determine(overrides), { determinedAt: '2026-09-01T00:00:00Z' });
    assert.equal(record.duplicateCheck.performed, false, `${name}: duplicate search`);
    const supplierRec = DET_SUPPLIERS.find((s) => s.id === (overrides.supplierId ?? 'SUP-1'));
    if (supplierRec && supplierRec.sraStatus !== 'valid') {
      assert.notEqual(record.sraCheck.status, 'pass', `${name}: SRA`);
    }
  }
});

check('the channel is resolved once — P-card eligibility on both paths or neither', () => {
  for (const [name, overrides] of Object.entries(DEMANDS)) {
    const result = determine(overrides);
    const direct = resolveDemandChannel(routingRules, {
      category: overrides.category ?? 'services',
      value: overrides.estimatedValue ?? 8000,
      supplierId: overrides.supplierId ?? 'SUP-1',
      isUrgent: overrides.isUrgent ?? false,
      riskRating: result.inherentRisk.tier,
      material: result.materiality.material,
      pCardEligible: result.pCardEligible,
    });
    assert.equal(result.buyingChannelSlug, direct.channel, name);
  }
});

check('there is one intake page, not one per density', () => {
  // The strongest form of the guarantee: there is no second implementation to
  // drift. Two pages shared components and helpers and still managed to produce
  // different governance outcomes twice — once by resolving contracts on
  // supplier name, once by recording checks that never ran.
  assert.equal(
    existsSync(new URL('../../src/features/requests/new-request/simple-new-request-page.tsx', import.meta.url)),
    false,
    'a second intake page has reappeared',
  );
  const page = readFileSync(
    new URL('../../src/features/requests/new-request/new-request-page.tsx', import.meta.url), 'utf8');
  // Density may pick chrome and how much evidence is shown. It must never pick
  // a step, a gate, or what gets written.
  assert.equal(/density === 'simple' \? [^\n]*setStepId/.test(page), false, 'density branches the journey');
  assert.equal(/if \(density === '(simple|expert)'\) \{[\s\S]{0,400}submitIntake/.test(page), false, 'density branches the submit');
});

check('the decision layer imports nothing from the feature layer', () => {
  for (const module of ['intake-determination.ts', 'intake-compliance-record.ts']) {
    const source = readFileSync(
      new URL(`../../src/lib/procurement/${module}`, import.meta.url), 'utf8');
    assert.equal(/from ['\"]react['\"]/.test(source), false, module);
    assert.equal(/@\/features\//.test(source), false, module);
  }
});

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All mode-equivalence checks passed.');
process.exit(failures === 0 ? 0 : 1);
