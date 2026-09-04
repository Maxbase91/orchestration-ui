#!/usr/bin/env node
// Verifies the second contract check (frameworks/MSAs vs transactable).
//
// Imports the REAL module. It used to reimplement it, line for line, with the
// note "keep in sync" — and it drifted in the way a mirror always does: the
// copy could not catch a defect in the original, because the defect had been
// copied too. Specifically, `if (input.supplierId && ...)` skipped the supplier
// filter entirely when no supplier was selected, so a demand with no supplier
// matched every contract in its category and the determination announced
// "a usable contract covers this demand" about an agreement with a company
// nobody had chosen — which then switched off the approval-to-source gate.

import { runSecondContractCheck } from '../../src/lib/procurement/second-contract-check.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const FAR = '2099-01-01';
const base = { id: 'C1', title: 'C', supplierId: 'SUP-1', category: 'services', status: 'active', endDate: FAR, utilisationPercentage: 20 };
const ctx = { supplierId: 'SUP-1', category: 'services', now: '2026-06-23' };

console.log('A category is not coverage');
// The reported contradiction: three statements on one screen, one of them
// disabling a governance gate.
check('no supplier selected → no candidates, and no transact recommendation', (() => {
  const r = runSecondContractCheck({ category: 'services', now: '2026-06-23', contracts: [base] });
  return r.candidates.length === 0 && r.recommendation === 'new-contract';
})());
check('and it says why, rather than implying nothing exists', (() => {
  const r = runSecondContractCheck({ category: 'services', now: '2026-06-23', contracts: [base] });
  return /no supplier is selected/i.test(r.reason);
})());
check('a selected supplier still matches its own contract', (() => {
  const r = runSecondContractCheck({ ...ctx, contracts: [base] });
  return r.candidates.length === 1 && r.recommendation === 'transact';
})());

console.log('Classification');
check('active + headroom → transactable + transact', (() => { const r = runSecondContractCheck({ ...ctx, contracts: [base] }); return r.candidates[0].kind === 'transactable' && r.recommendation === 'transact'; })());
check('explicit framework flag → framework + author-sow', (() => { const r = runSecondContractCheck({ ...ctx, contracts: [{ ...base, isFramework: true }] }); return r.candidates[0].kind === 'framework' && r.recommendation === 'author-sow'; })());
check('fully utilised → framework (host a SOW)', runSecondContractCheck({ ...ctx, contracts: [{ ...base, utilisationPercentage: 99 }] }).candidates[0].kind === 'framework');
check('status expiring → expiring + renew', (() => { const r = runSecondContractCheck({ ...ctx, contracts: [{ ...base, status: 'expiring' }] }); return r.candidates[0].kind === 'expiring' && r.recommendation === 'renew'; })());
check('endDate within buffer → expiring', runSecondContractCheck({ ...ctx, now: '2026-06-23', contracts: [{ ...base, endDate: '2026-07-10' }] }).candidates[0].kind === 'expiring');

console.log('Filtering');
check('different supplier excluded', runSecondContractCheck({ ...ctx, contracts: [{ ...base, supplierId: 'SUP-9' }] }).candidates.length === 0);
check('different category excluded', runSecondContractCheck({ ...ctx, contracts: [{ ...base, category: 'goods' }] }).candidates.length === 0);
check('expired excluded', runSecondContractCheck({ ...ctx, contracts: [{ ...base, status: 'expired' }] }).candidates.length === 0);
check('past end date excluded', runSecondContractCheck({ ...ctx, contracts: [{ ...base, endDate: '2020-01-01' }] }).candidates.length === 0);
check('no candidates → new-contract', runSecondContractCheck({ ...ctx, contracts: [] }).recommendation === 'new-contract');

console.log('Strongest route wins');
check('transactable beats framework', runSecondContractCheck({ ...ctx, contracts: [{ ...base, id: 'A', isFramework: true }, { ...base, id: 'B' }] }).recommendation === 'transact');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All second-contract-check checks passed.');
