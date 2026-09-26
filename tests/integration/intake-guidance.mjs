#!/usr/bin/env node
// Intake guidance: a progress count that can reach 100%, a conversation that
// will not confirm a channel without the essentials, and a page that explains
// itself.
//
// The three failures this exists to prevent:
//
//   1. The progress bar divided by a FIXED 14 — five key facts plus nine
//      hardcoded sections — while the conversation asks between six and ten
//      slots depending on category and value. A requester who had answered
//      every question was told they were 57% done (goods, €8k) and shown five
//      items that were never going to be asked.
//   2. `location` sat in the panel's outstanding list while the template marks
//      it `asked: false` — it is inferred, never captured, so it could only
//      ever read "Pending".
//   3. The Details step's Next needed only `title` and `estimatedValue > 0`.
//      `requiredSlotsFilled` — the mandatory-SOW guarantee the engine defines
//      to stop an LLM short-circuiting the conversation — was computed in the
//      chat component and never consulted at the gate. The wizard is gone
//      (2026-09-26); the gate is the conversation page's "Buying channel
//      confirmed", and it is held to the same floor.
//
// Self-contained — mirrors src/lib/procurement/demand-conversation.ts and
// src/lib/procurement/service-description-defaults.ts. Keep in sync.
// Run: npm run test:intake-guidance

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── mirrors demand-conversation.ts ──────────────────────────────────────────

const CONFIG = { criticalServiceThreshold: 100_000, continuityThreshold: 250_000 };
const TIME_BASED = new Set(['services', 'consulting', 'contingent-labour']);
const OUTCOME = new Set(['services', 'consulting', 'software']);

const ALL_SLOTS = [
  { id: 'title', kind: 'request', field: 'title' },
  { id: 'value', kind: 'request', field: 'estimatedValue' },
  { id: 'deliveryDate', kind: 'request', field: 'deliveryDate' },
  { id: 'objective', kind: 'sow', field: 'objective' },
  { id: 'scope', kind: 'sow', field: 'scope' },
  { id: 'deliverables', kind: 'sow', field: 'deliverables' },
  { id: 'resources', kind: 'sow', field: 'resources' },
  { id: 'timeline', kind: 'sow', field: 'timeline', appliesWhen: (c) => TIME_BASED.has(c.category) },
  { id: 'acceptanceCriteria', kind: 'sow', field: 'acceptanceCriteria', appliesWhen: (c) => OUTCOME.has(c.category) },
  { id: 'pricingModel', kind: 'sow', field: 'pricingModel', appliesWhen: (c, cfg) => (c.estimatedValue ?? 0) >= cfg.criticalServiceThreshold },
  { id: 'dependencies', kind: 'sow', field: 'dependencies', appliesWhen: (c, cfg) => (c.estimatedValue ?? 0) >= cfg.continuityThreshold },
];
const REQUIRED = ['title', 'value', 'objective', 'scope', 'deliverables', 'resources'];

function filled(slot, ctx) {
  if (slot.kind === 'request') {
    if (slot.field === 'estimatedValue') return (ctx.estimatedValue ?? 0) > 0;
    if (slot.field === 'title') return !!ctx.title?.trim();
    return !!ctx.deliveryDate?.trim();
  }
  return !!ctx.sow[slot.field]?.trim();
}
const applicable = (ctx, cfg = CONFIG) =>
  ALL_SLOTS.filter((s) => !s.appliesWhen || s.appliesWhen(ctx, cfg));
const agenda = (ctx, cfg = CONFIG) => applicable(ctx, cfg).filter((s) => !filled(s, ctx));

function progress(ctx, cfg = CONFIG) {
  const total = applicable(ctx, cfg).length;
  const captured = total - agenda(ctx, cfg).length;
  return { total, captured, pct: total === 0 ? 100 : Math.round((captured / total) * 100) };
}

const outstandingRequired = (ctx) =>
  ALL_SLOTS.filter((s) => REQUIRED.includes(s.id)).filter((s) => !filled(s, ctx));
const requiredFilled = (ctx) => outstandingRequired(ctx).length === 0;

const ctxOf = (over = {}) => ({ category: 'goods', sow: {}, ...over });
/** Answer every slot the demand is asked. */
function answerAll(ctx) {
  const done = { ...ctx, sow: { ...ctx.sow } };
  for (const slot of applicable(done)) {
    if (slot.kind === 'request') {
      if (slot.field === 'estimatedValue') done.estimatedValue = done.estimatedValue || 1;
      else if (slot.field === 'title') done.title = 'answered';
      else done.deliveryDate = '2026-09-01';
    } else {
      done.sow[slot.field] = 'answered';
    }
  }
  return done;
}

// ── mirrors DEFAULT_SECTIONS ────────────────────────────────────────────────

const SECTIONS = [
  { id: 'objective', asked: true },
  { id: 'scope', asked: true },
  { id: 'deliverables', asked: true },
  { id: 'timeline', asked: true },
  { id: 'resources', asked: true },
  { id: 'acceptanceCriteria', asked: true },
  { id: 'pricingModel', asked: true },
  { id: 'location', asked: false },
  { id: 'dependencies', asked: true },
];

// ── the page's copy is READ, not mirrored ───────────────────────────────────
//
// Everything above is a mirror because it is logic. Copy is not, and a mirrored
// copy of copy asserts nothing — it would pass while the real page said
// something else. So this reads the real source; the completeness predicate is
// imported and called.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { conversationComplete } from '../../src/features/requests/new-request/conversation/conversation-rules.ts';
import { resolveSlots } from '../../src/lib/procurement/demand-conversation.ts';
import { DEFAULT_SLOTS } from '../../src/lib/procurement/service-description-defaults.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const WIZARD_SRC = read('src/features/requests/new-request/new-request-page.tsx');
const PAGE_SRC = read('src/features/requests/new-request/conversation/intake-conversation.tsx');
const TURNS_SRC = read('src/features/requests/new-request/conversation/turns.tsx');
const PANEL_SRC = read('src/features/requests/new-request/conversation/your-request-panel.tsx');
const ROWS_SRC = read('src/features/requests/new-request/conversation/request-rows.ts');

// ── the bar reaches 100% ────────────────────────────────────────────────────

console.log('The progress bar can reach 100% for every demand');
// The four demands measured against the OLD fixed-14 denominator, which topped
// out at 57 / 64 / 71 / 86% respectively.
const DEMANDS = [
  ['goods, EUR 8k', ctxOf({ category: 'goods', estimatedValue: 8_000 })],
  ['software, EUR 30k', ctxOf({ category: 'software', estimatedValue: 30_000 })],
  ['services, EUR 60k', ctxOf({ category: 'services', estimatedValue: 60_000 })],
  ['consulting, EUR 400k', ctxOf({ category: 'consulting', estimatedValue: 400_000 })],
];
for (const [label, ctx] of DEMANDS) {
  const done = answerAll(ctx);
  const p = progress(done);
  check(`${label} reads 100% once answered`, p.pct === 100, `${p.captured}/${p.total} = ${p.pct}%`);
  check(`${label} counts only what it asks`, p.total === applicable(ctx).length, `${p.total}`);
}

console.log('\nThe denominator is the agenda, not a fixed number');
const OLD_FIXED_TOTAL = 14;
for (const [label, ctx] of DEMANDS) {
  check(`${label} asks fewer than the old fixed ${OLD_FIXED_TOTAL}`,
    applicable(ctx).length < OLD_FIXED_TOTAL, `${applicable(ctx).length}`);
}
// The denominator MOVES with the demand — that is the point, and it is why it
// is recomputed rather than frozen when the conversation starts.
check('a high-value consulting demand is asked more than low-value goods',
  applicable(ctxOf({ category: 'consulting', estimatedValue: 400_000 })).length >
  applicable(ctxOf({ category: 'goods', estimatedValue: 8_000 })).length);
check('an empty demand is never 100%', progress(ctxOf()).pct < 100);
check('progress rises monotonically as slots are answered', (() => {
  let last = -1;
  let ctx = ctxOf({ category: 'services', estimatedValue: 60_000 });
  for (const slot of [...applicable(ctx)]) {
    const p = progress(ctx).pct;
    if (p < last) return false;
    last = p;
    if (slot.kind === 'sow') ctx = { ...ctx, sow: { ...ctx.sow, [slot.field]: 'a' } };
    else if (slot.field === 'title') ctx = { ...ctx, title: 'a' };
    else if (slot.field === 'deliveryDate') ctx = { ...ctx, deliveryDate: '2026-09-01' };
  }
  return true;
})());

console.log('\nAn inferred section is never counted as outstanding');
const inferred = SECTIONS.filter((s) => !s.asked).map((s) => s.id);
check('the template marks at least one section inferred', inferred.length > 0, inferred.join(','));
for (const id of inferred) {
  // The bar's biggest lie: `location` is generated, no slot has ever asked for
  // it, and it sat in the outstanding list where it could only read "Pending".
  check(`"${id}" is not a slot the conversation asks`, !ALL_SLOTS.some((s) => s.field === id));
  check(`"${id}" is not in any demand's agenda`,
    DEMANDS.every(([, ctx]) => !agenda(ctx).some((s) => s.field === id)));
}
check('every ASKED section that is a slot appears in some agenda',
  SECTIONS.filter((s) => s.asked).every((sec) =>
    !ALL_SLOTS.some((s) => s.field === sec.id) ||
    DEMANDS.some(([, ctx]) => agenda(ctx).some((s) => s.field === sec.id))));

console.log('\nThe conversation is not through without the essentials');
// The old gate. Two fields and out.
const twoFields = ctxOf({ title: 'Business consulting', estimatedValue: 50_000 });
const oldGate = (ctx) => !!ctx.title && (ctx.estimatedValue ?? 0) > 0;
check('the old gate passed a demand with no service description at all', oldGate(twoFields));
check('the mandatory floor does not', requiredFilled(twoFields) === false);
check('and it names what is outstanding',
  outstandingRequired(twoFields).map((s) => s.id).join(',') === 'objective,scope,deliverables,resources',
  outstandingRequired(twoFields).map((s) => s.id).join(','));
const floorMet = ctxOf({
  title: 'X', estimatedValue: 50_000,
  sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' },
});
check('the floor passes once the six mandatory slots are filled', requiredFilled(floorMet));
// The floor is the MANDATORY minimum, not the whole agenda: conditional
// enrichment must never block the gate.
check('conditional slots do not hold the gate', (() => {
  const ctx = ctxOf({
    category: 'consulting', estimatedValue: 400_000, title: 'X',
    sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' },
  });
  return requiredFilled(ctx) && agenda(ctx).length > 0;
})());
check('the gate is exactly "no outstanding required slots"',
  DEMANDS.every(([, ctx]) => requiredFilled(ctx) === (outstandingRequired(ctx).length === 0)));

console.log('\nThe page explains itself');
// The stepper's labels and a guidance panel per step said where the requester
// was and what each screen was for. The conversation says it in the header —
// three phases, the current one marked — and in the transcript, where each
// phase begins.
check('the header names the three phases', /'1 · What you need', '2 · How it is bought', '3 · What it needs'/.test(PAGE_SRC)
  && /aria-current=\{index === stage \? 'step' : undefined\}/.test(PAGE_SRC));
check('the transcript marks where each phase begins', (PAGE_SRC.match(/<PhaseLabel>/g) ?? []).length >= 4);
check('the assistant says what it is doing now', /Procurement assistant/.test(PAGE_SRC) && /\{phaseText\}/.test(PAGE_SRC));
check('the stepper and its guidance panels are gone',
  !existsSync(join(ROOT, 'src/features/requests/new-request/intake-steps.ts'))
  && !existsSync(join(ROOT, 'src/features/requests/new-request/components/step-header-panel.tsx'))
  && !/StepHeaderPanel|stepDescription|progressStepsForRoute|canProceed/.test(WIZARD_SRC));

console.log('\nOne way on to the Channel page, and one way to submit');
// "Buying channel confirmed" is the gate the Details step was: the Channel page
// is reached only from it, and both routes submit from the Channel page.
check('the Channel page is reached from "Buying channel confirmed" alone',
  /onSeeChannel=\{\(\) => setView\('channel'\)\}/.test(WIZARD_SRC)
  && (PAGE_SRC.match(/props\.onSeeChannel/g) ?? []).length === 1
  && /\{confirmed && \(/.test(PAGE_SRC));
check('a new request and a call-off both submit from the Channel page',
  /onSubmit=\{\(\) => void submitRequest\(\)\}/.test(WIZARD_SRC) && /onSubmit=\{\(\) => void submitCallOff\(\)\}/.test(WIZARD_SRC));
check('every submission ends on the confirmation', (WIZARD_SRC.match(/setView\('confirmation'\)/g) ?? []).length === 2);

console.log('\nThe copy is white-label');
// Ground rule 1: no organisation or sector naming anywhere in requester copy.
const BANNED = /\b(bank|banking|insurer|insurance|financial services|fintech|hospital|retailer)\b/i;
const COPY_SRC = PAGE_SRC + TURNS_SRC + PANEL_SRC + ROWS_SRC;
check('no organisation or sector naming in the conversation\u2019s copy', !BANNED.test(COPY_SRC),
  (COPY_SRC.match(BANNED) ?? [])[0]);
// The gate that stops an LLM short-circuiting the conversation, asserted by
// CALLING the predicate the page confirms with (conversation-rules.ts). An empty
// context must not pass; a captured one must. test:intake-conversation covers
// the risk-question half and the submission gaps.
{
  const emptyCtx = { category: 'consulting', sow: {} };
  const fullCtx = {
    category: 'consulting', title: 'A demand', estimatedValue: 250_000, deliveryDate: '2027-01-15',
    sow: {
      objective: 'o', scope: 's', exclusions: 'e', deliverables: 'd', resources: 'r',
      timeline: 't', acceptanceCriteria: 'a', pricingModel: 'p', dependencies: 'x',
    },
  };
  check('the conversation is held to its mandatory floor', !conversationComplete(emptyCtx, resolveSlots()));
  check('a captured conversation is through', conversationComplete(fullCtx, resolveSlots()));
}

console.log('\nThe chat is not canned');
//
// Source checks, not mirrors — a mirror of the intended shape would have passed
// the whole time the real code was concatenating the example onto the question
// and discarding the model's phrasing.
const CONV_SRC = readFileSync(
  join(ROOT, 'src/lib/procurement/demand-conversation.ts'), 'utf8');
// The conversation's engine (the hook), and the page and turns that draw it.
const HOOK_SRC = read('src/features/requests/new-request/conversation/use-service-description-conversation.ts');
const CHAT_SRC = HOOK_SRC + PAGE_SRC + TURNS_SRC;
const INTAKE_API_SRC = readFileSync(join(ROOT, 'api/chat-intake.ts'), 'utf8');

// The concatenation that produced "…engagement? run a promptathon to upskill 40
// staff on AI tooling" for a business-consulting demand.
check('the question is no longer built by appending the example',
  !/\$\{slot\.prompt\} \$\{example\}/.test(CONV_SRC));
check('the example is returned as its own field',
  /example: slot\.example\?\.\(ctx\)/.test(CONV_SRC));
// The wrapper lived in one path only, so configured slots rendered bare and
// built-in ones wrapped — two styles in one conversation.
check('no "(e.g. …)" wrapper is baked into the data', !/\(e\.g\. \$\{/.test(CONV_SRC));
check('the chat renders the example as its own element',
  /example=\{message\.example\}/.test(PAGE_SRC) && /\{example && /.test(TURNS_SRC));
// The endpoint generated a contextual phrasing that the client threw away.
check("the assistant's phrasing is used, not discarded",
  /usableQuestion\(result\.nextQuestion\)/.test(CHAT_SRC));
check('and it is guarded rather than trusted blindly',
  /function usableQuestion/.test(CHAT_SRC) && /includes\('\?'\)/.test(CHAT_SRC));

console.log('\nThe conversation opens by asking, not by interrogating');
//
// It opened on slot #1 whenever the describe step had captured a title or a
// value — which it always had — so the requester's first experience was being
// asked for an acceptance criterion before they had been allowed to say what
// they wanted. The page now opens with one open question, and the service
// description starts from what that answer did not cover.
check('the page opens with an invitation in the requester\u2019s own words',
  /What do you need\? Say it in your own words/.test(PAGE_SRC));
check('and promises to ask only for what is missing', /ask only what is still missing/.test(PAGE_SRC));
check('the service description then asks the engine\u2019s next question, not a second invitation',
  /const next = determineNextQuestion\(progressCtx, undefined, slots\)/.test(HOOK_SRC)
  && !/OPENING_INVITATION|buildWelcomeMessage/.test(HOOK_SRC));
// The endpoint's opening turn phrased an invitation for an empty conversation;
// no client sends one any more, so there is none to reach.
check('the endpoint has no unreachable opening turn', !/isOpening/.test(INTAKE_API_SRC));

console.log('\nEvery question says what the answer is used for');
// A question with no stated purpose reads as bureaucracy. Each `why` names a
// downstream consumer — the route, the risk assessment, the sourcing pack —
// because that is the honest answer to "why does it matter what I write here".
{
  // Resolved from the DEFAULT TEMPLATE, which is the path the app takes —
  // `useServiceDescriptionTemplate` falls back to the serialised built-in, and
  // `resolveSlots(configured)` rebuilds each slot from it. Asserting against
  // `resolveSlots()` (the in-code `ALL_SLOTS`) checked the copy the running app
  // never reads: eight reasons existed in `demand-conversation.ts` and none of
  // them reached a screen, because the serialised template had not been
  // updated alongside.
  const asked = resolveSlots(DEFAULT_SLOTS).filter((slot) => slot.asked !== false);
  const missing = asked.filter((slot) => !slot.why || slot.why.trim().length < 30);
  check('every asked slot carries a reason, as the app resolves them', missing.length === 0,
    missing.map((slot) => slot.id).join(', '));
  // The two copies must agree, or one of them is decoration.
  const inCode = new Map(resolveSlots().map((slot) => [slot.id, slot.why ?? '']));
  const disagreeing = asked.filter((slot) => (inCode.get(slot.id) ?? '') !== (slot.why ?? ''));
  check('the serialised template and the in-code slots agree on every reason',
    disagreeing.length === 0, disagreeing.map((slot) => slot.id).join(', '));
  check('the chat renders the reason with the question', /why=\{message\.why\}/.test(PAGE_SRC) && /Asked because/.test(TURNS_SRC));
  // `next.why` is the engine's reason for THIS question — the slot's own, or the
  // section rule's when that is what made it mandatory (determineNextQuestion).
  check('the reason travels with the question it explains', /why: next\.why/.test(CHAT_SRC) && !/why: next\.slot\.why/.test(CHAT_SRC));
}

console.log('\nA question with a parser behind it cannot loop forever');
// The need-by date is parsed, so an unreadable answer is rejected before it is
// written — and the same question came straight back, forever. A requester who
// did not yet know the date could never reach the sections that matter. Same
// rule the rest of the conversation follows: push back once, then move on.
//
// The budget slot hit the identical failure ("not known" has no extractable
// number), so the rule was generalised from `noteDateAttempt` to
// `noteUnresolvedAttempt(field, invalid)`. These assertions follow it: they
// guard the BEHAVIOUR — give up after a second attempt, skip the slot, move
// on, one rule across both paths — rather than the date-only names, which is
// what made them fail on an implementation that had got strictly better.
check('an unreadable answer is given up on rather than re-asked',
  /unresolvedAttemptsRef/.test(CHAT_SRC)
  && /attempts >= 2/.test(CHAT_SRC)
  // It says where to add the date instead of promising it can stay open —
  // submit requires one (submission-requirements.ts).
  && /add the need-by date on the right/.test(CHAT_SRC)
  && /skippedSlots/.test(CHAT_SRC));
// Both fields with a parser behind them, not just the date.
check('the budget gives up too, rather than a second copy of the rule',
  /leave the budget open/.test(CHAT_SRC)
  && (CHAT_SRC.match(/noteUnresolvedAttempt\(/g) ?? []).length >= 3);
check('giving up moves to the next question, it does not re-ask',
  /dateOutcome\.skipped && slot\.id === 'deliveryDate'/.test(CHAT_SRC)
  && /valueOutcome\.skipped && slot\.id === 'value'/.test(CHAT_SRC));
check('both the assistant and the offline paths share one rule',
  /const noteUnresolvedAttempt = useCallback/.test(CHAT_SRC)
  && /offlineOutcome/.test(CHAT_SRC));

console.log('\nA failed answer cannot leave the input disabled');
// Under StrictMode an effect runs, is cleaned up, then runs again on the same
// instance, and a typing flag cleared only when "not cancelled" was never
// cleared — the input stayed disabled for good. The flag is cleared
// unconditionally wherever it is set.
check('the typing flag is cleared unconditionally',
  /finally \{[\s\S]{0,400}?setIsTyping\(false\);/.test(CHAT_SRC)
  && !/if \(!cancelled\) setIsTyping\(false\)/.test(CHAT_SRC));

console.log('\nThe conversation says what the description is for');
// "6 of 14 questions answered" is a progress bar; it never said why any of it
// mattered. The close says who reads it — so the requester knows they will not
// be asked again.
check('the close says who reads the description',
  /The risk assessment and any sourcing event read it/.test(HOOK_SRC));
check('the engine still chooses the slot and completeness',
  /determineNextQuestion\(ctx, undefined, slots\)/.test(CHAT_SRC)
  && /isConversationComplete\(ctx, undefined, slots\)/.test(CHAT_SRC));
check('the endpoint asks for the question in the requester\u2019s own context',
  /their own words/.test(INTAKE_API_SRC) && /do NOT append an example/i.test(INTAKE_API_SRC));

console.log('\nThe chat challenges a non-answer, and the gate can be reached');
//
// Source checks. The reported dead end — "the Next button is not getting
// enabled despite everything is provided" — was a propagation bug: the offline
// fallback wrote captured answers to LOCAL state only and never called
// `onUpdate`, so `formData.serviceDescription` stayed empty and the step-3 gate
// saw nothing. A behavioural mirror would not have caught it; only the wiring
// shows it.
const ANSWER_QUALITY_SRC = readFileSync(
  join(ROOT, 'src/lib/procurement/answer-quality.ts'), 'utf8');

// EVERY path that writes the captured description must also push it to the
// parent. This is the class of bug, not the instance.
const svcWrites = (CHAT_SRC.match(/setSvcDesc\(/g) ?? []).length;
const parentWrites = (CHAT_SRC.match(/onUpdate\(\{ serviceDescription/g) ?? []).length;
check('every setSvcDesc has a matching onUpdate({ serviceDescription })',
  parentWrites >= svcWrites - 1, `${svcWrites} local writes vs ${parentWrites} parent writes`);
check('the offline fallback propagates to the parent',
  /LLM unavailable[\s\S]{0,2600}onUpdate\(\{ serviceDescription/.test(CHAT_SRC));

check('a deterministic judge exists for the offline path',
  /export function assessAnswer/.test(ANSWER_QUALITY_SRC));
check('the chat consults it', /assessAnswer\(/.test(CHAT_SRC));
// LLM when available, deterministic otherwise — the user's rule.
check('the assistant judges when it returns a verdict',
  /readVerdict\(result\.answerVerdict\)/.test(CHAT_SRC)
  && /\?\?\s*assessAnswer\(/.test(CHAT_SRC));
check('a malformed verdict falls back rather than approving',
  /typeof v\.addresses !== 'boolean'\) return undefined/.test(CHAT_SRC));
// Challenge ONCE — never trap a requester who cannot phrase it.
check('a slot is challenged at most once', /challenged\.has\(/.test(CHAT_SRC)
  && /setChallenged\(/.test(CHAT_SRC));
check('a rejected answer is not written into the slot',
  /!verdict\.addresses && !challenged\.has[\s\S]{0,700}return;/.test(CHAT_SRC));
check('the second attempt is accepted and flagged weak',
  /acceptedWeak/.test(CHAT_SRC) && /'weak'/.test(CHAT_SRC));
check('an accepted draft is recorded as assistant-drafted',
  /'assistant-drafted'/.test(CHAT_SRC) && /acceptDraft/.test(CHAT_SRC));
// The endpoint must not invent facts when drafting.
check('the endpoint forbids inventing a suggestion',
  /Invent NOTHING/.test(INTAKE_API_SRC) && /leave "suggested" empty/.test(INTAKE_API_SRC));

console.log('\nOne service description, and it is editable');
// The executive summary is drawn once, in Your request, from the one narrative.
check('the narrative text is rendered exactly once',
  (PANEL_SRC.match(/\{props\.summary\}/g) ?? []).length === 1
  && /summary=\{route === 'new-request' \? sd\.svcDesc\.narrative/.test(PAGE_SRC)
  && !/\{svcDesc\.narrative\}|\{sd\.svcDesc\.narrative\}/.test(PAGE_SRC + PANEL_SRC));
check('and it is not duplicated as "Generated Service Description"',
  !/Generated Service Description/.test(PAGE_SRC + PANEL_SRC));
// "either it is polished by AI or not required"
check('no unpolished narrative is composed in the chat', !/unpolished: true/.test(CHAT_SRC));
check('a section is edited in place, through the engine',
  /case 'section': sd\.handleSowEdit\(editor\.section, text\)/.test(PAGE_SRC)
  && /edit: \{ kind: 'section' as const, section: s\.id \}/.test(ROWS_SRC));
check('the conversation opens once', /openedRef/.test(HOOK_SRC));

console.log('\nNothing calls .trim() on a value it has not proved is a string');
//
// The live crash: "r?.trim is not a function". A service-description record
// carries a number, two arrays and two objects alongside its text sections, so
// `Object.values(sow).some((v) => v?.trim())` throws the moment one of them is
// present. A behavioural mirror cannot catch this — it would mirror the fixed
// logic — so scan the source for the pattern itself.
import { readdirSync, statSync } from 'node:fs';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(e)) out.push(full);
  }
  return out;
}

// `.some(v => v?.trim())` / `.filter(([, v]) => v?.trim())` over an object's
// values, with no type check in sight.
const UNGUARDED = /Object\.(values|entries)\([^)]*\)[\s\S]{0,40}?\?\.trim\(\)/;
const offenders = walk(join(ROOT, 'src'))
  .filter((f) => UNGUARDED.test(readFileSync(f, 'utf8')))
  .map((f) => f.split('/orchestration-ui/')[1] ?? f);
check('no unguarded .trim() over an object\u2019s values in src/',
  offenders.length === 0, offenders.join(', '));

// The root of the crash class: a service-description record cast to a map of
// strings. TypeScript accepts `as unknown as Record<string, string | undefined>`
// and then stops helping; the walker downstream trims a number. Narrow with
// sectionValuesOf() instead — a cast anywhere in src/ reopens the hole.
const CAST = /as unknown as Record<string, string/;
const casters = walk(join(ROOT, 'src'))
  .filter((f) => CAST.test(readFileSync(f, 'utf8')))
  .map((f) => f.split('/orchestration-ui/')[1] ?? f);
check('no service-description record is cast to a map of strings',
  casters.length === 0, casters.join(', '));
// Both seed call sites narrow instead.
for (const [label, file] of [
  ['the risk form pre-populates from narrowed sections',
    'src/features/requests/request-detail/components/step-detail-card.tsx'],
  ['the sourcing event seeds from narrowed sections',
    'src/features/requests/request-detail/components/action-buttons.tsx'],
]) {
  check(label, /sectionValuesOf\(serviceDescription\)/.test(readFileSync(join(ROOT, file), 'utf8')));
}

// And the two that actually crashed, specifically.
const SIGNALS_SRC = readFileSync(join(ROOT, 'src/lib/procurement/demand-signals.ts'), 'utf8');
const RISK_SRC = readFileSync(join(ROOT, 'src/lib/workflow/risk-stage.ts'), 'utf8');
check('demand-signals checks the type before trimming',
  /typeof v === 'string' && v\.trim\(\)/.test(SIGNALS_SRC));
check('risk-stage checks the type before trimming',
  /typeof v === 'string' && v\.trim\(\)/.test(RISK_SRC));
// The call site hands over text only.
check('the chat passes only text sections to the signal read',
  /sow: sectionsOnly\(svcDesc\)/.test(CHAT_SRC) && /function sectionsOnly/.test(CHAT_SRC));

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All intake-guidance checks passed.');
process.exit(failures === 0 ? 0 : 1);
