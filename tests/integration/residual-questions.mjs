#!/usr/bin/env node
// Verifies the criteria-triggered residual questions (INT-10, stage 5).
//
// Self-contained — mirrors src/lib/procurement/residual-questions.ts. Keep in
// sync. Run: node tests/integration/residual-questions.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const CRITICAL_SERVICE_VALUE_THRESHOLD = 100_000;
const ACCESS_CATEGORIES = new Set(['software', 'services', 'consulting', 'contingent-labour']);
const SENSITIVITY_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

function determineResidualQuestions(ctx) {
  const out = [];
  const sensitivity = SENSITIVITY_RANK[ctx.dataSensitivity] ?? 0;
  if (ACCESS_CATEGORIES.has(ctx.category) || sensitivity >= SENSITIVITY_RANK.medium) {
    out.push({ id: 'privileged-access', field: 'privilegedAccess' });
  }
  const supplierElevated = ctx.supplierRiskRating === 'high' || ctx.supplierRiskRating === 'critical';
  if (ctx.estimatedValue >= CRITICAL_SERVICE_VALUE_THRESHOLD || supplierElevated || sensitivity >= SENSITIVITY_RANK.high) {
    out.push({ id: 'critical-service', field: 'criticalService' });
  }
  return out;
}

const ids = (ctx) => determineResidualQuestions(ctx).map((q) => q.id);
const base = { category: 'goods', dataSensitivity: 'none', estimatedValue: 5_000, supplierRiskRating: 'low' };

console.log('Nothing-to-ask');
check('low-value low-sensitivity goods → no questions', ids(base).length === 0);
check('catalogue-style order asks nothing', ids({ ...base, category: 'catalogue' }).length === 0);

console.log('Privileged access');
check('software category triggers access question', ids({ ...base, category: 'software' }).includes('privileged-access'));
check('consulting triggers access question', ids({ ...base, category: 'consulting' }).includes('privileged-access'));
check('medium data sensitivity triggers access (any category)', ids({ ...base, dataSensitivity: 'medium' }).includes('privileged-access'));
check('goods + none sensitivity does NOT ask access', !ids(base).includes('privileged-access'));

console.log('Critical service');
check('value at threshold triggers critical-service', ids({ ...base, estimatedValue: CRITICAL_SERVICE_VALUE_THRESHOLD }).includes('critical-service'));
check('value below threshold does NOT (alone)', !ids({ ...base, estimatedValue: CRITICAL_SERVICE_VALUE_THRESHOLD - 1 }).includes('critical-service'));
check('high supplier risk triggers critical-service', ids({ ...base, supplierRiskRating: 'high' }).includes('critical-service'));
check('critical supplier risk triggers critical-service', ids({ ...base, supplierRiskRating: 'critical' }).includes('critical-service'));
check('high data sensitivity triggers critical-service', ids({ ...base, dataSensitivity: 'high' }).includes('critical-service'));

console.log('Composition & mapping');
check('high-value sensitive software asks both', (() => { const r = ids({ category: 'software', dataSensitivity: 'high', estimatedValue: 500_000, supplierRiskRating: 'high' }); return r.includes('privileged-access') && r.includes('critical-service'); })());
check('access question maps to privilegedAccess field', determineResidualQuestions({ ...base, category: 'software' })[0].field === 'privilegedAccess');
check('critical question maps to criticalService field', determineResidualQuestions({ ...base, estimatedValue: 200_000 }).find((q) => q.id === 'critical-service').field === 'criticalService');

// ── The real module, reading Decisioning thresholds ──────────────────────────
// The checks above run a copy of the module. These run the real one: which
// categories trigger the privileged-access question was a set in the file and
// is now a Decisioning threshold (privilegedAccessCategories).
console.log('\nThe access question follows Decisioning thresholds');
{
  const real = await import('../../src/lib/procurement/residual-questions.ts');
  const { DEFAULT_POLICY_CONFIG } = await import('../../src/lib/procurement/policy-config.ts');
  const ctx = { category: 'goods', dataSensitivity: 'low', estimatedValue: 1000 };
  const asks = (config) => real.determineResidualQuestions(ctx, config).some((q) => q.id === 'privileged-access');
  check('goods is not asked by default', !asks(DEFAULT_POLICY_CONFIG));
  check('listing goods makes it asked', asks({ ...DEFAULT_POLICY_CONFIG, privilegedAccessCategories: ['goods'] }));
  check('the default keeps the four categories the set held',
    JSON.stringify(DEFAULT_POLICY_CONFIG.privilegedAccessCategories) === JSON.stringify(['software', 'services', 'consulting', 'contingent-labour']));
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All residual-questions checks passed.');
