#!/usr/bin/env node
// Verifies the preliminary operational risk assessment (RSK-02).
//
// Self-contained — mirrors src/lib/procurement/operational-risk-assessment.ts.
// Keep in sync. Run: node tests/integration/operational-risk.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const CONTINUITY_VALUE_THRESHOLD = 250_000;
const RANK = { low: 0, medium: 1, high: 2 };
const SENSITIVITY_RANK = { none: 0, low: 0, medium: 1, high: 2, critical: 2 };

function assessOperationalRisk(input) {
  const dimensions = [];
  dimensions.push({ key: 'business-continuity', rating: input.criticalService ? 'high' : input.estimatedValue >= CONTINUITY_VALUE_THRESHOLD ? 'medium' : 'low' });
  const dataRating = SENSITIVITY_RANK[input.dataSensitivity] >= 2 ? 'high' : SENSITIVITY_RANK[input.dataSensitivity] === 1 ? 'medium' : 'low';
  dimensions.push({ key: 'data-handling', rating: dataRating });
  dimensions.push({ key: 'concentration', rating: input.incumbentRelationship && input.material ? 'high' : input.incumbentRelationship ? 'medium' : 'low' });
  dimensions.push({ key: 'regulatory', rating: input.material ? 'high' : 'low' });
  dimensions.push({ key: 'access', rating: input.privilegedAccess ? 'high' : 'low' });
  const overall = dimensions.reduce((worst, d) => (RANK[d.rating] > RANK[worst] ? d.rating : worst), 'low');
  return { overall, dimensions };
}

const base = { dataSensitivity: 'none', material: false, criticalService: false, privilegedAccess: false, estimatedValue: 5_000, incumbentRelationship: false };
const dim = (r, key) => r.dimensions.find((d) => d.key === key).rating;

console.log('Baseline');
check('benign demand → overall low', assessOperationalRisk(base).overall === 'low');
check('all five dimensions returned', assessOperationalRisk(base).dimensions.length === 5);

console.log('Business continuity');
check('critical service → continuity high', dim(assessOperationalRisk({ ...base, criticalService: true }), 'business-continuity') === 'high');
check('value ≥ threshold → continuity medium', dim(assessOperationalRisk({ ...base, estimatedValue: CONTINUITY_VALUE_THRESHOLD }), 'business-continuity') === 'medium');
check('below threshold → continuity low', dim(assessOperationalRisk({ ...base, estimatedValue: CONTINUITY_VALUE_THRESHOLD - 1 }), 'business-continuity') === 'low');

console.log('Data handling');
check('high sensitivity → data high', dim(assessOperationalRisk({ ...base, dataSensitivity: 'high' }), 'data-handling') === 'high');
check('medium sensitivity → data medium', dim(assessOperationalRisk({ ...base, dataSensitivity: 'medium' }), 'data-handling') === 'medium');
check('low sensitivity → data low', dim(assessOperationalRisk({ ...base, dataSensitivity: 'low' }), 'data-handling') === 'low');

console.log('Concentration');
check('incumbent + material → concentration high', dim(assessOperationalRisk({ ...base, incumbentRelationship: true, material: true }), 'concentration') === 'high');
check('incumbent only → concentration medium', dim(assessOperationalRisk({ ...base, incumbentRelationship: true }), 'concentration') === 'medium');
check('no incumbent → concentration low', dim(assessOperationalRisk(base), 'concentration') === 'low');

console.log('Regulatory & access');
check('material → regulatory high', dim(assessOperationalRisk({ ...base, material: true }), 'regulatory') === 'high');
check('privileged access → access high', dim(assessOperationalRisk({ ...base, privilegedAccess: true }), 'access') === 'high');

console.log('Worst-dimension-wins');
check('one high dimension drives overall high', assessOperationalRisk({ ...base, privilegedAccess: true }).overall === 'high');
check('only medium dimensions → overall medium', assessOperationalRisk({ ...base, estimatedValue: 300_000, dataSensitivity: 'medium' }).overall === 'medium');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All operational-risk checks passed.');
