#!/usr/bin/env node
// Verifies the downstream handoff / next-steps model.
//
// Self-contained — mirrors src/lib/procurement/handoff.ts. Keep in sync.
// Run: node tests/integration/handoff.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const PO_CHANNELS = ['catalogue', 'direct-po', 'framework-call-off'];
function buildHandoffSteps(input) {
  const steps = [];
  if (input.supplierDataIssue) steps.push({ key: 'supplier-data', system: 'Supplier management', status: 'required', deepLink: '/suppliers/onboarding' });
  const riskStatus = input.riskOutcome === 'reuse' ? 'not-required' : input.riskOutcome === 'amend' ? 'recommended' : 'required';
  steps.push({ key: 'risk-assessment', system: 'Third-party risk register', status: riskStatus, deepLink: riskStatus === 'not-required' ? undefined : '/suppliers/risk' });
  if (input.material) steps.push({ key: 'materiality-governance', system: 'Governance', status: 'required', deepLink: '/approvals' });
  if (input.channel === 'procurement-led' || input.channel === 'business-led')
    steps.push({ key: 'sourcing', system: 'Sourcing', status: input.channel === 'procurement-led' ? 'required' : 'recommended', deepLink: '/sourcing/new' });
  if (input.channel === 'framework-call-off') steps.push({ key: 'contract', system: 'Contract management', status: 'required', deepLink: '/contracts' });
  else if (input.channel === 'procurement-led') steps.push({ key: 'contract', system: 'Contract management', status: 'required', deepLink: '/contracts' });
  const poNow = PO_CHANNELS.includes(input.channel);
  steps.push({ key: 'purchasing', system: 'Purchasing', status: poNow ? 'required' : 'recommended', deepLink: '/purchasing/orders' });
  return steps;
}
const byKey = (steps, k) => steps.find((s) => s.key === k);

console.log('Risk-assessment handoff (RSK-06)');
check('reuse → risk assessment not required (no deep-link)', (() => { const s = byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'reuse', material: false }), 'risk-assessment'); return s.status === 'not-required' && !s.deepLink; })());
check('amend → recommended (delta)', byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'amend', material: false }), 'risk-assessment').status === 'recommended');
check('new → required, routed to risk register', (() => { const s = byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'new', material: false }), 'risk-assessment'); return s.status === 'required' && s.deepLink === '/suppliers/risk'; })());
check('change → required', byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'change', material: false }), 'risk-assessment').status === 'required');
check('supplier-data issue → remediation step (required, routed to onboarding)', (() => { const s = byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'reuse', material: false, supplierDataIssue: true }), 'supplier-data'); return s && s.status === 'required' && s.deepLink === '/suppliers/onboarding'; })());
check('no supplier-data issue → no remediation step', !byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'reuse', material: false }), 'supplier-data'));

console.log('Materiality / governance');
check('material → governance step present + required', byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'reuse', material: true }), 'materiality-governance')?.status === 'required');
check('non-material → no governance step', !byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'reuse', material: false }), 'materiality-governance'));

console.log('Sourcing & contract by channel');
check('procurement-led → sourcing required + new contract', (() => { const s = buildHandoffSteps({ channel: 'procurement-led', riskOutcome: 'new', material: false }); return byKey(s, 'sourcing').status === 'required' && byKey(s, 'contract').status === 'required'; })());
check('business-led → sourcing recommended, no contract step', (() => { const s = buildHandoffSteps({ channel: 'business-led', riskOutcome: 'new', material: false }); return byKey(s, 'sourcing').status === 'recommended' && !byKey(s, 'contract'); })());
check('framework-call-off → contract call-off, no sourcing', (() => { const s = buildHandoffSteps({ channel: 'framework-call-off', riskOutcome: 'reuse', material: false }); return byKey(s, 'contract').status === 'required' && !byKey(s, 'sourcing'); })());
check('catalogue → no sourcing, no contract', (() => { const s = buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'reuse', material: false }); return !byKey(s, 'sourcing') && !byKey(s, 'contract'); })());

console.log('Purchasing');
check('catalogue → requisition required now', byKey(buildHandoffSteps({ channel: 'catalogue', riskOutcome: 'reuse', material: false }), 'purchasing').status === 'required');
check('procurement-led → requisition follows (recommended)', byKey(buildHandoffSteps({ channel: 'procurement-led', riskOutcome: 'new', material: false }), 'purchasing').status === 'recommended');

console.log('Shape');
check('every step has a generic system label + key', buildHandoffSteps({ channel: 'procurement-led', riskOutcome: 'new', material: true }).every((s) => s.system && s.key));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All handoff checks passed.');
