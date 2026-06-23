#!/usr/bin/env node
// Verifies materiality & criticality determination.
//
// Self-contained — mirrors src/lib/procurement/materiality.ts. Keep in sync.
// Run: node tests/integration/materiality.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const MATERIALITY_VALUE_THRESHOLD = 1_000_000;
const LEVEL = { standard: 0, important: 1, critical: 2 };
const CRITICALITY = ['standard', 'important', 'critical'];

function determineMateriality(input) {
  let level = 0;
  const reasons = [];
  const raise = (to, reason) => { if (to > 0) reasons.push(reason); level = Math.max(level, to); };
  if (input.criticalService) raise(2, 'Qualifies as a critical service');
  if (input.dataSensitivity === 'critical') raise(2, 'Critical data sensitivity');
  else if (input.dataSensitivity === 'high') raise(1, 'High data sensitivity');
  if (input.riskRating === 'critical') raise(2, 'Critical inherent supplier risk');
  else if (input.riskRating === 'high') raise(1, 'High inherent supplier risk');
  if ((input.value ?? 0) >= MATERIALITY_VALUE_THRESHOLD) raise(1, 'Value at or above the materiality threshold');
  const criticality = CRITICALITY[level];
  const material = level >= LEVEL.important;
  return { criticality, material, flag: material, reasons: reasons.length ? reasons : ['No materiality triggers'] };
}

console.log('Materiality & criticality determination');
const standard = determineMateriality({ dataSensitivity: 'low', riskRating: 'low', value: 5000 });
check('benign demand → standard, not material', standard.criticality === 'standard' && !standard.material && !standard.flag);

const critData = determineMateriality({ dataSensitivity: 'critical', riskRating: 'low', value: 5000 });
check('critical data → critical + material + flag', critData.criticality === 'critical' && critData.material && critData.flag);

const highRisk = determineMateriality({ dataSensitivity: 'low', riskRating: 'high', value: 5000 });
check('high supplier risk → important + material', highRisk.criticality === 'important' && highRisk.material);

const bigValue = determineMateriality({ dataSensitivity: 'low', riskRating: 'low', value: 1_000_000 });
check('value at threshold → important + material', bigValue.criticality === 'important' && bigValue.material);

const belowValue = determineMateriality({ dataSensitivity: 'low', riskRating: 'low', value: 999_999 });
check('value just below threshold → not material', !belowValue.material);

const criticalService = determineMateriality({ criticalService: true, dataSensitivity: 'low', riskRating: 'low', value: 1000 });
check('explicit critical-service flag → critical + material', criticalService.criticality === 'critical' && criticalService.material);

const highestWins = determineMateriality({ dataSensitivity: 'high', riskRating: 'critical', value: 100 });
check('highest attribute wins (critical risk over high data)', highestWins.criticality === 'critical');

check('non-material result reasons explain why', standard.reasons.includes('No materiality triggers'));
check('material result lists triggering reasons', critData.reasons.includes('Critical data sensitivity'));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All materiality checks passed.');
