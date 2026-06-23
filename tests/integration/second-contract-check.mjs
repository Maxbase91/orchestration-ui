#!/usr/bin/env node
// Verifies the second contract check (frameworks/MSAs vs transactable).
//
// Self-contained — mirrors src/lib/procurement/second-contract-check.ts. Keep in
// sync. Run: node tests/integration/second-contract-check.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const UTILISATION_HEADROOM = 95;
const EXPIRY_BUFFER_DAYS = 60;
const daysBetween = (a, b) => { const f = Date.parse(a), t = Date.parse(b); return Number.isNaN(f) || Number.isNaN(t) ? Infinity : Math.round((t - f) / 86400000); };

function runSecondContractCheck(input) {
  const candidates = [];
  for (const c of input.contracts) {
    if (input.supplierId && c.supplierId !== input.supplierId) continue;
    if (input.category && c.category && c.category !== input.category) continue;
    if (c.status === 'expired' || c.status === 'terminated') continue;
    if (c.endDate && c.endDate < input.now) continue;
    const expiringSoon = c.status === 'expiring' || daysBetween(input.now, c.endDate) <= EXPIRY_BUFFER_DAYS;
    let kind;
    if (c.isFramework) kind = 'framework';
    else if (expiringSoon) kind = 'expiring';
    else if (c.status === 'active' && c.utilisationPercentage < UTILISATION_HEADROOM) kind = 'transactable';
    else kind = 'framework';
    candidates.push({ contractId: c.id, title: c.title, kind });
  }
  if (candidates.some((c) => c.kind === 'transactable')) return { candidates, recommendation: 'transact' };
  if (candidates.some((c) => c.kind === 'framework')) return { candidates, recommendation: 'author-sow' };
  if (candidates.some((c) => c.kind === 'expiring')) return { candidates, recommendation: 'renew' };
  return { candidates, recommendation: 'new-contract' };
}

const FAR = '2099-01-01';
const base = { id: 'C1', title: 'C', supplierId: 'SUP-1', category: 'services', status: 'active', endDate: FAR, utilisationPercentage: 20 };
const ctx = { supplierId: 'SUP-1', category: 'services', now: '2026-06-23' };

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
