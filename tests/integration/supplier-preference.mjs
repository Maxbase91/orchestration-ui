#!/usr/bin/env node
// Verifies the preferred-supplier (PSL) and competitive-sourcing controls.
//
// Self-contained — mirrors src/lib/procurement/supplier-preference.ts. Keep in
// sync. Run: node tests/integration/supplier-preference.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirror of supplier-preference.ts ──
const COMPETITIVE_SOURCING_THRESHOLD = 25000;
const MIN_COMPETITIVE_QUOTES = 3;
const PREFERRED_MIN_PERFORMANCE = 75;

function isPreferredSupplier(supplier, opts = {}) {
  if (!supplier) return false;
  if (typeof supplier.preferred === 'boolean') return supplier.preferred;
  const established = opts.hasActiveContract ?? supplier.activeContracts > 0;
  return established && supplier.riskRating !== 'critical' &&
    (supplier.performanceScore ?? 0) >= PREFERRED_MIN_PERFORMANCE;
}

function competitiveSourcingCheck({ value, category, isPreferred, exemptCategories = ['contingent-labour'], singleSourceJustified = false }) {
  const belowThreshold = value < COMPETITIVE_SOURCING_THRESHOLD;
  const categoryExempt = exemptCategories.includes(category);
  const exempt = belowThreshold || categoryExempt || isPreferred || singleSourceJustified;
  return { label: 'Competitive sourcing', passed: exempt };
}

// ── PSL determination ──
console.log('Preferred-supplier (PSL) determination');
check('explicit preferred flag wins (true)', isPreferredSupplier({ preferred: true, activeContracts: 0, riskRating: 'critical', performanceScore: 10 }) === true);
check('explicit preferred flag wins (false)', isPreferredSupplier({ preferred: false, activeContracts: 9, riskRating: 'low', performanceScore: 99 }) === false);
check('established + low risk + high perf → preferred', isPreferredSupplier({ activeContracts: 2, riskRating: 'low', performanceScore: 80 }) === true);
check('no contract → not preferred', isPreferredSupplier({ activeContracts: 0, riskRating: 'low', performanceScore: 80 }) === false);
check('hasActiveContract opt overrides count', isPreferredSupplier({ activeContracts: 0, riskRating: 'low', performanceScore: 80 }, { hasActiveContract: true }) === true);
check('critical risk → not preferred', isPreferredSupplier({ activeContracts: 2, riskRating: 'critical', performanceScore: 95 }) === false);
check('low performance → not preferred', isPreferredSupplier({ activeContracts: 2, riskRating: 'low', performanceScore: 74 }) === false);
check('undefined supplier → not preferred', isPreferredSupplier(undefined) === false);

// ── competitive sourcing ──
console.log('Competitive sourcing');
check('below threshold is exempt', competitiveSourcingCheck({ value: 10000, category: 'goods', isPreferred: false }).passed === true);
check('above threshold, not exempt → requires quotes', competitiveSourcingCheck({ value: 50000, category: 'goods', isPreferred: false }).passed === false);
check('preferred supplier waives quotes', competitiveSourcingCheck({ value: 50000, category: 'goods', isPreferred: true }).passed === true);
check('exempt category waives quotes', competitiveSourcingCheck({ value: 50000, category: 'contingent-labour', isPreferred: false }).passed === true);
check('single-source justification waives quotes', competitiveSourcingCheck({ value: 50000, category: 'goods', isPreferred: false, singleSourceJustified: true }).passed === true);
check('threshold constant is 25000', COMPETITIVE_SOURCING_THRESHOLD === 25000);
check('min quotes constant is 3', MIN_COMPETITIVE_QUOTES === 3);

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All supplier-preference checks passed.');
