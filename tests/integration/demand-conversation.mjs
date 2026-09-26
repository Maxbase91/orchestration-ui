#!/usr/bin/env node
// Verifies the dynamic demand-conversation engine (INT-03 / INT-10).
//
// The first half is self-contained — it mirrors
// src/lib/procurement/demand-conversation.ts and must be kept in sync.
//
// The risk-slot section at the bottom deliberately does NOT mirror: it calls
// the real engine. A mirror of "does `false` count as an answer" would pass
// while the product got it wrong, and that question is the whole point of the
// change. Run: node --import tsx/esm tests/integration/demand-conversation.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// Thresholds mirror DEFAULT_POLICY_CONFIG.
const DEFAULT_CONFIG = { criticalServiceThreshold: 100_000, continuityThreshold: 250_000 };
const TIME_BASED = new Set(['services', 'consulting', 'contingent-labour']);
const OUTCOME = new Set(['services', 'consulting', 'software']);

const ALL_SLOTS = [
  { id: 'title', kind: 'request', field: 'title', required: true },
  { id: 'objective', kind: 'sow', field: 'objective', required: true },
  { id: 'scope', kind: 'sow', field: 'scope', required: true },
  { id: 'deliverables', kind: 'sow', field: 'deliverables', required: true },
  { id: 'resources', kind: 'sow', field: 'resources', required: true },
  { id: 'timeline', kind: 'sow', field: 'timeline', required: false, why: 'Asked because work in this category is delivered over time…', appliesWhen: (c) => TIME_BASED.has(c.category) },
  { id: 'acceptanceCriteria', kind: 'sow', field: 'acceptanceCriteria', required: false, why: 'Asked because this category is bought on an outcome…', appliesWhen: (c) => OUTCOME.has(c.category) },
  { id: 'pricingModel', kind: 'sow', field: 'pricingModel', required: false, why: 'Asked because this demand is above the value where the commercial model is agreed up front…', appliesWhen: (c, cfg) => (c.estimatedValue ?? 0) >= cfg.criticalServiceThreshold },
  { id: 'dependencies', kind: 'sow', field: 'dependencies', required: false, why: 'Asked because at this value what the engagement relies on has to be visible…', appliesWhen: (c, cfg) => (c.estimatedValue ?? 0) >= cfg.continuityThreshold },
  { id: 'value', kind: 'request', field: 'estimatedValue', required: true },
  { id: 'deliveryDate', kind: 'request', field: 'deliveryDate', required: false },
];
const REQUIRED = ['title', 'value', 'objective', 'scope', 'deliverables', 'resources'];

function filled(slot, ctx) {
  if (slot.kind === 'request') {
    if (slot.field === 'estimatedValue') return (ctx.estimatedValue ?? 0) > 0;
    if (slot.field === 'title') return !!(ctx.title && ctx.title.trim());
    return !!(ctx.deliveryDate && ctx.deliveryDate.trim());
  }
  return !!(ctx.sow[slot.field] && ctx.sow[slot.field].trim());
}
function agenda(ctx, cfg = DEFAULT_CONFIG) {
  return ALL_SLOTS.filter((s) => !filled(s, ctx) && (!s.appliesWhen || s.appliesWhen(ctx, cfg)));
}
const nextId = (ctx, cfg) => { const a = agenda(ctx, cfg); return a.length ? a[0].id : null; };
const agendaIds = (ctx, cfg) => agenda(ctx, cfg).map((s) => s.id);
const isComplete = (ctx, cfg) => agenda(ctx, cfg).length === 0;
const requiredFilled = (ctx) => ALL_SLOTS.filter((s) => REQUIRED.includes(s.id)).every((s) => filled(s, ctx));

const ctxOf = (over = {}) => ({ category: 'goods', sow: {}, ...over });

console.log('Canonical order + carry-forward');
check('empty demand → first question is title', nextId(ctxOf()) === 'title');
check('title known → next is objective', nextId(ctxOf({ title: 'X' })) === 'objective');
check('description captured → next is value (budget asked last)', nextId(ctxOf({
  title: 'X', sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' },
})) === 'value');
check('description + value known → next is deliveryDate (the very last question)', nextId(ctxOf({
  title: 'X', estimatedValue: 5000, sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' },
})) === 'deliveryDate');
check('already-answered slot is never re-asked', !agendaIds(ctxOf({ title: 'X' })).includes('title'));

console.log('Completeness (agenda empty)');
const goodsDone = ctxOf({ title: 'X', estimatedValue: 5000, deliveryDate: '2026-09-01', sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' } });
check('low-value goods complete after the essentials', isComplete(goodsDone));
check('missing a core SOW field → not complete', !isComplete(ctxOf({ title: 'X', estimatedValue: 5000, sow: { objective: 'o', scope: 's', deliverables: 'd' } })));

console.log('Category branching');
check('software asks acceptance criteria', agendaIds(ctxOf({ category: 'software' })).includes('acceptanceCriteria'));
check('software does NOT ask timeline', !agendaIds(ctxOf({ category: 'software' })).includes('timeline'));
check('contingent-labour asks timeline', agendaIds(ctxOf({ category: 'contingent-labour' })).includes('timeline'));
check('contingent-labour does NOT ask acceptance criteria', !agendaIds(ctxOf({ category: 'contingent-labour' })).includes('acceptanceCriteria'));
check('consulting asks both timeline and acceptance', (() => { const a = agendaIds(ctxOf({ category: 'consulting' })); return a.includes('timeline') && a.includes('acceptanceCriteria'); })());
check('goods asks neither timeline nor acceptance', (() => { const a = agendaIds(ctxOf({ category: 'goods' })); return !a.includes('timeline') && !a.includes('acceptanceCriteria'); })());

console.log('Value-triggered branching (vs real thresholds)');
check('value ≥ criticalServiceThreshold asks pricing model', agendaIds(ctxOf({ estimatedValue: 100_000 })).includes('pricingModel'));
check('value below criticalServiceThreshold does not', !agendaIds(ctxOf({ estimatedValue: 99_999 })).includes('pricingModel'));
check('value ≥ continuityThreshold asks dependencies', agendaIds(ctxOf({ estimatedValue: 250_000 })).includes('dependencies'));
check('value below continuityThreshold does not', !agendaIds(ctxOf({ estimatedValue: 249_999 })).includes('dependencies'));

console.log('Prior-answer adaptivity (compound)');
check('high-value consulting asks the extra slots', (() => {
  const a = agendaIds(ctxOf({ category: 'consulting', estimatedValue: 500_000 }));
  return a.includes('timeline') && a.includes('acceptanceCriteria') && a.includes('pricingModel') && a.includes('dependencies');
})());
check('conditional slots never block the required minimum', (() => {
  const c = ctxOf({ category: 'consulting', estimatedValue: 500_000, title: 'X', deliveryDate: '2026-09-01', sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' } });
  return requiredFilled(c) && !isComplete(c); // required done, but enrichment slots remain
})());

console.log('Never-ask invariant (location + beneficiary)');
check('no slot id is country/beneficiary', !ALL_SLOTS.some((s) => /country|benefic/i.test(s.id) || /country|benefic/i.test(s.field)));
check('setting requesterCountry/beneficiary does not change the agenda', (() => {
  const a = agendaIds(ctxOf());
  const b = agendaIds(ctxOf({ requesterCountry: 'Germany', beneficiaryName: 'Anna Müller' }));
  return JSON.stringify(a) === JSON.stringify(b);
})());

console.log('Config-awareness');
check('lowering criticalServiceThreshold pulls pricing model in for a mid-value demand', (() => {
  const ctx = ctxOf({ estimatedValue: 20_000 });
  const before = agendaIds(ctx).includes('pricingModel'); // default 100k → false
  const after = agendaIds(ctx, { criticalServiceThreshold: 10_000, continuityThreshold: 250_000 }).includes('pricingModel');
  return !before && after;
})());

// ── The question and its example are separate things ────────────────────────
//
// The reported defect: the chat read
//
//   "What's the primary objective of this engagement? run a promptathon to
//    upskill 40 staff on AI tooling"
//
// for a demand that was "I want to buy business consulting". The example was
// concatenated onto the question, so it read as the assistant answering itself
// with somebody else's project — and only ONE of the two slot sources wrapped
// it in "(e.g. …)", so the same conversation mixed both styles.
//
// Mirrors the shape `determineNextQuestion` returns.
const nextQuestion = (ctx, cfg = DEFAULT_CONFIG) => {
  const a = agenda(ctx, cfg);
  if (a.length === 0) return null;
  const slot = a[0];
  return { slot, prompt: slot.prompt, example: slot.example };
};

console.log('\nThe question and the example are returned separately');
// Mirror slot wording for the two the screenshot showed.
ALL_SLOTS.find((s) => s.id === 'value').prompt = "What's the estimated budget for this?";
ALL_SLOTS.find((s) => s.id === 'value').example = '€50,000 or 150k';
ALL_SLOTS.find((s) => s.id === 'objective').prompt = "What's the primary objective of this engagement?";
ALL_SLOTS.find((s) => s.id === 'objective').example = 'run a promptathon to upskill 40 staff on AI tooling';

// Title known, nothing else — the exact scenario from the screenshot. With
// budget now asked last (see the canonical-order block above), the next slot
// this lands on is "objective", which is the slot the screenshot actually
// showed.
const q = nextQuestion(ctxOf({ category: 'consulting', title: 'business consulting' }));
check('the prompt is the question alone', q.prompt === "What's the primary objective of this engagement?", q.prompt);
check('the example is not concatenated onto it', !q.prompt.includes(q.example));
check('the example carries no "(e.g. …)" wrapper of its own',
  !/^\(e\.g\./.test(q.example), q.example);
// The wrapper belonged to one code path only, which is how the two styles
// appeared side by side in a single conversation.
for (const slot of ALL_SLOTS.filter((s) => s.example)) {
  check(`"${slot.id}" example is plain text`, !/^\(e\.g\./.test(slot.example), slot.example);
  check(`"${slot.id}" prompt ends as a question`, slot.prompt === undefined || slot.prompt.trim().endsWith('?'));
}

console.log('A conditional question says why it is being asked');
// A question that appears for some demands and not others is the one that reads
// as arbitrary. The mandatory six are asked of everyone and need no rationale —
// a justification line on every question is one the requester learns to skip.
for (const slot of ALL_SLOTS.filter((s) => s.appliesWhen)) {
  check(`conditional slot "${slot.id}" carries a rationale`, !!slot.why && slot.why.length > 20);
}
for (const slot of ALL_SLOTS.filter((s) => REQUIRED.includes(s.id))) {
  check(`mandatory slot "${slot.id}" carries none`, slot.why === undefined);
}
// deliveryDate is optional but unconditional — asked of everyone, so no reason.
check('an unconditional optional slot carries none',
  ALL_SLOTS.find((s) => s.id === 'deliveryDate').why === undefined);

// ── The risk questions, against the REAL engine ────────────────────────────
console.log('\nThe risk questions are the tail of the same agenda');

const { buildAgenda, determineNextQuestion, requiredSlotsFilled, resolveSlots, conversationProgress } =
  await import('../../src/lib/procurement/demand-conversation.ts');
const { riskSlotsFor } = await import('../../src/lib/procurement/residual-question-slots.ts');

const RISK = riskSlotsFor([
  { id: 'privileged-access', field: 'privilegedAccess', question: 'Does this engagement grant privileged or system access?', reason: 'consulting engagements often involve system access' },
]);
const described = {
  category: 'consulting',
  title: 'Target operating model design',
  estimatedValue: 250_000,
  // Not required, but the agenda still asks for it — so a fixture that omits it
  // never reaches the risk tail.
  deliveryDate: '2027-01-15',
  sow: {
    objective: 'Design a target operating model', scope: 'Assessment, design, roadmap',
    deliverables: 'Report, model, roadmap', resources: 'Partner plus three consultants',
    timeline: 'Twelve weeks', acceptanceCriteria: 'Steering-group sign-off',
    pricingModel: 'Fixed price', dependencies: 'Finance availability', exclusions: 'Implementation',
  },
};
const withRisk = [...resolveSlots(), ...RISK];

check('a risk question is asked only after the description is captured',
  determineNextQuestion({ ...described, sow: {} }, undefined, withRisk)?.slot.target.kind !== 'risk');
check('once the description is captured, the risk question is what is left',
  determineNextQuestion(described, undefined, withRisk)?.slot.id === 'privileged-access');
check('a risk question renders as a choice, not a text box',
  determineNextQuestion(described, undefined, withRisk)?.slot.answerType === 'yes-no');
check('the question carries its rationale',
  /system access/.test(determineNextQuestion(described, undefined, withRisk)?.slot.why ?? ''));

// The load-bearing one. `false` is an ANSWER — "not asked" and "answered no"
// are different governance facts, and a truthiness test collapses them.
check('answering NO counts as answered',
  buildAgenda({ ...described, risk: { privilegedAccess: false } }, undefined, withRisk).length === 0);
check('answering YES counts as answered',
  buildAgenda({ ...described, risk: { privilegedAccess: true } }, undefined, withRisk).length === 0);
check('leaving it unanswered does NOT count',
  buildAgenda({ ...described, risk: {} }, undefined, withRisk).length === 1);
check('an absent risk object does not count either',
  buildAgenda(described, undefined, withRisk).length === 1);

// The floor used to be a fixed id list and could NOT see a per-demand risk
// question, so `requiredSlotsFilled` returned true with the question still
// unanswered and only the step gate's second condition caught it. `riskSlotsFor`
// marks these `required: true` precisely so an unanswered one blocks — "the
// determination reads these, so an unanswered one leaves the record saying a
// question was triggered and never put" — and the floor now honours that, along
// with a template's `requiredWhen`. Strictly more blocking than before, never
// less; the step gate still ANDs the two.
check('an unanswered risk question fails the floor, not just the agenda',
  !requiredSlotsFilled(described, withRisk)
  && buildAgenda(described, undefined, withRisk).length > 0);
check('answering it satisfies the floor',
  requiredSlotsFilled({ ...described, risk: { privilegedAccess: false } }, withRisk));
// The code-owned floor is still there underneath: a description-incomplete
// demand fails it whatever the template says.
check('the description floor is unchanged',
  !requiredSlotsFilled({ category: 'consulting', sow: {} }, withRisk));

check('progress counts the risk question in its denominator',
  conversationProgress(described, undefined, withRisk).total
    > conversationProgress(described, undefined, resolveSlots()).total);

// ── A section the signals make mandatory is asked, and required ────────────
// The conversation counted its own required questions and the Channel page the
// sections generation required, from two sources: a material demand read "4 of
// 4 required" on one screen and "1 of 1 required sections" on the other, and
// could be confirmed while the determination still found a section missing.
// The section's rule now travels on the slot that fills it (2026-09-26).
console.log('\nA section the signals make mandatory is asked, and required');

const { applicableSlots, requiredSlots, requiredSectionIds } =
  await import('../../src/lib/procurement/demand-conversation.ts');
const { DEFAULT_SECTIONS } = await import('../../src/lib/procurement/service-description-defaults.ts');

const sectioned = resolveSlots(undefined, DEFAULT_SECTIONS);
// Goods at €50k asks neither acceptance criteria (not an outcome category) nor
// dependencies (below the continuity value) on the slots' own conditions — but
// personal data makes the data sensitivity high and the demand material, and
// the default template requires both sections then.
const sensitive = {
  category: 'goods', title: 'Laptops for the payroll team', estimatedValue: 50_000, deliveryDate: '2027-01-15',
  sow: {
    objective: 'Equip the payroll team', scope: 'Laptops for staff handling employee data and personal data',
    deliverables: 'Forty laptops', resources: 'The vendor delivery team',
  },
};
const ids = (slots) => slots.map((s) => s.id);

check('each section rule rides on the slot that fills it',
  ['scope', 'deliverables', 'resources', 'acceptanceCriteria', 'dependencies']
    .every((id) => sectioned.find((s) => s.id === id)?.sectionRequiredWhen?.length)
  && !sectioned.find((s) => s.id === 'objective')?.sectionRequiredWhen);
check('without the sections, the slots\' own conditions leave both unasked',
  !ids(applicableSlots(sensitive, undefined, resolveSlots())).includes('acceptanceCriteria')
  && !ids(applicableSlots(sensitive, undefined, resolveSlots())).includes('dependencies'));
check('with them, both are asked',
  ids(applicableSlots(sensitive, undefined, sectioned)).includes('acceptanceCriteria')
  && ids(applicableSlots(sensitive, undefined, sectioned)).includes('dependencies'));
check('and both are required',
  ids(requiredSlots(sensitive, sectioned)).includes('acceptanceCriteria')
  && ids(requiredSlots(sensitive, sectioned)).includes('dependencies'));
check('the floor cannot be met while one is unanswered',
  !requiredSlotsFilled(sensitive, sectioned));
check('answering them meets it',
  requiredSlotsFilled({ ...sensitive, sow: { ...sensitive.sow, exclusions: 'Software', acceptanceCriteria: 'Imaged and asset-tagged', dependencies: 'Identity team enrolment' } }, sectioned));
const askedForCriteria = determineNextQuestion({ ...sensitive, sow: { ...sensitive.sow, exclusions: 'Software' } }, undefined, sectioned);
check('the question says the section rule is why it is asked',
  askedForCriteria?.slot.id === 'acceptanceCriteria'
  && /must cover acceptance criteria/.test(askedForCriteria?.why ?? '')
  && /materiality is important/.test(askedForCriteria?.why ?? ''),
  askedForCriteria?.why);

// Nothing sensitive ("payroll" alone reads as high), and below every value rule.
const plain = { ...sensitive, sow: { ...sensitive.sow, objective: 'Equip the marketing team', scope: 'Laptops for the marketing team', resources: 'Public website content editors' } };
check('a demand the rules do not reach is asked exactly as before',
  JSON.stringify(ids(applicableSlots(plain, undefined, sectioned)))
    === JSON.stringify(ids(applicableSlots(plain, undefined, resolveSlots()))));

// One set for every screen: the required questions' sections, plus any section
// the rules make mandatory that no question asks (generation writes those).
check('the required sections are the required questions\' sections, in template order',
  JSON.stringify(requiredSectionIds(sensitive, sectioned, DEFAULT_SECTIONS))
    === JSON.stringify(['objective', 'scope', 'deliverables', 'resources', 'acceptanceCriteria', 'dependencies']));
const withInferred = DEFAULT_SECTIONS.map((s) => (s.id === 'location'
  ? { ...s, requiredWhen: [{ field: 'dataSensitivity', operator: 'in', value: 'high,critical' }] }
  : s));
check('a mandatory section no question asks is still in the set',
  requiredSectionIds(sensitive, resolveSlots(undefined, withInferred), withInferred).includes('location')
  && !ids(requiredSlots(sensitive, resolveSlots(undefined, withInferred))).includes('location'));

// The three places that must read the one set, not a copy of it.
const { readFileSync } = await import('node:fs');
const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
check('the server conversation resolves its slots with the sections',
  /resolveSlots\(template\.slots,\s*template\.sections\)/.test(read('api/chat-intake.ts')));
check('the panel and the page count the set with requiredSectionIds',
  /requiredSectionIds\(/.test(read('src/features/requests/new-request/conversation/intake-conversation.tsx'))
  && /requiredSectionIds\(/.test(read('src/features/requests/new-request/new-request-page.tsx')));
check('the Channel page reads the set it is given, not generation\'s reply',
  /props\.requiredSections/.test(read('src/features/requests/new-request/channel/step-channel-request.tsx'))
  && !/sowRequiredSections/.test(read('src/features/requests/new-request/channel/step-channel-request.tsx')));

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All demand-conversation checks passed.');
