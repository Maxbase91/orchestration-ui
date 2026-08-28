#!/usr/bin/env node
// Classification eval harness + accuracy baseline (CLS-G1).
//
// Benchmarks the deterministic demand classifier against a labelled set and
// reports accuracy + a per-category breakdown. Gates on a baseline so keyword
// rule changes can't silently regress classification.
//
// Self-contained — mirrors src/lib/procurement/classify.ts (CATEGORY_RULES +
// classifyDemandCategory). Keep in sync. Run: node tests/integration/classification-eval.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const DEFAULT_CATEGORY = 'goods';
const CATEGORY_RULES = [
  { category: 'consulting', pattern: /consult|advisory|strategy|audit|transformation|business consult|operating model|tom\b|organisational|organizational|change management|programme management|program management|due diligence|feasibility|business case|maturity assessment|roadmap|target state/ },
  { category: 'services', pattern: /\bservice\b|cleaning|catering|maintenance|travel|translation|managed print|managed service|facilities|security guard|payroll|hr admin|helpdesk/ },
  { category: 'software', pattern: /software|saas|license|cloud|platform|subscription|app/ },
  { category: 'contingent-labour', pattern: /temp|contractor|staff|developer|freelance|hire|interim/ },
  { category: 'contract-renewal', pattern: /renew|extend|renewal|expir/ },
  { category: 'supplier-onboarding', pattern: /onboard|new supplier|new vendor|register/ },
  { category: 'catalogue', pattern: /paper|pen|toner|cable|headset|mouse|keyboard|office supplies/ },
];
function classifyDemandCategory(text) {
  const q = text.toLowerCase();
  for (const rule of CATEGORY_RULES) if (rule.pattern.test(q)) return rule.category;
  return DEFAULT_CATEGORY;
}

// Labelled benchmark — realistic free-text demands → expected category.
const LABELLED = [
  ['management consulting to design a target operating model', 'consulting'],
  ['strategy advisory for a market entry assessment', 'consulting'],
  ['due diligence on an acquisition target', 'consulting'],
  ['organisational change management programme', 'consulting'],
  ['office cleaning services for the HQ building', 'services'],
  ['catering for the annual company summit', 'services'],
  ['facilities management for three sites', 'services'],
  ['translation of marketing materials', 'services'],
  ['SaaS subscription for the analytics platform', 'software'],
  ['cloud hosting for our customer web app', 'software'],
  ['annual software licence true-up', 'software'],
  ['temporary QA contractors for a six month project', 'contingent-labour'],
  ['interim finance manager cover', 'contingent-labour'],
  ['three freelance designers on a short engagement', 'contingent-labour'],
  ['renew the existing vendor contract for another year', 'contract-renewal'],
  ['extend the current janitorial agreement', 'contract-renewal'],
  ['the maintenance contract is about to expire', 'contract-renewal'],
  ['onboard a new vendor for packaging', 'supplier-onboarding'],
  ['register a new supplier in the system', 'supplier-onboarding'],
  ['order printer paper and toner cartridges', 'catalogue'],
  ['a box of pens and some network cables', 'catalogue'],
  ['purchase standing desks and ergonomic chairs', 'goods'],
  ['procure industrial sensors for the production plant', 'goods'],
  ['buy raw aluminium stock for manufacturing', 'goods'],
];

console.log('Classification eval');
const perCategory = {};
const misses = [];
let correct = 0;
for (const [text, expected] of LABELLED) {
  const got = classifyDemandCategory(text);
  const ok = got === expected;
  if (ok) correct += 1; else misses.push({ text, expected, got });
  perCategory[expected] ??= { total: 0, correct: 0 };
  perCategory[expected].total += 1;
  if (ok) perCategory[expected].correct += 1;
}
const accuracy = correct / LABELLED.length;

console.log(`  Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${LABELLED.length})`);
for (const [cat, s] of Object.entries(perCategory)) {
  console.log(`    ${cat}: ${s.correct}/${s.total}`);
}
if (misses.length) {
  console.log('  Misclassified:');
  for (const m of misses) console.log(`    "${m.text}" → ${m.got} (expected ${m.expected})`);
}

// Baseline gate — keyword rules must hold the accuracy floor.
const BASELINE = 0.85;
check(`accuracy ≥ ${(BASELINE * 100).toFixed(0)}% baseline`, accuracy >= BASELINE, `${(accuracy * 100).toFixed(1)}%`);
// Every category must be represented and reachable by the rules.
for (const cat of ['consulting', 'services', 'software', 'contingent-labour', 'contract-renewal', 'supplier-onboarding', 'catalogue', 'goods']) {
  check(`category "${cat}" is covered by the benchmark and reachable`,
    (perCategory[cat]?.correct ?? 0) >= 1);
}

// ── A route is not a commodity category ─────────────────────────────────────
//
// `catalogue` earns its place in the rules above — a paper-and-toner demand IS
// a catalogue signal and the benchmark measures it. But it answers "how is this
// bought", not "what is being bought", and the wizard keys its whole journey
// off the category. A classifier answering `catalogue` therefore turned the
// entire flow into a catalogue order and skipped the funnel that decides the
// route — the third door into the "business consulting opens Business Cards"
// fault, after the pre-check and the command bar.
//
// `classifyCommodityCategory` is the variant for callers that need the
// commodity answer only. Mirrors src/lib/procurement/classify.ts.

const ROUTE_LIKE_CATEGORY = 'catalogue';
function classifyCommodityCategory(text) {
  const q = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.category === ROUTE_LIKE_CATEGORY) continue;
    if (rule.pattern.test(q)) return rule.category;
  }
  return DEFAULT_CATEGORY;
}

console.log('\nThe commodity classifier never returns a fulfilment route');
for (const [text] of LABELLED) {
  check(`"${text.slice(0, 44)}…" is a commodity, not a route`,
    classifyCommodityCategory(text) !== ROUTE_LIKE_CATEGORY,
    classifyCommodityCategory(text));
}
// Paper and toner are goods. That they are ORDERABLE from the catalogue is the
// funnel's finding, not the classifier's.
check('"order printer paper and toner cartridges" is goods',
  classifyCommodityCategory('order printer paper and toner cartridges') === 'goods',
  classifyCommodityCategory('order printer paper and toner cartridges'));
check('"a box of pens and some network cables" is goods',
  classifyCommodityCategory('a box of pens and some network cables') === 'goods');
// The two functions must agree everywhere the route rule does not fire —
// otherwise this is a second classifier, not a variant of one.
let divergences = 0;
for (const [text] of LABELLED) {
  const a = classifyDemandCategory(text);
  const b = classifyCommodityCategory(text);
  if (a !== b && a !== ROUTE_LIKE_CATEGORY) divergences++;
}
check('it differs from the benchmarked classifier ONLY on the route rule',
  divergences === 0, `${divergences} divergence(s)`);
// The benchmarked classifier is deliberately unchanged — its catalogue label is
// a measured signal, and the fix must not quietly retune the baseline.
check('the benchmarked classifier still labels a catalogue demand',
  classifyDemandCategory('order printer paper and toner cartridges') === ROUTE_LIKE_CATEGORY);

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All classification-eval checks passed.');
