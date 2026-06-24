#!/usr/bin/env node
// Verifies the approval-to-source gate (DET-05).
//
// Self-contained — mirrors src/lib/procurement/approval-to-source.ts. Keep in
// sync. Run: node tests/integration/approval-to-source.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const FULL_APPROVAL_VALUE_THRESHOLD = 250_000;
const TIERS = ['low', 'medium', 'high', 'critical'];
const rank = (t) => Math.max(0, TIERS.indexOf(t));

function determineApprovalToSource(input) {
  if (input.earlyExit) {
    return { tier: 'none', gates: [], rationale: 'early exit' };
  }
  const triggers = [];
  if (input.estimatedValue >= FULL_APPROVAL_VALUE_THRESHOLD) triggers.push('value');
  if (input.material) triggers.push('material');
  if (rank(input.inherentTier) >= rank('high')) triggers.push('risk');

  if (triggers.length > 0) {
    return {
      tier: 'full',
      gates: [
        { id: 'demand-validation' },
        { id: 'intent-to-source' },
        { id: 'category-approval' },
      ],
      triggers,
    };
  }
  return {
    tier: 'light',
    gates: [{ id: 'demand-validation' }, { id: 'cost-centre' }],
    triggers: [],
  };
}

const base = { estimatedValue: 50_000, material: false, inherentTier: 'low' };
const ids = (r) => r.gates.map((g) => g.id);

console.log('Tier selection');
check('low value + low risk + not material → light', determineApprovalToSource(base).tier === 'light');
check('value at threshold → full', determineApprovalToSource({ ...base, estimatedValue: FULL_APPROVAL_VALUE_THRESHOLD }).tier === 'full');
check('value above threshold → full', determineApprovalToSource({ ...base, estimatedValue: 1_000_000 }).tier === 'full');
check('value just below threshold → light', determineApprovalToSource({ ...base, estimatedValue: FULL_APPROVAL_VALUE_THRESHOLD - 1 }).tier === 'light');
check('material demand → full (even at low value)', determineApprovalToSource({ ...base, material: true }).tier === 'full');
check('high inherent risk → full', determineApprovalToSource({ ...base, inherentTier: 'high' }).tier === 'full');
check('critical inherent risk → full', determineApprovalToSource({ ...base, inherentTier: 'critical' }).tier === 'full');
check('medium inherent risk alone → light', determineApprovalToSource({ ...base, inherentTier: 'medium' }).tier === 'light');

console.log('Early exit');
check('transactable early exit → none', determineApprovalToSource({ ...base, earlyExit: true }).tier === 'none');
check('early exit has no gates', determineApprovalToSource({ ...base, material: true, earlyExit: true }).gates.length === 0);

console.log('Gates per tier');
check('light gates = demand-validation + cost-centre', JSON.stringify(ids(determineApprovalToSource(base))) === JSON.stringify(['demand-validation', 'cost-centre']));
check('full gates = demand-validation + intent-to-source + category-approval',
  JSON.stringify(ids(determineApprovalToSource({ ...base, material: true }))) === JSON.stringify(['demand-validation', 'intent-to-source', 'category-approval']));
check('every full gate keeps demand-validation first', determineApprovalToSource({ ...base, estimatedValue: 1_000_000 }).gates[0].id === 'demand-validation');

console.log('Trigger composition');
check('multiple triggers all recorded', determineApprovalToSource({ estimatedValue: 1_000_000, material: true, inherentTier: 'critical' }).triggers.length === 3);

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All approval-to-source checks passed.');
