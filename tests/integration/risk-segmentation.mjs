#!/usr/bin/env node
// Verifies the inherent-risk cascade and non-binary risk outcome.
//
// Self-contained — mirrors src/lib/procurement/risk-segmentation.ts. Keep in sync.
// Run: node tests/integration/risk-segmentation.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const RANK = { low: 0, medium: 1, high: 2, critical: 3 };
const TIERS = ['low', 'medium', 'high', 'critical'];
const RISK_HIGH_VALUE = 250_000;
const RISK_MEDIUM_VALUE = 50_000;

function highestRiskTier(tiers) {
  return tiers.reduce((max, t) => (max === undefined || RANK[t] > RANK[max] ? t : max), undefined);
}
function determineInherentRisk(input) {
  let level = 0; const drivers = [];
  const raise = (to, reason) => { if (to > 0) drivers.push(reason); level = Math.max(level, to); };
  if (input.criticalService) raise(3, 'Supports a critical service');
  if (input.privilegedAccess) raise(3, 'Privileged or system access');
  if (input.dataSensitivity === 'critical') raise(3, 'Highly confidential data');
  else if (input.dataSensitivity === 'high') raise(2, 'High data sensitivity');
  else if (input.dataSensitivity === 'medium') raise(1, 'Internal data');
  if (input.supplierRiskRating === 'critical') raise(3, 'Critical supplier risk');
  else if (input.supplierRiskRating === 'high') raise(2, 'High supplier risk');
  else if (input.supplierRiskRating === 'medium') raise(1, 'Medium supplier risk');
  const value = input.value ?? 0;
  if (value >= RISK_HIGH_VALUE) raise(2, 'High contract value');
  else if (value >= RISK_MEDIUM_VALUE) raise(1, 'Moderate contract value');
  return { tier: TIERS[level], drivers: drivers.length ? drivers : ['No elevated risk drivers'] };
}
function determineRiskOutcome(input) {
  if (!input.reusableAssessmentExists) return { outcome: 'new' };
  const assessed = input.highestAssessedTier ?? 'low';
  const gap = RANK[input.inherentTier] - RANK[assessed];
  if (gap <= 0) return { outcome: 'reuse' };
  if (gap === 1) return { outcome: 'amend' };
  return { outcome: 'change' };
}

console.log('Inherent-risk cascade');
check('benign → low', determineInherentRisk({ dataSensitivity: 'low', supplierRiskRating: 'low', value: 1000 }).tier === 'low');
check('critical data → critical', determineInherentRisk({ dataSensitivity: 'critical', value: 1000 }).tier === 'critical');
check('privileged access → critical', determineInherentRisk({ privilegedAccess: true, value: 1000 }).tier === 'critical');
check('critical service → critical', determineInherentRisk({ criticalService: true }).tier === 'critical');
check('high supplier risk → high', determineInherentRisk({ supplierRiskRating: 'high' }).tier === 'high');
check('value≥250k → high', determineInherentRisk({ value: 300_000 }).tier === 'high');
check('value≥50k → medium', determineInherentRisk({ value: 60_000 }).tier === 'medium');
check('highest attribute wins', determineInherentRisk({ dataSensitivity: 'medium', supplierRiskRating: 'critical', value: 60_000 }).tier === 'critical');
check('drivers list contributing reasons', determineInherentRisk({ dataSensitivity: 'critical' }).drivers.includes('Highly confidential data'));

console.log('highestRiskTier');
check('picks the highest of a list', highestRiskTier(['low', 'high', 'medium']) === 'high');
check('empty list → undefined', highestRiskTier([]) === undefined);

console.log('Risk outcome (reuse / amend / change / new)');
check('no reusable assessment → new', determineRiskOutcome({ inherentTier: 'high', reusableAssessmentExists: false }).outcome === 'new');
check('inherent within assessed band → reuse', determineRiskOutcome({ inherentTier: 'medium', reusableAssessmentExists: true, highestAssessedTier: 'high' }).outcome === 'reuse');
check('inherent equal to assessed → reuse', determineRiskOutcome({ inherentTier: 'high', reusableAssessmentExists: true, highestAssessedTier: 'high' }).outcome === 'reuse');
check('one tier above assessed → amend', determineRiskOutcome({ inherentTier: 'high', reusableAssessmentExists: true, highestAssessedTier: 'medium' }).outcome === 'amend');
check('two tiers above assessed → change', determineRiskOutcome({ inherentTier: 'critical', reusableAssessmentExists: true, highestAssessedTier: 'medium' }).outcome === 'change');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All risk-segmentation checks passed.');
