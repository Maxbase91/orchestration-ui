#!/usr/bin/env node
// Intake routing — catalogue vs contract vs new demand.
//
// Leads with the reported defect: "I want to buy business consulting" opened the
// catalogue item for **business cards**. The word "business" hit the item's
// name and scored 1.0; "consulting" — the only word saying what was being
// bought — matched nothing and cost nothing. Of 37 live catalogue items, zero
// contain "consult", so the catalogue could not fulfil that demand at all.
//
// Self-contained — mirrors src/lib/procurement/intake-routing.ts. Keep in sync.
// Run: npm run test:intake-routing

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

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

const tokenize = (text) =>
  text.toLowerCase().split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ''))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

const contentTokens = (tokens) => tokens.filter((t) => !MODIFIER_WORDS.has(t));

function tokenMatches(haystack, token) {
  if (haystack.includes(token)) return true;
  if (token.endsWith('s') && token.length > 3 && haystack.includes(token.slice(0, -1))) return true;
  return false;
}

function scoreCatalogueItem(item, tokens) {
  const name = item.name.toLowerCase();
  const haystack = `${item.description} ${item.catalogueName}`.toLowerCase();
  let score = 0;
  const matched = [];
  for (const t of tokens) {
    if (tokenMatches(name, t)) { score += 1.0; matched.push(t); }
    else if (tokenMatches(haystack, t)) { score += 0.5; matched.push(t); }
  }
  return { score, matched, matchedContent: contentTokens(matched) };
}

function matchCatalogue(demand, items, eligible, config = CONFIG) {
  const tokens = tokenize(demand.text);
  const content = contentTokens(tokens);
  if (!demand.text.trim()) return { matches: [], ruledOut: 'Nothing captured yet to match against.' };
  if (!eligible.includes(demand.category)) {
    return {
      matches: [],
      ruledOut: demand.category
        ? `${demand.category} demand isn't fulfilled from the catalogue.`
        : 'The category is not yet known, so the catalogue cannot be checked.',
    };
  }
  if (content.length === 0) {
    return { matches: [], ruledOut: 'The description is all general words — nothing specific to match on yet.' };
  }
  const scored = items
    .map((item) => ({ item, ...scoreCatalogueItem(item, tokens) }))
    .filter((r) => r.matchedContent.length >= config.catalogueMinContentMatches)
    .filter((r) => r.score >= config.catalogueMatchThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  if (scored.length === 0) return { matches: [], ruledOut: 'No catalogue item covers what was described.' };
  return { matches: scored.map((r) => ({ item: r.item, score: r.score, matched: r.matched })) };
}

function scoreContract(contract, ctx, fmt) {
  if (contract.status !== 'active' && contract.status !== 'expiring') return null;
  let score = 0;
  const reasons = [];
  let primary = false;
  if (ctx.supplierId && contract.supplierId === ctx.supplierId) {
    score += 0.5; primary = true; reasons.push(`matches selected supplier ${contract.supplierName}`);
  }
  if (contract.category.toLowerCase().includes(ctx.category) && ctx.category) {
    score += 0.3; primary = true; reasons.push(`contract category is ${contract.category}`);
  }
  const haystack = `${contract.title} ${contract.category}`.toLowerCase();
  let kwHits = 0;
  for (const t of ctx.tokens) {
    if (haystack.includes(t)) {
      kwHits += 1;
      if (!reasons.some((r) => r.includes(t))) reasons.push(`matches "${t}"`);
    }
  }
  score += kwHits * 0.15;
  if (kwHits >= 2) primary = true;
  if (!primary) return null;
  const remainingPct = Math.max(0, 100 - (contract.utilisationPercentage ?? 0));
  if (remainingPct < 5) return null;
  if (ctx.estimatedValue > 0 && contract.value > 0) {
    const remaining = contract.value * (remainingPct / 100);
    if (remaining >= ctx.estimatedValue) { score += 0.2; reasons.push(`has ~${fmt(remaining)} remaining capacity`); }
  }
  return score >= 0.3 ? { score, reasons } : null;
}

function matchContracts(demand, contracts, fmt) {
  if (!demand.text && !demand.supplierId) return { matches: [], ruledOut: 'Nothing captured yet to match against.' };
  const tokens = tokenize(demand.text);
  const out = [];
  for (const c of contracts) {
    const m = scoreContract(c, { tokens, category: demand.category, estimatedValue: demand.estimatedValue, supplierId: demand.supplierId }, fmt);
    if (m) out.push({ contract: c, ...m });
  }
  if (out.length === 0) return { matches: [], ruledOut: 'No active contract appears to cover this.' };
  return { matches: out.sort((a, b) => b.score - a.score).slice(0, 4) };
}

const LLM_INTENT_TO_ROUTE = { catalogue: 'catalogue', 'new-request': 'new-demand' };

function decideIntakeRoute(demand, data, config = CONFIG, fmt = (n) => String(Math.round(n))) {
  const cat = matchCatalogue(demand, data.catalogueItems, data.catalogueEligibleCategories, config);
  const con = matchContracts(demand, data.contracts, fmt);
  const ruledOut = {};
  if (cat.ruledOut) ruledOut.catalogue = cat.ruledOut;
  if (con.ruledOut) ruledOut.contract = con.ruledOut;
  const base = { catalogueMatches: cat.matches, contractMatches: con.matches, ruledOut };

  const rules = cat.matches.length > 0
    ? { route: 'catalogue', reasons: ['catalogue covers this'], confidence: cat.matches[0].score >= config.catalogueMatchThreshold * 2 ? 'high' : 'medium' }
    : con.matches.length > 0
      ? { route: 'contract', reasons: [`${con.matches[0].contract.title} may already cover this`], confidence: con.matches[0].score >= 0.8 ? 'high' : 'medium' }
      : { route: 'new-demand', reasons: [cat.ruledOut, con.ruledOut].filter(Boolean), confidence: 'high' };

  const llmRoute = demand.llmIntent ? LLM_INTENT_TO_ROUTE[demand.llmIntent] : undefined;
  if (!llmRoute) return { ...base, decidedBy: 'rules', ...rules };
  if (llmRoute === 'catalogue' && cat.matches.length === 0) {
    return { ...base, decidedBy: 'rules', ...rules, llmOverruled: `overruled: ${cat.ruledOut}` };
  }
  return { ...base, route: llmRoute, decidedBy: 'llm', confidence: 'high', reasons: ['from the assistant'] };
}

// ── fixtures: the real live catalogue rows that produced the defect ─────────

const ITEMS = [
  { id: 'PS-001', name: 'Business Cards 500', description: 'Premium business cards, double-sided, matte', catalogueName: 'Print & Stationery', unitPrice: 35, unit: 'pack', supplierName: 'PrintCo', supplierId: 'S1', leadTime: '3-5 days' },
  { id: 'IT-001', name: 'ThinkPad T14 Gen 5', description: 'Lenovo business laptop, 14" FHD, 16GB RAM, 512GB SSD', catalogueName: 'IT Equipment', unitPrice: 1299, unit: 'each', supplierName: 'Lenovo', supplierId: 'S2', leadTime: '5-7 days' },
  { id: 'OS-001', name: 'A4 Paper 500 sheets', description: 'Premium white A4 copy paper, 80gsm', catalogueName: 'Office Supplies', unitPrice: 5, unit: 'pack', supplierName: 'Staples', supplierId: 'S3', leadTime: '1-2 days' },
];

const CONTRACTS = [
  { id: 'CON-1', title: 'Strategy consulting framework', category: 'Consulting', status: 'active', supplierId: 'S9', supplierName: 'AdvisoryCo', value: 1_000_000, utilisationPercentage: 40 },
  { id: 'CON-2', title: 'Office cleaning', category: 'Services', status: 'active', supplierId: 'S8', supplierName: 'CleanCo', value: 200_000, utilisationPercentage: 10 },
  { id: 'CON-3', title: 'Exhausted consulting deal', category: 'Consulting', status: 'active', supplierId: 'S7', supplierName: 'MaxedCo', value: 100_000, utilisationPercentage: 99 },
];

const ELIGIBLE = ['catalogue', 'goods'];
const route = (text, category, extra = {}) =>
  decideIntakeRoute(
    { text, category, estimatedValue: 0, supplierId: '', ...extra },
    { catalogueItems: ITEMS, contracts: CONTRACTS, catalogueEligibleCategories: ELIGIBLE },
  );
const names = (d) => d.catalogueMatches.map((m) => m.item.name);

// ── the reported defect ─────────────────────────────────────────────────────

console.log('The reported defect: "business consulting" → business cards');
const bug = route('I want to buy business consulting', 'consulting');
check('never routes to the catalogue', bug.route !== 'catalogue', bug.route);
check('Business Cards 500 is NOT offered', !names(bug).includes('Business Cards 500'), names(bug).join(', '));
check('ThinkPad ("business laptop") is NOT offered', !names(bug).includes('ThinkPad T14 Gen 5'));
check('no catalogue match at all', bug.catalogueMatches.length === 0);
check('the reason is stated, not left silent', typeof bug.ruledOut.catalogue === 'string' && bug.ruledOut.catalogue.length > 0);
check('the reason names the category', /consulting/.test(bug.ruledOut.catalogue));
// With a covering consulting framework in the register, `contract` is the right
// answer — the funnel is meant to find one. What must never happen is the
// catalogue. Strip the contracts and the same demand becomes new demand.
check('with a covering framework, it offers the call-off', bug.route === 'contract', bug.route);
const noCover = decideIntakeRoute(
  { text: 'I want to buy business consulting', category: 'consulting', estimatedValue: 0, supplierId: '' },
  { catalogueItems: ITEMS, contracts: [], catalogueEligibleCategories: ELIGIBLE },
);
check('with nothing covering it, it is new demand', noCover.route === 'new-demand', noCover.route);
check('and says why BOTH other routes were ruled out',
  typeof noCover.ruledOut.catalogue === 'string' && typeof noCover.ruledOut.contract === 'string');

console.log('\nDefence in depth — the modifier gate holds even if the category gate is wrong');
// If a consulting demand were mis-classified as goods, "consulting" still
// matches nothing, so no item can be carried by "business" alone.
const misfiled = route('I want to buy business consulting', 'goods');
check('a mis-classified consulting demand still matches nothing', misfiled.catalogueMatches.length === 0);
check('and still routes away from the catalogue', misfiled.route !== 'catalogue');

console.log('\nThe verbose-ask regression the old comment was written to prevent');
// An earlier matcher divided by query length and this matched nothing; a
// fraction-based coverage rule breaks it the same way (1 naming word of 3).
const laptops = route('a few laptops for a new starter', 'goods');
check('"a few laptops for a new starter" still reaches the catalogue', laptops.route === 'catalogue', laptops.route);
check('the ThinkPad is matched on its description', names(laptops).includes('ThinkPad T14 Gen 5'));

console.log('\n"business" is not banned — it just cannot carry a route alone');
const cards = route('business cards for the sales team', 'goods');
check('a genuine business-cards demand still matches', cards.route === 'catalogue');
check('Business Cards 500 is offered', names(cards).includes('Business Cards 500'));
const paper = route('A4 paper for the office printer', 'catalogue');
check('an office-supplies demand still matches', names(paper).includes('A4 Paper 500 sheets'));

console.log('\nCategory eligibility gates the catalogue');
for (const c of ['consulting', 'services', 'software', 'contingent-labour', 'contract-renewal', 'supplier-onboarding']) {
  check(`${c} is never offered a catalogue item`, route('paper laptops cards', c).catalogueMatches.length === 0);
}
check('goods is', route('laptops', 'goods').catalogueMatches.length > 0);
check('an unknown category is NOT eligible (fail safe)', route('laptops', 'made-up-category').catalogueMatches.length === 0);
check('an empty category is NOT eligible', route('laptops', '').catalogueMatches.length === 0);

console.log('\nAll-modifier descriptions do not match');
const vague = route('business standard professional office quality', 'goods');
check('a description with no naming words matches nothing', vague.catalogueMatches.length === 0);
check('and says the description is too general, not just "no match"',
  /general words/.test(vague.ruledOut.catalogue ?? ''), vague.ruledOut.catalogue);
// A description that names something the catalogue simply lacks gets the other
// message — the two cases need different advice, so they must not collapse.
const absent = route('industrial forklift tyres', 'goods');
check('a specific but uncatalogued need says no item covers it',
  /No catalogue item covers/.test(absent.ruledOut.catalogue ?? ''), absent.ruledOut.catalogue);

console.log('\nThe LLM intent is authoritative — within one bound');
const llmNew = route('laptops', 'goods', { llmIntent: 'new-request' });
check('an LLM "new-request" overrides a catalogue match', llmNew.route === 'new-demand');
check('and is recorded as the deciding layer', llmNew.decidedBy === 'llm');
const llmCat = route('I want to buy business consulting', 'consulting', { llmIntent: 'catalogue' });
check('an LLM "catalogue" CANNOT route to an empty catalogue', llmCat.route !== 'catalogue', llmCat.route);
check('the rules decide instead', llmCat.decidedBy === 'rules');
check('and the disagreement is surfaced, not hidden', typeof llmCat.llmOverruled === 'string');
const llmNav = route('laptops', 'goods', { llmIntent: 'navigation' });
check('a non-demand intent carries no routing information', llmNav.decidedBy === 'rules');
check('an unrecognised intent falls back to the rules', route('laptops', 'goods', { llmIntent: 'nonsense' }).decidedBy === 'rules');
const noLlm = route('laptops', 'goods');
check('LLM absent → identical to rules-only', noLlm.route === llmNav.route && noLlm.decidedBy === 'rules');

console.log('\nContract matching is unchanged');
const consult = route('strategy consulting framework engagement', 'consulting');
check('a consulting demand reaches the contract route', consult.route === 'contract', consult.route);
check('the covering contract is the framework', consult.contractMatches[0].contract.id === 'CON-1');
check('an exhausted contract (>=95% utilised) is excluded',
  !consult.contractMatches.some((m) => m.contract.id === 'CON-3'));
const bySupplier = decideIntakeRoute(
  { text: 'some engagement', category: 'consulting', estimatedValue: 0, supplierId: 'S9' },
  { catalogueItems: ITEMS, contracts: CONTRACTS, catalogueEligibleCategories: ELIGIBLE },
);
check('the selected supplier is a primary signal on its own', bySupplier.contractMatches[0].contract.supplierId === 'S9');
check('an incidental one-word overlap is not a match',
  matchContracts({ text: 'office refurbishment', category: 'goods', estimatedValue: 0, supplierId: '' }, CONTRACTS, String).matches.length === 0);

console.log('\nEvery route explains itself');
for (const [text, cat] of [['I want to buy business consulting', 'consulting'], ['laptops', 'goods'], ['strategy consulting framework engagement', 'consulting']]) {
  const d = route(text, cat);
  check(`"${text}" gives at least one reason`, d.reasons.length > 0);
}

// ── The anti-drift gate: step 2 and step 5 must give the same channel ───────
//
// The channel is now shown on the pre-check, four steps before the
// determination that used to be its first sight. That is only safe if it is the
// SAME answer — a second derivation on the pre-check would be exactly the drift
// this codebase has paid for repeatedly (three narrative composers, two
// classifiers, a test panel that implemented its own evaluator). Both screens
// call `resolveDemandChannel`; this mirrors it once and checks that a single
// resolver is enough to reproduce both.

const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
const RULE_FIELDS = new Set([
  'category', 'value', 'supplierId', 'commodityCode', 'priority',
  'isUrgent', 'riskRating', 'material', 'contractId', 'region',
]);

function evalCond(field, operator, value, ctx) {
  const actual = RULE_FIELDS.has(field) ? ctx[field] : undefined;
  const empty = actual === undefined || actual === null || actual === '' || actual === false;
  if (operator === 'is_empty') return empty;
  if (operator === 'is_not_empty') return !empty;
  if (actual === undefined) return false;
  const num = (v) => (typeof v === 'number' ? v : Number.isFinite(Number(v)) ? Number(v) : null);
  switch (operator) {
    case 'equals': return String(actual) === value;
    case 'greater_than': return num(actual) !== null && num(value) !== null && num(actual) > num(value);
    case 'less_than': return num(actual) !== null && num(value) !== null && num(actual) < num(value);
    case 'in': return value.split(',').map((x) => x.trim()).includes(String(actual));
    case 'starts_with': return String(actual).startsWith(value);
    case 'contains': return String(actual).toLowerCase().includes(value.toLowerCase());
    case 'between': {
      const [lo, hi] = value.split(',').map((x) => Number(x.trim()));
      return num(actual) !== null && num(actual) >= lo && num(actual) <= hi;
    }
    case 'risk_rating': return RISK_ORDER[actual] !== undefined && RISK_ORDER[value] !== undefined
      && RISK_ORDER[actual] >= RISK_ORDER[value];
    default: return false;
  }
}

function fallbackChannel(ctx) {
  const value = ctx.value ?? 0;
  if (value < 25000) return 'catalogue';
  if (ctx.category === 'consulting' || value > 100000) return 'procurement-led';
  if (ctx.category === 'contingent-labour') return 'framework-call-off';
  if (value <= 50000) return 'business-led';
  return 'procurement-led';
}

/** Mirrors resolveDemandChannel — the one derivation both screens call. */
function resolveDemandChannel(rules, input) {
  const ctx = {
    category: input.category,
    value: input.value,
    supplierId: input.supplierId,
    contractId: input.contractId,
    // priority is DERIVED from isUrgent: the two are one fact, and RR-010
    // requires both, so setting one without the other disarms the rule.
    priority: input.isUrgent ? 'urgent' : undefined,
    isUrgent: input.isUrgent,
    riskRating: input.riskRating,
    material: input.material,
  };
  const matched = rules.find((r) => r.status === 'active' && (r.conditions ?? []).length > 0
    && r.conditions.every((c) => evalCond(c.field, c.operator, c.value, ctx)));
  return { channel: matched ? matched.action.buyingChannel : fallbackChannel(ctx), matchedRule: matched ?? null };
}

// The live rule set, in evaluation order (RR-001 as repaired).
const RULES = [
  { id: 'RR-001', name: 'High-value IT software', status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'software' },
      { field: 'value', operator: 'greater_than', value: '100000' },
    ], action: { buyingChannel: 'procurement-led' } },
  { id: 'RR-010', name: 'Urgent request fast-track', status: 'active',
    conditions: [
      { field: 'priority', operator: 'equals', value: 'urgent' },
      { field: 'isUrgent', operator: 'equals', value: 'true' },
    ], action: { buyingChannel: 'procurement-led' } },
];

console.log('\nThe pre-check and the determination give the same channel');
const LABELLED = [
  { category: 'goods', value: 8_000 },
  { category: 'goods', value: 40_000 },
  { category: 'services', value: 60_000 },
  { category: 'software', value: 30_000 },
  { category: 'software', value: 150_000 },
  { category: 'consulting', value: 400_000 },
  { category: 'contingent-labour', value: 45_000 },
  { category: 'services', value: 80_000, supplierId: 'S9' },
];
for (const demand of LABELLED) {
  // Step 2 knows category, value, supplier and (now) the contract question.
  const atPreCheck = resolveDemandChannel(RULES, demand);
  // Step 5 knows the same, plus the risk and materiality reads — which no live
  // rule uses, so the answer must not move.
  const atDetermination = resolveDemandChannel(RULES, {
    ...demand, riskRating: 'high', material: true,
  });
  check(`${demand.category} @ ${demand.value} agrees across both screens`,
    atPreCheck.channel === atDetermination.channel,
    `${atPreCheck.channel} vs ${atDetermination.channel}`);
}

console.log('\nUrgency is the one input that still moves the answer');
const urgencyChanges = (demand) => {
  const calm = resolveDemandChannel(RULES, { ...demand, isUrgent: false }).channel;
  const urgent = resolveDemandChannel(RULES, { ...demand, isUrgent: true }).channel;
  return calm === urgent ? null : { from: calm, to: urgent };
};
const midServices = { category: 'services', value: 40_000 };
check('a mid-value demand changes channel when marked urgent', urgencyChanges(midServices) !== null);
check('and only ever escalates to procurement-led',
  urgencyChanges(midServices).to === 'procurement-led');
// The note must be silent where it would say nothing — a warning that is always
// on is one nobody reads.
check('a demand already routed to procurement-led shows no urgency note',
  urgencyChanges({ category: 'consulting', value: 400_000 }) === null);
check('a low-value catalogue demand is not silently escalated by the fallback',
  resolveDemandChannel(RULES, { category: 'goods', value: 8_000 }).channel === 'catalogue');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); }
else console.log('All intake-routing checks passed.');
process.exit(failures === 0 ? 0 : 1);
