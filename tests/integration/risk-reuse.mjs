#!/usr/bin/env node
// Verifies the structured risk-register reuse model.
//
// Self-contained — mirrors src/lib/procurement/risk-reuse.ts (+ the tier rule
// from risk-segmentation.ts). Keep in sync. Run: node tests/integration/risk-reuse.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const RANK = { low: 0, medium: 1, high: 2, critical: 3 };
const SENS = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
const OUTCOME_RANK = { reuse: 0, amend: 1, change: 2, new: 3 };

function determineRiskOutcome(input) {
  if (!input.reusableAssessmentExists) return { outcome: 'new', reason: 'no reusable' };
  const assessed = input.highestAssessedTier ?? 'low';
  const gap = RANK[input.inherentTier] - RANK[assessed];
  if (gap <= 0) return { outcome: 'reuse', reason: 'within band' };
  if (gap === 1) return { outcome: 'amend', reason: 'one tier above' };
  return { outcome: 'change', reason: 'materially above' };
}
const worst = (a, b) => (OUTCOME_RANK[a] >= OUTCOME_RANK[b] ? a : b);

function evaluateReuse(demand, a) {
  if (!a.reusable || a.status !== 'completed') return { decision: 'no-match' };
  if (demand.supplierId && a.supplierId && demand.supplierId !== a.supplierId) return { decision: 'no-match' };
  if (a.validUntil && a.validUntil < demand.now) return { decision: 'new' };
  let decision = determineRiskOutcome({ inherentTier: demand.inherentTier, reusableAssessmentExists: true, highestAssessedTier: a.riskLevel }).outcome;
  if (demand.category && a.category && demand.category !== a.category) decision = worst(decision, 'amend');
  if (demand.dataSensitivity && a.assessedDataClass) {
    const gap = SENS[demand.dataSensitivity] - SENS[a.assessedDataClass];
    if (gap === 1) decision = worst(decision, 'amend');
    else if (gap > 1) decision = worst(decision, 'change');
  }
  return { decision, assessmentId: a.id };
}
function selectReuseOutcome(demand, assessments) {
  const ok = assessments.map((a) => evaluateReuse(demand, a)).filter((e) => e.decision !== 'no-match');
  if (ok.length === 0) return { decision: 'new' };
  return ok.reduce((best, e) => (OUTCOME_RANK[e.decision] < OUTCOME_RANK[best.decision] ? e : best));
}

const base = { id: 'RA-1', reusable: true, status: 'completed', supplierId: 'SUP-1', category: 'security', riskLevel: 'high', assessedDataClass: 'high', validUntil: '2099-01-01' };
const demand = { supplierId: 'SUP-1', category: 'security', dataSensitivity: 'high', inherentTier: 'high', now: '2026-06-23' };

console.log('evaluateReuse — single assessment');
check('all dimensions within band → reuse', evaluateReuse(demand, base).decision === 'reuse');
check('not reusable → no-match', evaluateReuse(demand, { ...base, reusable: false }).decision === 'no-match');
check('not completed → no-match', evaluateReuse(demand, { ...base, status: 'in-review' }).decision === 'no-match');
check('different supplier → no-match', evaluateReuse(demand, { ...base, supplierId: 'SUP-2' }).decision === 'no-match');
check('expired → new', evaluateReuse(demand, { ...base, validUntil: '2020-01-01' }).decision === 'new');
check('inherent one tier above assessed → amend', evaluateReuse({ ...demand, inherentTier: 'critical' }, base).decision === 'amend');
check('different scope → at least amend', evaluateReuse({ ...demand, category: 'financial' }, base).decision === 'amend');
check('data class one step above → amend', evaluateReuse({ ...demand, dataSensitivity: 'critical' }, base).decision === 'amend');
check('worst dimension wins (scope amend + tier change → change)',
  evaluateReuse({ ...demand, category: 'financial', inherentTier: 'critical', dataSensitivity: 'critical' }, { ...base, riskLevel: 'low', assessedDataClass: 'low' }).decision === 'change');

console.log('selectReuseOutcome — across candidates');
check('no candidates → new', selectReuseOutcome(demand, []).decision === 'new');
check('all no-match → new', selectReuseOutcome(demand, [{ ...base, supplierId: 'SUP-9' }]).decision === 'new');
check('picks the most favourable (reuse over amend)',
  selectReuseOutcome(demand, [{ ...base, id: 'A', category: 'financial' }, { ...base, id: 'B' }]).assessmentId === 'B');
check('selected decision is reuse when a perfect match exists',
  selectReuseOutcome(demand, [{ ...base, id: 'A', riskLevel: 'low' }, { ...base, id: 'B' }]).decision === 'reuse');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All risk-reuse checks passed.');
