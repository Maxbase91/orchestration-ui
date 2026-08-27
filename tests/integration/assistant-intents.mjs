#!/usr/bin/env node
// Verifies the assistant intent classifier routes a procurement demand to the
// intake flow — not a support ticket. Regression for "I need consultants for a
// promptathon" landing on a TKT-#### handover.
//
// Self-contained — mirrors src/lib/assistant/intents.ts classifyIntent (and the
// create_ticket / start_demand rules in api/chat.ts). Keep in sync.
// Run: node tests/integration/assistant-intents.mjs

import { readFileSync } from 'node:fs';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── Mirror of classifyIntent (keep in sync with src/lib/assistant/intents.ts) ──
function classifyIntent(input) {
  const t = input.toLowerCase();
  const scores = { knowledge: 0, lookup: 0, action: 0, handover: 0, intake: 0, unknown: 0 };

  if (/\b(policy|policies|threshold|limit|rules?|guideline|procedure|explain|allowed|permitted|require|mandatory|kop|faq|standard)\b/.test(t)) scores.knowledge += 2;
  if (/\b(when (can|should|do i)|how (much|many|do i|does|should|to)|what (is|are) the (policy|rule|limit|threshold|process|procedure|requirement|guideline|standard|penalty|deadline|definition))\b/.test(t)) scores.knowledge += 2;
  if (/\b(consulting|approval|payment terms|sra|esg|framework|catalogue|onboard|renew|delegate|ooo|out.of.office|ir35|dpa|gdpr|capex|opex|tprm)\b/.test(t) && /\b(what|how|when|why|explain|policy|rule|process)\b/.test(t)) scores.knowledge += 1;
  if (/\bhow (to|do i|can i|should i)\b/.test(t)) scores.knowledge += 2;

  if (/\b(req-|sup-|con-|po-|inv-|ra-|tkt-)\w+/.test(t)) scores.lookup += 3;
  if (/\b(risk rating|risk status|performance score|utilisation|match status|payment status|sra status)\b/.test(t)) scores.lookup += 1;
  if (/\b(show me|find|look up|search for|tell me about|what('s| is) (the )?(risk|score|rating)|details (of|for)|profile of)\b/.test(t)) scores.lookup += 1;
  if (/\b(acme|accenture|sap|deloitte|infosys|capgemini|atos|randstad|hays)\b/.test(t) && !/\b(policy|panel|threshold)\b/.test(t)) scores.lookup += 1;

  if (/\b(add (me|myself) (as )?(a )?watcher|set (my |the )?(approval )?delegate|set (me as |my )?ooo|request (a )?risk reassessment|request (contract )?renewal|request (a )?po change|raise (a )?payment.*(escalation|escalate)|reassign|approver substitut)\b/.test(t)) scores.action += 4;
  if (/\b(set (my|a|the)|delegate (my |approvals? )?(to)?|out.of.office|escalat(e|ion)|substitut)\b/.test(t)) scores.action += 2;
  if (/\b(approve on my behalf|cover for me|change (the )?(approver|owner)|update (the )?(po|contract)|raise (a |an )?(escalation|payment))\b/.test(t)) scores.action += 2;

  if (/\b(i (want|need|would like) to (buy|purchase|procure|order|get)|buy|purchase|procure|raise a demand|new (request|demand)|want to (buy|order)|can you (buy|order|raise|get))\b/.test(t) && !/\b(speak|talk|contact|person|human|someone)\b/.test(t)) scores.intake += 2;
  if (/\bi need (a|some) /.test(t) && !/\b(speak|talk|contact|person|human|someone)\b/.test(t)) scores.intake += 2;
  if (
    /\b(need|want|require|hire|engage|procure|looking (for|to))\b/.test(t) &&
    /\b(consultant|consultancy|contractor|developer|engineer|designer|staff|headcount|agency|supplier|vendor|resource|freelancer|specialist|advisor|laptop|hardware|software|licen[sc]e|service|equipment|subscription|hosting|tooling)s?\b/.test(t) &&
    !/\b(speak|talk|contact|person|human|someone|policy|polic|rule|threshold|guideline|status|how (much|many|to|do))\b/.test(t)
  ) scores.intake += 2;
  if (/\b(create (a )?request|submit (a )?request|raise (a )?(pr|purchase request|procurement request))\b/.test(t)) scores.intake += 3;
  if (/\b(purchase request|procurement request)\b/.test(t)) scores.intake += 2;

  if (/\b(speak (to|with)|talk (to|with))\b/.test(t)) scores.handover += 3;
  if (/\b(contact|person|human|agent|someone|not working|issue|problem|complain|escalate to|can't find|don't understand)\b/.test(t)) scores.handover += 1;

  const sorted = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  const [first, second] = sorted;
  if (scores[first] === 0) return 'unknown';
  if (scores[first] === 1 && scores[second] >= 1) return 'unknown';
  return first;
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

console.log('One classifier, not two');
// The assistant used to carry a private `guessCategory` keyword table whose
// `consulting` and `services` entries both claimed "advisory" and which
// defaulted everything unmatched to `services` — so the assistant and the
// wizard could hand back different categories for the same sentence. Both now
// call classifyDemandCategory. This asserts the duplicate is gone and stays gone.
const intakeSrc = readFileSync(new URL('../../src/lib/assistant/capabilities/intake.ts', import.meta.url), 'utf8');
check('the assistant has no private category keyword table',
  !intakeSrc.includes('categoryKeywords') && !intakeSrc.includes('guessCategory'));
check('the assistant classifies through the shared classifier',
  intakeSrc.includes('classifyDemandCategory'));

// Mirrors src/lib/procurement/classify.ts — kept in step with classification-eval.mjs.
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
// The reported case: the old table returned `consulting` here too, but only by
// luck — "advisory" alone tipped either way depending on key order.
check('"I want to buy business consulting" classifies as consulting',
  classifyDemandCategory('I want to buy business consulting') === 'consulting');
check('an advisory demand no longer depends on key order',
  classifyDemandCategory('advisory support for the finance team') === 'consulting');
check('an unmatched demand is goods, not a silent "services" default',
  classifyDemandCategory('twelve reams of A5 card stock') === 'goods');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All assistant-intents checks passed.');
