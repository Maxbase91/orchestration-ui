#!/usr/bin/env node
// Deterministic contract-scope matcher checks. These scenarios exercise the
// rule gate independently of provider availability and database state.
import assert from 'node:assert/strict';
import { matchContractScopes } from '../../src/lib/procurement/contract-matching.ts';

const scope = (overrides = {}) => ({
  id: 'SCOPE-1', contractId: 'CON-1', effectiveFrom: '2025-01-01', effectiveTo: '2027-12-31', status: 'active',
  scopeNarrative: 'Payroll implementation and HR transformation support for UK teams', serviceFamily: 'payroll',
  eligibleCategories: ['services'], geographies: ['UK'], businessUnits: ['HR'], callOffRequirements: [], completeness: 'complete', provenance: 'curated',
  contractTitle: 'Payroll services', supplierId: 'SUP-1', supplierName: 'Supplier One', contractValue: 100000, utilisationPercentage: 10,
  contractStatus: 'active', deliverables: [{ id: 'D-1', scopeVersionId: 'SCOPE-1', name: 'implementation', aliases: ['rollout'], description: 'Payroll implementation', required: true }], exclusions: [{ id: 'X-1', scopeVersionId: 'SCOPE-1', term: 'tax advice', reason: 'Out of scope' }],
  ...overrides,
});

const insufficient = matchContractScopes({ text: 'We need consulting' }, [scope()]);
assert.equal(insufficient.route, 'clarify');
assert.ok(insufficient.missingFields.includes('deliverable or outcome'));

const matched = matchContractScopes({ text: 'We need payroll implementation support for the UK HR team', category: 'services' }, [scope()]);
assert.equal(matched.route, 'contract');
assert.equal(matched.candidates[0].contractId, 'CON-1');
assert.ok(matched.candidates[0].reasons.length > 0);

const excluded = matchContractScopes({ text: 'We need payroll implementation and tax advice for the UK HR team', category: 'services' }, [scope()]);
assert.equal(excluded.route, 'full-request');

const wrongRegion = matchContractScopes({ text: 'We need payroll implementation for the UK HR team', category: 'services', geography: 'Ireland' }, [scope()]);
assert.equal(wrongRegion.route, 'full-request');

const expiredScope = matchContractScopes({ text: 'We need payroll implementation for the UK HR team', category: 'services', needByDate: '2029-01-01' }, [scope()]);
assert.equal(expiredScope.route, 'full-request');

const incomplete = matchContractScopes({ text: 'We need payroll implementation for the UK HR team', category: 'services' }, [scope({ completeness: 'incomplete' })]);
assert.equal(incomplete.route, 'full-request');

console.log('Contract matching checks passed.');
