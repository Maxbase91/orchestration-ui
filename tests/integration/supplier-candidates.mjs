#!/usr/bin/env node
// Several suppliers can go to sourcing; exactly one drives the determination.
//
// Intake could name exactly one supplier, so a requester who knew two or three
// plausible vendors dropped all but one and re-entered them at the sourcing
// event. And "no supplier" was only expressible by leaving the field empty —
// which reads as an omission, not a decision.
//
// The constraint this suite protects: the determination stays SINGLE-supplier.
// Screening, risk reuse and contract coverage all run against one subject, and
// a compliance record that averaged several of them would stop meaning one
// thing. Candidates are a sourcing input, not a determination input.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateIntakeDetermination } from '../../src/lib/procurement/intake-determination.ts';
import { INITIAL_INTAKE_DATA } from '../../src/features/requests/new-request/intake-form-data.ts';
import { routingRules } from '../../src/data/routing-rules.ts';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

const SUPPLIERS = [
  { id: 'SUP-A', name: 'Supplier A', category: 'consulting', status: 'active', riskRating: 'low', screeningStatus: 'clear', onboardingStatus: 'completed', country: 'Ireland', countryCode: 'IE' },
  { id: 'SUP-B', name: 'Supplier B', category: 'consulting', status: 'active', riskRating: 'high', screeningStatus: 'clear', onboardingStatus: 'completed', country: 'Ireland', countryCode: 'IE' },
];

const determinationFor = (supplierId) => evaluateIntakeDetermination({
  category: 'consulting', estimatedValue: 120_000, supplierId, isUrgent: false,
  requestTitle: 'Advisory engagement', serviceDescription: { objective: 'Advice' },
  miniIrq: {}, now: '2026-09-01', suppliers: SUPPLIERS, contracts: [],
  matchingRiskAssessments: [], routingRules, approvalChains: [],
  validatorAgent: { name: 'Request Validator', status: 'active' },
});

console.log('\nThe form carries a preferred supplier, alternates, and an intent');

check('a new request starts with no candidates and no stated intent to source', () => {
  assert.deepEqual(INITIAL_INTAKE_DATA.supplierCandidateIds, []);
  assert.equal(INITIAL_INTAKE_DATA.supplierIntent, 'named');
  assert.equal(INITIAL_INTAKE_DATA.supplierId, '');
});

check('"go out to market" is a value, not an empty field', () => {
  // The distinction that matters: `supplierId: ''` with intent `named` means
  // "not chosen yet"; intent `to-be-sourced` means "decided: none".
  const intents = ['named', 'to-be-sourced'];
  assert.ok(intents.includes(INITIAL_INTAKE_DATA.supplierIntent));
});

console.log('\nThe determination still runs against exactly one supplier');

check('the determination takes a single supplierId, not a list', () => {
  const source = readFileSync(new URL('../../src/lib/procurement/intake-determination.ts', import.meta.url), 'utf8');
  const input = source.slice(source.indexOf('interface IntakeDeterminationInput'), source.indexOf('interface IntakeDetermination '));
  assert.ok(/supplierId: string;/.test(input), 'supplierId is no longer a single string');
  assert.ok(!/supplierCandidateIds/.test(source), 'the determination reads the candidate list');
});

check('the preferred supplier is the one screened and risk-read', () => {
  const low = determinationFor('SUP-A');
  const high = determinationFor('SUP-B');
  // Different preferred supplier, different risk read — proving the subject is
  // the preferred one and not an aggregate over candidates.
  assert.notDeepEqual(low.inherentRisk, high.inherentRisk);
});

check('naming no supplier still requires onboarding rather than assuming one', () => {
  const none = determinationFor('');
  assert.equal(none.supplierOnboardingRequired, true);
});

console.log('\nCandidates are persisted as their own records');

check('the table is registered everywhere it has to be', () => {
  const schema = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');
  assert.ok(/CREATE TABLE IF NOT EXISTS request_supplier_candidates/.test(schema));
  assert.ok(/PRIMARY KEY \(request_id, supplier_id\)/.test(schema), 'no composite key — a retry would duplicate rows');
  const db = readFileSync(new URL('../../api/db.ts', import.meta.url), 'utf8');
  assert.ok(db.slice(db.indexOf('ALLOWED_RELATIONS'), db.indexOf('ALLOWED_FUNCTIONS'))
    .includes("'request_supplier_candidates'"), 'not reachable from the browser');
});

check('the write is idempotent on the composite key', () => {
  const module = readFileSync(new URL('../../src/lib/db/request-supplier-candidates.ts', import.meta.url), 'utf8');
  assert.ok(/onConflict: 'request_id,supplier_id'/.test(module),
    'a resubmitted request would duplicate its candidate rows');
});

// The request is already created when candidates are written. A failure here
// must not roll it back, and must not be swallowed either.
check('a failed candidate write reports itself instead of failing silently', () => {
  const page = readFileSync(new URL('../../src/features/requests/new-request/new-request-page.tsx', import.meta.url), 'utf8');
  const block = page.slice(page.indexOf('saveRequestSupplierCandidates(candidates)'));
  assert.ok(/catch/.test(block.slice(0, 400)), 'the write is unguarded');
  assert.ok(/toast\.(warning|error)/.test(block.slice(0, 600)), 'a failure is never surfaced');
});

console.log(failures === 0
  ? '\nAll supplier-candidate checks passed.'
  : `\n${failures} supplier-candidate check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
