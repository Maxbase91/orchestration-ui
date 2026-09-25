#!/usr/bin/env node
// One question route for the Home box and the assistant.
//
// The Home box answered status and policy questions from the configuration,
// offered catalogue items and sent demands to intake — and the assistant had a
// router of its own, a regex scorer with supplier names typed in, so the same
// sentence got two different answers depending on where it was typed. Both now
// call lib/assistant/question-route.ts. This drives it directly: the order of
// the checks, what is and is not a demand, and what the assistant shows for
// each route. Also here: conversation titles, which all read "New conversation".
//
// Run: npm run test:question-route
import { readFileSync } from 'node:fs';
import { routeQuestion, isDemand, looksLikePolicyQuestion } from '../../src/lib/assistant/question-route.ts';
import { routeTurns, policyAnswerText } from '../../src/lib/assistant/route-turns.ts';
import { statusAnswerText } from '../../src/lib/assistant/status-answer.ts';
import { conversationTitle, NEW_CONVERSATION_TITLE } from '../../src/lib/assistant/conversation-title.ts';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const PAPER = { id: 'OS-001', name: 'A4 Printer Paper (5 reams)', description: 'Copier paper 80gsm', unitPrice: 24, unit: 'box', catalogueId: 'office-supplies', catalogueName: 'Office Supplies', supplierName: 'OfficeCo', supplierId: 'SUP-O', leadTime: '2 days', available: true, category: 'goods' };
const DATA = { catalogueItems: [PAPER], catalogueEligibleCategories: ['goods', 'catalogue'], categories: DEFAULT_CATEGORY_TAXONOMY };
const STATUS = { kind: 'record', object: 'request', item: { title: 'REQ-2026-00042 · Office move', facts: [{ key: 'status', label: 'Status', value: 'Validation' }], link: '/requests/REQ-2026-00042' } };
const POLICY = { direct: { answer: 'Yes. At €40,000 you need at least 3 competitive quotes.', source: 'Decisioning thresholds' }, entry: null, topics: [] };

/** Deps that answer, and record what they were asked. */
function deps({ status = STATUS, policy = POLICY } = {}) {
  const asked = [];
  return {
    asked,
    status: async (q) => { asked.push(['status', q]); return status; },
    policy: async (q) => { asked.push(['policy', q]); return policy; },
  };
}

console.log('The order: status, catalogue, policy, demand, then the model');
{
  const d = deps();
  check('a status question is answered as status', (await routeQuestion('where is REQ-2026-00042?', DATA, d)).kind === 'status');
  const off = deps({ status: null });
  check('a status question the agent cannot answer falls through, not to a dead end',
    (await routeQuestion('where is REQ-2026-00042?', DATA, off)).kind !== 'status');
  const cat = deps();
  const paper = await routeQuestion('printer paper?', DATA, cat);
  check('a catalogue item comes before a question-shaped policy check',
    paper.kind === 'catalogue' && paper.items[0].id === 'OS-001' && !cat.asked.some(([k]) => k === 'policy'));
  check('a policy question is answered before "need" reads it as a demand',
    (await routeQuestion('do I need three quotes for a €40,000 order?', DATA, deps())).kind === 'policy');
  check('a demand goes to intake', (await routeQuestion('I want to buy 50 monitors', DATA, deps({ policy: null }))).kind === 'demand');
  check('the rest goes to the model', (await routeQuestion('tell me a joke', DATA, deps({ policy: null }))).kind === 'assistant');
}

console.log('\nWhat is, and is not, a demand');
const cats = DEFAULT_CATEGORY_TAXONOMY;
check('naming something procurable is a demand', isDemand('cleaning services for the Berlin office', cats));
check('an explicit lookup is not', !isDemand('find our cleaning services contract', cats));
check('asking for a person is not', !isDemand('I need to speak to someone', cats));
check('asking for help is not', !isDemand('I need help with my approval', cats));
check('tracking an order is not', !isDemand('track my order', cats));
check('in a conversation, naming a category is not enough — "and for consulting?" asks',
  !isDemand('and for consulting?', cats, { followUp: true }) && isDemand('and for consulting?', cats));
check('in a conversation, saying you want something still is',
  isDemand('I also need two laptops for the new starters', cats, { followUp: true }));
check('"can I buy a laptop?" is a demand phrased as a question, not a policy query',
  !looksLikePolicyQuestion('can I buy a laptop?') && looksLikePolicyQuestion('what is the approval threshold?'));

console.log('\nThe assistant shows what the Home box shows');
{
  const status = routeTurns({ kind: 'status', status: STATUS }, 'where is REQ-2026-00042?');
  check('a status answer is the status card, not the model\'s paraphrase', status.length === 1 && status[0].type === 'status-answer');
  const policy = routeTurns({ kind: 'policy', policy: POLICY }, 'do I need quotes?');
  check('a policy answer is the policy card', policy[0].type === 'policy-answer' && policy[0].answer === POLICY);
  const demand = routeTurns({ kind: 'demand' }, 'I want to buy 50 monitors');
  check('a demand opens intake with the words',
    demand.some((t) => t.type === 'deep-link' && t.path === `/requests/new?q=${encodeURIComponent('I want to buy 50 monitors')}`));
  check('and says nothing exists until the requester submits',
    demand.some((t) => t.type === 'chat-answer' && /Nothing is created or sent until you submit it/.test(t.content)));
  const catalogue = routeTurns({ kind: 'catalogue', items: [PAPER] }, 'printer paper');
  check('a catalogue item goes into the basket on the Catalogue page', catalogue.some((t) => t.path === '/catalogue?add=OS-001'));
  check('with the correction, carrying the words', catalogue.some((t) => t.path === '/requests/new?q=printer%20paper'));
  check('a status card reads as text for the model\'s history',
    statusAnswerText(STATUS) === 'REQ-2026-00042 · Office move — Status: Validation');
  check('so does a policy answer', policyAnswerText(POLICY) === POLICY.direct.answer);
}

console.log('\nThe assistant takes the route before the model');
{
  const hook = read('src/lib/assistant/use-assistant.ts');
  const routed = hook.indexOf('await route(trimmed');
  check('every message is routed first, the model only for the rest',
    routed > 0 && routed < hook.indexOf('fetchSSE(history') && /if \(routed\.kind !== 'assistant'\)/.test(hook));
  check('a follow-up is routed as one', /followUp: !firstMessage/.test(hook));
  check('the mock router carries no supplier names', !/accenture|deloitte/i.test(read('src/lib/assistant/intents.ts')));
  const chat = read('api/chat.ts');
  check('the server assistant offers the same demand link — no category list of its own',
    /startDemand\(demandText\)/.test(chat) && !/enum: \['goods'/.test(chat));
}

console.log('\nA conversation is named by the question that started it');
check('a short question is the title', conversationTitle('Where is REQ-2026-00042?') === 'Where is REQ-2026-00042?');
{
  const long = conversationTitle('We need an agency to run the launch event for the new product line in Berlin and Paris next spring');
  check('a long one is cut at a word, with an ellipsis', long.endsWith('…') && long.length <= 61 && !/\s…$/.test(long), long);
}
check('only the first line counts', conversationTitle('Laptops for new starters\nFive of them, by Monday') === 'Laptops for new starters');
check('an empty message leaves the default', conversationTitle('   ') === NEW_CONVERSATION_TITLE);
check('the title is set when the first message creates the conversation',
  /if \(firstMessage && \(!conversation \|\| conversation\.title === NEW_CONVERSATION_TITLE\)\)/.test(read('src/lib/assistant/use-assistant.ts')));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All question-route checks passed.');
