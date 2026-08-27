#!/usr/bin/env node
// Intake routing eval harness + accuracy baseline.
//
// The sibling of classification-eval.mjs (CLS-G1). That one benchmarks *what*
// a demand is; this one benchmarks *where it should go* — catalogue order,
// call-off against an existing contract, or new demand. A wrong route is the
// failure the user actually sees: it was a wrong route, not a wrong category,
// that offered "business consulting" a box of business cards.
//
// Scope note: this gates the DETERMINISTIC layer only. The LLM's `intent` is
// authoritative at runtime when it is available and can be honoured, and its
// output is not reproducible from the text, so it cannot be held to an accuracy
// floor. The rules are the fallback whenever AI-001 is off or the call fails —
// they have to be right on their own, which is exactly what is measured here.
//
// Self-contained — mirrors src/lib/procurement/intake-routing.ts and the
// classifier rules from classify.ts. Keep in sync.
// Run: npm run test:intake-routing-eval

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors classify.ts ─────────────────────────────────────────────────────

const CATEGORY_RULES = [
  { category: 'consulting', pattern: /consult|advisory|strategy|audit|transformation|business consult|operating model|tom\b|organisational|organizational|change management|programme management|program management|due diligence|feasibility|business case|maturity assessment|roadmap|target state/ },
  { category: 'services', pattern: /\bservice\b|cleaning|catering|maintenance|travel|translation|managed print|managed service|facilities|security guard|payroll|hr admin|helpdesk/ },
  { category: 'software', pattern: /software|saas|license|cloud|platform|subscription|app/ },
  { category: 'contingent-labour', pattern: /temp|contractor|staff|developer|freelance|hire|interim/ },
  { category: 'contract-renewal', pattern: /renew|extend|renewal|expir/ },
  { category: 'supplier-onboarding', pattern: /onboard|new supplier|new vendor|register/ },
  { category: 'catalogue', pattern: /paper|pen|toner|cable|headset|mouse|keyboard|office supplies/ },
];
const classifyDemandCategory = (text) => {
  const q = text.toLowerCase();
  for (const r of CATEGORY_RULES) if (r.pattern.test(q)) return r.category;
  return 'goods';
};

// ── mirrors intake-routing.ts ───────────────────────────────────────────────

const STOP_WORDS = new Set([
  'i', 'a', 'an', 'the', 'of', 'for', 'to', 'we', 'us', 'our', 'my',
  'need', 'want', 'would', 'like', 'please', 'can', 'new', 'some',
  'buy', 'buying', 'purchase', 'purchasing', 'procure', 'order', 'get',
  'looking', 'require', 'requires', 'and', 'with', 'from', 'about',
]);
const MODIFIER_WORDS = new Set([
  'business', 'premium', 'professional', 'standard', 'basic', 'advanced',
  'small', 'large', 'high', 'low', 'good', 'best', 'quality', 'general',
  'corporate', 'company', 'team', 'office', 'annual', 'monthly', 'daily',
]);
const CONFIG = { catalogueMatchThreshold: 0.5, catalogueMinContentMatches: 1 };
const ELIGIBLE = ['catalogue', 'goods'];

const tokenize = (t) => t.toLowerCase().split(/\s+/)
  .map((w) => w.replace(/[^a-z0-9-]/g, ''))
  .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
const contentTokens = (ts) => ts.filter((t) => !MODIFIER_WORDS.has(t));
const tokenMatches = (h, t) =>
  h.includes(t) || (t.endsWith('s') && t.length > 3 && h.includes(t.slice(0, -1)));

function scoreItem(item, tokens) {
  const name = item.name.toLowerCase();
  const hay = `${item.description} ${item.catalogueName}`.toLowerCase();
  let score = 0; const matched = [];
  for (const t of tokens) {
    if (tokenMatches(name, t)) { score += 1.0; matched.push(t); }
    else if (tokenMatches(hay, t)) { score += 0.5; matched.push(t); }
  }
  return { score, matchedContent: contentTokens(matched) };
}

function catalogueMatches(text, category, items) {
  if (!ELIGIBLE.includes(category)) return [];
  const tokens = tokenize(text);
  if (contentTokens(tokens).length === 0) return [];
  return items
    .map((item) => ({ item, ...scoreItem(item, tokens) }))
    .filter((r) => r.matchedContent.length >= CONFIG.catalogueMinContentMatches)
    .filter((r) => r.score >= CONFIG.catalogueMatchThreshold);
}

function contractMatches(text, category, supplierId, contracts) {
  const tokens = tokenize(text);
  const out = [];
  for (const c of contracts) {
    if (c.status !== 'active' && c.status !== 'expiring') continue;
    let score = 0; let primary = false;
    if (supplierId && c.supplierId === supplierId) { score += 0.5; primary = true; }
    if (category && c.category.toLowerCase().includes(category)) { score += 0.3; primary = true; }
    const hay = `${c.title} ${c.category}`.toLowerCase();
    let kw = 0;
    for (const t of tokens) if (hay.includes(t)) kw += 1;
    score += kw * 0.15;
    if (kw >= 2) primary = true;
    if (!primary) continue;
    if (Math.max(0, 100 - (c.utilisationPercentage ?? 0)) < 5) continue;
    if (score >= 0.3) out.push({ contract: c, score });
  }
  return out;
}

function routeFor(text, items, contracts, supplierId = '') {
  const category = classifyDemandCategory(text);
  if (catalogueMatches(text, category, items).length > 0) return 'catalogue';
  if (contractMatches(text, category, supplierId, contracts).length > 0) return 'contract';
  return 'new-demand';
}

// ── fixtures ────────────────────────────────────────────────────────────────
// The catalogue mirrors the live seed's shape: physical goods, office supplies,
// print and IT. Nothing in it is a service, which is the point.

const ITEMS = [
  { name: 'Business Cards 500', description: 'Premium business cards, double-sided, matte', catalogueName: 'Print & Stationery' },
  { name: 'ThinkPad T14 Gen 5', description: 'Lenovo business laptop, 14" FHD, 16GB RAM, 512GB SSD', catalogueName: 'IT Equipment' },
  { name: 'Dell Monitor 27" UltraSharp', description: '27" 4K USB-C monitor with ergonomic stand', catalogueName: 'IT Equipment' },
  { name: 'Logitech MX Keys', description: 'Advanced wireless keyboard with backlight', catalogueName: 'IT Equipment' },
  { name: 'Headset Pro UC', description: 'Professional wireless headset for unified communications', catalogueName: 'IT Equipment' },
  { name: 'A4 Paper 500 sheets', description: 'Premium white A4 copy paper, 80gsm', catalogueName: 'Office Supplies' },
  { name: 'Toner Cartridge Black', description: 'Compatible black toner for HP LaserJet Pro', catalogueName: 'Office Supplies' },
  { name: 'Electric Standing Desk', description: 'Height-adjustable desk, 160x80cm, dual motor', catalogueName: 'Furniture' },
];

const CONTRACTS = [
  { id: 'C1', title: 'Strategy consulting framework', category: 'Consulting', status: 'active', supplierId: 'S1', supplierName: 'AdvisoryCo', value: 2_000_000, utilisationPercentage: 35 },
  { id: 'C2', title: 'Facilities and cleaning services', category: 'Services', status: 'active', supplierId: 'S2', supplierName: 'CleanCo', value: 500_000, utilisationPercentage: 20 },
  { id: 'C3', title: 'Enterprise software licensing', category: 'Software', status: 'active', supplierId: 'S3', supplierName: 'SoftCo', value: 800_000, utilisationPercentage: 50 },
];

// Labelled benchmark — free-text demand → the route it should take, given the
// catalogue and contract register above.
const LABELLED = [
  // The reported defect and its neighbours.
  ['I want to buy business consulting', 'contract'],
  ['business consulting for a new operating model', 'contract'],
  ['strategy advisory for a market entry assessment', 'contract'],
  ['due diligence on an acquisition target', 'contract'],

  // Genuine catalogue orders.
  ['business cards for the sales team', 'catalogue'],
  ['a few laptops for a new starter', 'catalogue'],
  ['A4 paper for the office printer', 'catalogue'],
  ['toner cartridge for the LaserJet', 'catalogue'],
  ['a wireless keyboard and monitor', 'catalogue'],
  ['headsets for the support desk', 'catalogue'],
  ['an electric standing desk', 'catalogue'],

  // Covered by an existing contract.
  ['office cleaning services for the HQ building', 'contract'],
  ['facilities management for three sites', 'contract'],
  ['enterprise software licensing renewal', 'contract'],

  // Genuinely new demand — nothing in the catalogue, nothing covering it.
  ['catering for the annual company summit', 'new-demand'],
  ['translation of marketing materials', 'new-demand'],
  ['an interim finance contractor for six months', 'new-demand'],
  ['a freelance designer for a rebrand', 'new-demand'],
  ['industrial forklift tyres for the warehouse', 'new-demand'],
  ['onboard a new supplier for packaging', 'new-demand'],
];

console.log('Intake routing eval\n');

let correct = 0;
const perRoute = {};
const misses = [];
for (const [text, expected] of LABELLED) {
  const got = routeFor(text, ITEMS, CONTRACTS);
  perRoute[expected] ??= { total: 0, correct: 0 };
  perRoute[expected].total += 1;
  if (got === expected) { correct += 1; perRoute[expected].correct += 1; }
  else misses.push({ text, expected, got });
}
const accuracy = correct / LABELLED.length;

console.log(`  Overall: ${correct}/${LABELLED.length} (${(accuracy * 100).toFixed(1)}%)\n`);
console.log('  Per route:');
for (const [r, s] of Object.entries(perRoute)) {
  console.log(`    ${r.padEnd(12)} ${s.correct}/${s.total}`);
}
if (misses.length) {
  console.log('\n  Misrouted:');
  for (const m of misses) console.log(`    "${m.text}" → ${m.got} (expected ${m.expected})`);
}

console.log('');

// Known gap, left visible on purpose rather than relabelled away:
// "catering for the annual company summit" and "translation of marketing
// materials" both route to `contract`, matching the Facilities and cleaning
// contract on its *category* alone (+0.3, no keyword hits). That is the contract
// analogue of the catalogue defect — a match carried by a generic signal rather
// than by what is being bought. The contract matcher was deliberately moved
// across unchanged in this change, so the miss is recorded here instead of
// hidden by softening the labels. Tightening it is a separate piece of work.

// Baseline gate — the routing rules must hold the floor.
const BASELINE = 0.85;
check(`accuracy ≥ ${(BASELINE * 100).toFixed(0)}% baseline`, accuracy >= BASELINE, `${(accuracy * 100).toFixed(1)}%`);

// Every route must be reachable — a rule set that never returns one of the
// three is broken however good its headline accuracy looks.
for (const r of ['catalogue', 'contract', 'new-demand']) {
  check(`route "${r}" is represented and reachable`, (perRoute[r]?.correct ?? 0) >= 1);
}

// The specific regression, asserted outright rather than left to the average:
// no service-category demand may ever reach the catalogue.
const SERVICE_DEMANDS = [
  'I want to buy business consulting',
  'strategy advisory for the board',
  'office cleaning services',
  'an interim contractor',
  'cloud software subscription',
];
for (const d of SERVICE_DEMANDS) {
  check(`"${d}" never routes to the catalogue`, routeFor(d, ITEMS, CONTRACTS) !== 'catalogue');
}

if (failures) { console.error(`\nFAILED: ${failures} check(s)`); }
else console.log('\nAll intake-routing-eval checks passed.');
process.exit(failures === 0 ? 0 : 1);
