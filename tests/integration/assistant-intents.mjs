#!/usr/bin/env node
// Verifies the assistant intent classifier routes a procurement demand to the
// intake flow — not a support ticket. Regression for "I need consultants for a
// promptathon" landing on a TKT-#### handover.
//
// It tested a copy of classifyIntent written into this file ("keep in sync")
// — a copy that could not notice the original's two copies of its own rules,
// or the supplier names typed into both. It drives the real module now.
// Run: npm run test:assistant-intents

import { readFileSync } from 'node:fs';
import { classifyIntent } from '../../src/lib/assistant/intents.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('Procurement demands route to intake (NOT a support ticket)');
check('"I need consultants for a promptathon" → intake', classifyIntent('I need consultants for a promptathon') === 'intake');
check('"we need a contractor for 3 months" → intake', classifyIntent('we need a contractor for 3 months') === 'intake');
check('"looking for an agency to run an event" → intake', classifyIntent('looking for an agency to run an event') === 'intake');
check('"I want to buy 50 laptops" → intake', classifyIntent('I want to buy 50 laptops') === 'intake');
check('"hire a developer" → intake', classifyIntent('hire a developer') === 'intake');
check('the regression case is NOT handover', classifyIntent('I need consultants for a promptathon') !== 'handover');

console.log('Genuine human-help still routes to handover');
check('"I need to speak to someone" → handover', classifyIntent('I need to speak to someone') === 'handover');
check('"put me through to a person" → handover', classifyIntent('put me through to a person') === 'handover');

console.log('Other intents unaffected');
// A supplier is recognised by its id or by how the question is put, not by a
// list of names in code a new supplier would never join.
check('no supplier names in the classifier',
  !/accenture|deloitte|capgemini/i.test(readFileSync(new URL('../../src/lib/assistant/intents.ts', import.meta.url), 'utf8')));
check('"tell me about SUP-013" → lookup', classifyIntent('tell me about SUP-013') === 'lookup');
check('"What is the consulting threshold?" → knowledge', classifyIntent('What is the consulting threshold?') === 'knowledge');
check('"I need to know the policy" → not intake', classifyIntent('I need to know the policy') !== 'intake');
check('"Set my delegate to Jane Smith" → action', classifyIntent('Set my delegate to Jane Smith') === 'action');
check('"status of REQ-2024-0001" → lookup', classifyIntent('status of REQ-2024-0001') === 'lookup');

console.log('LLM chat rules (api/chat.ts) prioritise demand over ticket');
const chatSrc = readFileSync(new URL('../../api/chat.ts', import.meta.url), 'utf8');
check('procure/hire intent is explicitly a start_demand, never a ticket',
  /PROCUREMENT DEMAND[\s\S]*never a support ticket/i.test(chatSrc) || chatSrc.includes('it is NEVER a support ticket'));
check('create_ticket restricted to explicit human-help (not a fallback)',
  chatSrc.includes('create_ticket ONLY when the user EXPLICITLY asks for human help'));
check('provider function citation markers are stripped before display',
  chatSrc.includes('stripTechnicalSourceMarkers') && chatSrc.includes('functions\\.)?') && chatSrc.includes('["\']source["\']'));
check('plain source markers are stripped before display', chatSrc.includes('source\\s*】'));
check('provider source result markers are stripped before display', chatSrc.includes('source\\s*:\\s*(?:functions\\.)?') && chatSrc.includes('(?:\\s+result)?'));
// Scoping now goes through the shared ownedRequestIds() helper, which matches
// the requester *or* the owner — the same rule the requests and invoice
// branches use, rather than the requester-only test this pinned before.
check('most-recent PO lookup is scoped to the caller and date-ordered',
  chatSrc.includes('ownedRequestIds(userId)') && chatSrc.includes("order('created_at', { ascending: false })"));
check('the caller scope is requester or owner',
  chatSrc.includes('`requestor_id.eq.${userId},owner_id.eq.${userId}`'));
check('most-recent PO answers bypass model list selection',
  chatSrc.includes('latestPOQuestion') && chatSrc.includes("execFilterObjects('purchase_orders', undefined, 1, userId, role)"));

console.log('One classifier, not two');
// The assistant used to carry a private `guessCategory` keyword table whose
// `consulting` and `services` entries both claimed "advisory" and which
// defaulted everything unmatched to `services` — so the assistant and the
// wizard could hand back different categories for the same sentence. Both now
// call classifyDemandCategory. This asserts the duplicate is gone and stays gone.
const intakeSrc = readFileSync(new URL('../../src/lib/assistant/capabilities/intake.ts', import.meta.url), 'utf8');
check('the assistant has no private category keyword table',
  !intakeSrc.includes('categoryKeywords') && !intakeSrc.includes('guessCategory'));
// Since 2026-09-25 the assistant does not classify at all: it hands the words
// to the describe step (?q=), which classifies with the configured categories —
// the same route a demand typed on Home takes.
check('the assistant hands a demand to the describe step with its words',
  /\/requests\/new\?q=\$\{encodeURIComponent\(text\)\}/.test(intakeSrc) && !/knownSuppliers/.test(intakeSrc));

// The real classifier with the seeded keywords (it was a copy of the old regex).
const { classifyDemandCategory: classifyWith } = await import('../../src/lib/procurement/classify.ts');
const { DEFAULT_CATEGORY_TAXONOMY } = await import('../../src/data/category-taxonomy.ts');
const classifyDemandCategory = (text) => classifyWith(text, DEFAULT_CATEGORY_TAXONOMY);
// The reported case: the old table returned `consulting` here too, but only by
// luck — "advisory" alone tipped either way depending on key order.
check('"I want to buy business consulting" classifies as consulting',
  classifyDemandCategory('I want to buy business consulting') === 'consulting');
check('an advisory demand no longer depends on key order',
  classifyDemandCategory('advisory support for the finance team') === 'consulting');
check('an unmatched demand is goods, not a silent "services" default',
  classifyDemandCategory('twelve reams of A5 card stock') === 'goods');

// ── The command bar is a second door into the catalogue ─────────────────────
//
// The reported defect — "I want to buy business consulting" opening Business
// Cards 500 — was fixed in the wizard's pre-check (`intake-routing.ts`) and
// came back, because the home page's command bar is a SEPARATE entry point that
// never called that decision. It had its own matcher: strip stop words, score
// an item on any word appearing anywhere in its name, description or catalogue
// name, return everything above zero — and it ran FIRST, before any intent or
// category reasoning, with no category gate. "business" hit "Business Cards
// 500" and the ThinkPad ("business laptop" in its description), while
// "consulting" matched nothing and cost nothing.
//
// So this checks the SOURCE, not a mirror: a mirror of the shared decision
// would have passed the whole time the command bar was ignoring it.

const BAR_SRC = readFileSync(
  new URL('../../src/features/dashboard/components/smart-command-bar.tsx', import.meta.url),
  'utf8',
);
const { catalogueItemsFor, isDemand, routeQuestion } = await import('../../src/lib/assistant/question-route.ts');
// Two items the reported defect turned on: "business" in the name of one and
// the description of the other.
const CATALOGUE = [
  { id: 'OS-010', name: 'Business Cards 500', description: 'Printed business cards', unitPrice: 45, unit: 'box', catalogueId: 'print-stationery', catalogueName: 'Print & Stationery', supplierName: 'PrintCo', supplierId: 'SUP-P', leadTime: '3 days', available: true, category: 'goods' },
  { id: 'OS-001', name: 'A4 Printer Paper (5 reams)', description: 'Copier paper 80gsm', unitPrice: 24, unit: 'box', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'OfficeCo', supplierId: 'SUP-O', leadTime: '2 days', available: true, category: 'goods' },
];
const ROUTE_DATA = { catalogueItems: CATALOGUE, catalogueEligibleCategories: ['goods', 'catalogue'], categories: DEFAULT_CATEGORY_TAXONOMY };

console.log('\nThe Home box routes through the one question route');
// It carried its own route — and the assistant another. Both call
// question-route.ts now, which calls the shared intake decision, so the
// behaviour is asserted by CALLING it rather than by reading the box's source.
check('the Home box asks the shared route', /useQuestionRoute\(\)/.test(BAR_SRC) && !/decideIntakeRoute|localClassify/.test(BAR_SRC));
check('"buy business consulting" is not a catalogue order',
  catalogueItemsFor('I want to buy business consulting', ROUTE_DATA).length === 0);
check('printer paper is', catalogueItemsFor('printer paper', ROUTE_DATA).some((i) => i.id === 'OS-001'));
check('an ineligible category keeps the catalogue closed',
  catalogueItemsFor('printer paper', { ...ROUTE_DATA, catalogueEligibleCategories: [] }).length === 0);
check('the private catalogue matcher is gone', !/function searchCatalogueItems|CATALOGUE_STOP_WORDS/.test(BAR_SRC));
check('no supplier table or category cascade in the box',
  !/SUPPLIER_ROUTES|consult\|advisory\|strategy/.test(BAR_SRC));

// ── The third door: classification choosing the route ───────────────────────
//
// The wizard keys its ENTIRE journey off the category — `isCatalogue` in
// new-request-page turns on for `category === 'catalogue'` and swaps the step
// list, the step-3 screen and the gates. So a classifier answering "catalogue"
// silently reconfigured the whole flow and skipped `decideIntakeRoute`
// altogether. Two ways in: step 1's own classification prompt, which listed
// `catalogue` among the categories (api/ai.ts never did), and the `?category=`
// link the command bar builds from the deterministic classifier.
//
// Source checks again, for the same reason as the command bar above: a mirror
// of the decision would pass while the wizard ignored it.

const STEP1_SRC = readFileSync(
  new URL('../../src/features/requests/new-request/step-category.tsx', import.meta.url), 'utf8');
const WIZARD_SRC = readFileSync(
  new URL('../../src/features/requests/new-request/new-request-page.tsx', import.meta.url), 'utf8');
const DEEP_LINK_SRC = readFileSync(
  new URL('../../src/features/requests/new-request/intake-deep-link.ts', import.meta.url), 'utf8');
const ITEMS_SRC = readFileSync(
  new URL('../../src/data/catalogue-items.ts', import.meta.url), 'utf8');

console.log('\nClassification does not get to choose the route');
// The wizard's prompt widened api/ai.ts's category list with a route.
// The category list is no longer typed into the client's request at all: the
// server builds it from the configured categories (api/ai.ts).
check('step 1 does not type a category list into its request to the model',
  !/"category":"goods\|/.test(STEP1_SRC) && /one of the configured category ids/.test(STEP1_SRC));
check('the classifier prompt is built from the configured categories',
  (() => { const ai = readFileSync(new URL('../../api/ai.ts', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    return /systemPromptFor\(categories\)/.test(ai) && /from\('procurement_categories'\)/.test(ai) && !/Pens €8|Items under €500/.test(ai); })());
check('step 1 guards a route-shaped classification',
  /ROUTE_LIKE_CATEGORY/.test(STEP1_SRC) && /classifyCommodityCategory\(/.test(STEP1_SRC));
// The signal is corrected, not discarded: "catalogue" becomes an intent, which
// the pre-check already honours AND guards.
check('a route-shaped answer is kept as an intent', /intent = 'catalogue'/.test(STEP1_SRC));
// The guard moved out of the page into the deep-link parser, where it can be
// asserted by CALLING it — see test:unified-intake, which parses a
// `category=catalogue` link and checks the category is re-derived. This keeps
// the structural half: the page must not parse links itself and reintroduce a
// second, unguarded reading.
// The `?step=2&category=…` link carried a second classification past the
// describe step. It has no producer since the one question route, and no
// parser either — a demand arrives as its words.
check('intake reads no category from a link', !/get\('category'\)|get\('step'\)/.test(DEEP_LINK_SRC));
check('nothing builds a step=2 link',
  !/set\('step'/.test(BAR_SRC) && !/params\.set\('category'|new URLSearchParams\(\{ category/.test(readFileSync(new URL('../../api/chat.ts', import.meta.url), 'utf8')));
check('the page does not parse deep links itself',
  !/searchParams\.get\(/.test(WIZARD_SRC));

console.log('\nA demand goes into intake, not into a chat overlay');
// The command bar sent everything that was not a catalogue hit to the AI chat
// overlay — so "I want to buy X", the single thing the box on the home screen
// exists for, landed in a conversation with no classification, no route and no
// way to submit. Only lookups and open questions belong to the assistant.
const noAnswer = { status: async () => null, policy: async () => null };
check('a buy intent goes into intake with its words',
  (await routeQuestion('I want to buy 50 monitors for the trading floor', ROUTE_DATA, noAnswer)).kind === 'demand'
  && /case 'demand': go\(`\/requests\/new\?q=\$\{encodeURIComponent\(text\)\}`\)/.test(BAR_SRC));
check('only what is not a demand reaches the assistant',
  (await routeQuestion('tell me a joke', ROUTE_DATA, noAnswer)).kind === 'assistant'
  && /case 'assistant': openAIChatWithPrompt\(text\)/.test(BAR_SRC));

console.log('\nNaming something procurable is a demand, verb or no verb');
// It keyed "is this a demand" on a hardcoded buy-verb list, so the most natural
// ways of asking — "business consulting", "IT strategy consulting with
// Accenture for 6 months", "cleaning services for the Berlin office" — were not
// demands and went to the chat assistant, which cannot route or submit.
check('a demand is recognised by what it names, not only by its verb',
  isDemand('cleaning services for the Berlin office', DEFAULT_CATEGORY_TAXONOMY));
check('an explicit lookup is still a lookup',
  !isDemand('find our cleaning services contract', DEFAULT_CATEGORY_TAXONOMY));
check('the classifier can report that no rule matched',
  /export function matchesDemandCategory/.test(
    readFileSync(new URL('../../src/lib/procurement/classify.ts', import.meta.url), 'utf8')));

console.log('\nA catalogue hit is named, and never navigated to');
// Naming the match and handing over a link is the whole correction budget: a
// wrong match costs a glance rather than a checkout for the wrong thing.
check('the identified item links to its governed checkout, never navigated to',
  /case 'catalogue': setIdentified\(/.test(BAR_SRC) && /\/catalogue\/items\/\$\{encodeURIComponent\(item\.id\)\}/.test(BAR_SRC));
check('the correction is always offered alongside the match',
  /Not what you need\? Describe it in full/.test(BAR_SRC));
check('rejecting the match carries the original wording into intake',
  /\/requests\/new\?q=\$\{encodeURIComponent\(identified\.query\)\}/.test(BAR_SRC));

console.log('\nThe naive matcher is gone for good');
check('no search helper is left in the catalogue data file',
  !/export function searchCatalogueItems/.test(ITEMS_SRC));
check('and its stop-word list went with it', !/STOP_WORDS/.test(ITEMS_SRC));
check('the file says where catalogue matching lives instead',
  /intake-routing/.test(ITEMS_SRC));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All assistant-intents checks passed.');
