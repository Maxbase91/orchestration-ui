#!/usr/bin/env node
// Intake routing — catalogue vs contract vs new demand.
//
// Leads with the reported defect: "I want to buy business consulting" opened the
// catalogue item for **business cards**. The word "business" hit the item's
// name and scored 1.0; "consulting" — the only word saying what was being
// bought — matched nothing and cost nothing. Of 37 live catalogue items, zero
// contain "consult", so the catalogue could not fulfil that demand at all.
//
// Runs the real modules — the route decision and the channel resolver — over
// the seeded rules. It used to carry copies of both.
// Run: npm run test:intake-routing

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors intake-routing.ts ───────────────────────────────────────────────

// The real module, not a copy. This file used to carry its own version of the
// routing ("Self-contained — mirrors intake-routing.ts. Keep in sync"), so it
// tested the copy: a change to the module could pass here unseen.
import { decideIntakeRoute as decideReal, matchContracts } from '../../src/lib/procurement/intake-routing.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';

const CONFIG = DEFAULT_POLICY_CONFIG;
const decideIntakeRoute = (demand, data, config = CONFIG, fmt = (n) => String(Math.round(n))) => decideReal(demand, data, config, fmt);

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
for (const c of ['consulting', 'services', 'software', 'contingent-labour']) {
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

// ── The direct call-off limit ───────────────────────────────────────────────
// Above it a covering contract is not a direct award: the call-off needs a
// mini-competition, so the contract route is ruled out in place, naming the
// contract — not offered here and refused at checkout.
console.log('\nThe direct call-off limit');
{
  const ask = (value, config = CONFIG) => decideIntakeRoute(
    { text: 'strategy consulting advisory', category: 'consulting', estimatedValue: value, supplierId: '' },
    { catalogueItems: ITEMS, contracts: CONTRACTS, catalogueEligibleCategories: ELIGIBLE }, config);
  const under = ask(200_000);
  const over = ask(300_000);
  check('under the limit a covering contract is offered', under.route === 'contract' && under.contractMatches.length > 0, under.route);
  check('over the limit it is ruled out, and the request goes in as new demand',
    over.route === 'new-demand' && over.contractMatches.length === 0, over.route);
  check('…saying why, and naming the contract',
    /direct call-off limit/.test(over.ruledOut.contract ?? '') && /Strategy consulting framework/.test(over.ruledOut.contract ?? ''),
    over.ruledOut.contract);
  check('the limit is the configured one, not a literal',
    ask(300_000, { ...CONFIG, directCallOffLimit: 500_000 }).route === 'contract');
}

// ── The anti-drift gate: step 2 and step 5 must give the same channel ───────
//
// The channel is now shown on the pre-check, four steps before the
// determination that used to be its first sight. That is only safe if it is the
// SAME answer — a second derivation on the pre-check would be exactly the drift
// this codebase has paid for repeatedly (three narrative composers, two
// classifiers, a test panel that implemented its own evaluator). Both screens
// call `resolveDemandChannel`; this checks that one resolver, over the seeded
// rules, gives both screens the same answer.

// The real resolver and the seeded rule set. This section carried its own
// evaluator and the if-ladder fallback that C3 replaced with catch-all rules —
// so it went on passing against a rule the product no longer has.
import { resolveDemandChannel as resolveReal } from '../../src/lib/routing/demand-channel.ts';
import { routingRules as RULES } from '../../src/data/routing-rules.ts';

const NO_SIGNALS = {
  supplierId: undefined, contractId: undefined, isUrgent: undefined, riskRating: undefined,
  material: undefined, region: undefined, commodityCode: undefined,
};
const resolveDemandChannel = (rules, input) => resolveReal(rules, { ...NO_SIGNALS, ...input }, CONFIG);

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
// A small demand described in Door 1 is the business's to buy — routing no
// longer turns it into a catalogue order with no item behind it.
check('a low-value Door 1 demand is business-led, not escalated',
  resolveDemandChannel(RULES, { category: 'goods', value: 8_000 }).channel === 'business-led');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); }
else console.log('All intake-routing checks passed.');
process.exit(failures === 0 ? 0 : 1);
