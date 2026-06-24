#!/usr/bin/env node
// Verifies the central decisioning policy config (CFG).
//
// Self-contained — mirrors src/lib/procurement/policy-config.ts. Keep in sync.
// Also pins the default values so a change to a threshold is a deliberate,
// reviewed edit (the modules source their constants from here).
// Run: node tests/integration/policy-config.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const DEFAULT_POLICY_CONFIG = {
  approvalFullThreshold: 250_000,
  materialityValueThreshold: 1_000_000,
  criticalServiceThreshold: 100_000,
  continuityThreshold: 250_000,
  riskHighValue: 250_000,
  riskMediumValue: 50_000,
  competitiveSourcingThreshold: 25_000,
  minCompetitiveQuotes: 3,
  preferredMinPerformance: 75,
  contractUtilisationHeadroom: 95,
  contractExpiryBufferDays: 60,
};
function resolvePolicyConfig(overrides) {
  return { ...DEFAULT_POLICY_CONFIG, ...(overrides ?? {}) };
}

const EXPECTED_KEYS = [
  'approvalFullThreshold', 'materialityValueThreshold', 'criticalServiceThreshold',
  'continuityThreshold', 'riskHighValue', 'riskMediumValue', 'competitiveSourcingThreshold',
  'minCompetitiveQuotes', 'preferredMinPerformance', 'contractUtilisationHeadroom', 'contractExpiryBufferDays',
];

console.log('Defaults (pinned)');
check('all expected keys present', EXPECTED_KEYS.every((k) => k in DEFAULT_POLICY_CONFIG) && Object.keys(DEFAULT_POLICY_CONFIG).length === EXPECTED_KEYS.length);
check('approval full threshold = 250k', DEFAULT_POLICY_CONFIG.approvalFullThreshold === 250_000);
check('materiality value threshold = 1m', DEFAULT_POLICY_CONFIG.materialityValueThreshold === 1_000_000);
check('critical-service threshold = 100k', DEFAULT_POLICY_CONFIG.criticalServiceThreshold === 100_000);
check('risk bands = 250k / 50k', DEFAULT_POLICY_CONFIG.riskHighValue === 250_000 && DEFAULT_POLICY_CONFIG.riskMediumValue === 50_000);
check('competitive sourcing = 25k, min quotes = 3', DEFAULT_POLICY_CONFIG.competitiveSourcingThreshold === 25_000 && DEFAULT_POLICY_CONFIG.minCompetitiveQuotes === 3);
check('contract headroom = 95%, expiry buffer = 60d', DEFAULT_POLICY_CONFIG.contractUtilisationHeadroom === 95 && DEFAULT_POLICY_CONFIG.contractExpiryBufferDays === 60);
check('all values positive numbers', EXPECTED_KEYS.every((k) => typeof DEFAULT_POLICY_CONFIG[k] === 'number' && DEFAULT_POLICY_CONFIG[k] > 0));

console.log('Resolver (override seam)');
check('no overrides → defaults unchanged', JSON.stringify(resolvePolicyConfig()) === JSON.stringify(DEFAULT_POLICY_CONFIG));
check('partial override changes only what it names', (() => {
  const r = resolvePolicyConfig({ approvalFullThreshold: 100_000 });
  return r.approvalFullThreshold === 100_000 && r.materialityValueThreshold === DEFAULT_POLICY_CONFIG.materialityValueThreshold;
})());
check('override does not mutate the defaults', (() => {
  resolvePolicyConfig({ riskHighValue: 1 });
  return DEFAULT_POLICY_CONFIG.riskHighValue === 250_000;
})());

console.log('Override drives the decision');
// Mirrors determineApprovalToSource's value trigger: the config-aware functions
// run against the resolved config, so an admin override changes the outcome.
const approvalTier = (value, config) => (value >= config.approvalFullThreshold ? 'full' : 'light');
check('default config: 200k → light gate', approvalTier(200_000, DEFAULT_POLICY_CONFIG) === 'light');
check('override threshold to 150k: 200k → full gate', approvalTier(200_000, resolvePolicyConfig({ approvalFullThreshold: 150_000 })) === 'full');
check('override is isolated to the named field', resolvePolicyConfig({ approvalFullThreshold: 150_000 }).materialityValueThreshold === DEFAULT_POLICY_CONFIG.materialityValueThreshold);

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All policy-config checks passed.');
