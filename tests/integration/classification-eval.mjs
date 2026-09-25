#!/usr/bin/env node
// Classification eval harness + accuracy baseline (CLS-G1).
//
// Benchmarks the deterministic demand classifier against a labelled set and
// reports accuracy + a per-category breakdown. Gates on a baseline so keyword
// rule changes can't silently regress classification.
//
// Runs the REAL classifier with the seeded category keywords. It used to carry
// its own copy of the regex rules ("keep in sync"), and passed against the copy;
// the keywords are configuration now (Admin → Categories), so this benchmarks
// the configured set a fresh deployment starts with.
// Run: npm run test:classification-eval
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';
import {
  classifyDemandCategory as classifyWith, classifyCommodityCategory as commodityWith, ROUTE_LIKE_CATEGORY,
} from '../../src/lib/procurement/classify.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const classifyDemandCategory = (text) => classifyWith(text, DEFAULT_CATEGORY_TAXONOMY);
const classifyCommodityCategory = (text) => commodityWith(text, DEFAULT_CATEGORY_TAXONOMY);

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
for (const cat of ['consulting', 'services', 'software', 'contingent-labour', 'catalogue', 'goods']) {
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
// commodity answer only.

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

console.log('\nThe classifier reads configuration');
{
  const { readFileSync } = await import('node:fs');
  const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/^\s*\/\/.*$|^\s*\*.*$/gm, '');
  check('classify.ts holds no keyword table', !/CATEGORY_RULES|pattern: \//.test(read('src/lib/procurement/classify.ts')));
  check('a category has no icon or timeline (never shown / disagreed with the workflow)',
    !/icon\?:|timelineDays/.test(read('src/lib/db/procurement-categories.ts')));
  check('every seeded category but the default carries keywords',
    DEFAULT_CATEGORY_TAXONOMY.filter((c) => c.id !== 'goods').every((c) => c.keywords.length > 0));
  check('consulting outranks services, and goods (the default) comes last',
    (() => { const order = [...DEFAULT_CATEGORY_TAXONOMY].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id);
      return order.indexOf('consulting') < order.indexOf('services') && order[order.length - 1] === 'goods'; })());
  check('a keyword matches at the start of a word, not inside one',
    classifyDemandCategory('quarterly spend review') !== 'catalogue' && classifyDemandCategory('a pending approval') !== 'software');
  check('the AI prompt is built from the configured categories',
    /systemPromptFor\(categories\)/.test(read('api/ai.ts')) && !/Pens €8|Items under €500/.test(read('api/ai.ts')));
}

const { loadEnv } = await import('../lib/live.mjs');
const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (connection) {
  console.log('\nLive');
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connection);
  const rows = await sql`SELECT id, active, sort_order, classification_keywords FROM procurement_categories WHERE active ORDER BY sort_order`;
  const bare = rows.filter((r) => r.id !== 'goods' && (r.classification_keywords ?? []).length === 0).map((r) => r.id);
  check('every active live category but the default has keywords', bare.length === 0, bare.join(', '));
  check('live order: consulting before services', rows.findIndex((r) => r.id === 'consulting') < rows.findIndex((r) => r.id === 'services'));
  const liveAccuracy = LABELLED.filter(([text, want]) => classifyWith(text, rows.map((r) => ({ id: r.id, active: r.active, sortOrder: r.sort_order, keywords: r.classification_keywords }))) === want).length / LABELLED.length;
  check(`the live configuration holds the baseline (${(liveAccuracy * 100).toFixed(1)}%)`, liveAccuracy >= BASELINE);
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All classification-eval checks passed.');
