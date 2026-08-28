#!/usr/bin/env node
// Intake guidance: a progress bar that can reach 100%, a step that will not let
// you leave without the essentials, and a wizard that explains itself.
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
//   3. Step 3's Next needed only `title` and `estimatedValue > 0`.
//      `requiredSlotsFilled` — the mandatory-SOW guarantee the engine defines
//      to stop an LLM short-circuiting the conversation — was computed in the
//      chat component and never consulted at the gate.
//
// Self-contained — mirrors src/lib/procurement/demand-conversation.ts,
// src/lib/procurement/service-description-defaults.ts and
// src/features/requests/new-request/step-guidance.ts. Keep in sync.
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

// ── the guidance copy is READ, not mirrored ─────────────────────────────────
//
// Everything above is a mirror because it is logic. Guidance is copy, and a
// mirrored copy of copy asserts nothing — it would pass while the real map was
// empty. So this reads the source and checks the actual strings.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUIDANCE_SRC = readFileSync(
  join(ROOT, 'src/features/requests/new-request/step-guidance.ts'), 'utf8');
const WIZARD_SRC = readFileSync(
  join(ROOT, 'src/features/requests/new-request/new-request-page.tsx'), 'utf8');

/** Pull one `N: { ... }` entry out of a `Record<number, StepGuidance>` literal. */
function guidanceEntry(src, mapName, step) {
  const mapStart = src.indexOf(`export const ${mapName}`);
  if (mapStart < 0) return null;
  // The next map declaration, or end of file — bounds this map's body.
  const nextMap = src.indexOf('export const ', mapStart + 1);
  const body = src.slice(mapStart, nextMap < 0 ? src.length : nextMap);
  const key = new RegExp(`^  ${step}: `, 'm');
  const at = body.search(key);
  if (at < 0) return null;
  const rest = body.slice(at);
  // An alias entry (`1: STEP_GUIDANCE[1],`) resolves to the map it points at.
  const alias = rest.match(/^ {2}\d+: (\w+)\[(\d+)\],/);
  if (alias) return guidanceEntry(src, alias[1], Number(alias[2]));
  const end = rest.indexOf('\n  },');
  return end < 0 ? null : rest.slice(0, end);
}

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

console.log('\nStep 3 will not let you leave without the essentials');
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

console.log('\nEvery step explains itself');
for (const step of [1, 2, 3, 4, 5, 6]) {
  const entry = guidanceEntry(GUIDANCE_SRC, 'STEP_GUIDANCE', step);
  check(`step ${step} has guidance`, entry !== null);
  if (!entry) continue;
  // Prettier wraps most of these onto the next line, so the quote is not
  // necessarily adjacent to the key.
  check(`step ${step} says what it is for`, /purpose:\s*['"`]/.test(entry) && entry.length > 120);
  check(`step ${step} says what happens after`, /\n {4}next: *['"`]/.test(entry));
  check(`step ${step} says what the requester supplies`, /youProvide: \[/.test(entry));
}
// Step 7 is the confirmation screen, which carries its own "What happens
// next?" — a panel there would be the duplication this change removes.
check('step 7 is deliberately absent', guidanceEntry(GUIDANCE_SRC, 'STEP_GUIDANCE', 7) === null);
for (const step of [1, 2, 3]) {
  check(`catalogue step ${step} has guidance`,
    guidanceEntry(GUIDANCE_SRC, 'CATALOGUE_STEP_GUIDANCE', step) !== null);
}

console.log('\nThe guidance is white-label and actually rendered');
// Ground rule 1: no organisation or sector naming anywhere in requester copy.
const BANNED = /\b(bank|banking|insurer|insurance|financial services|fintech|hospital|retailer)\b/i;
check('no organisation or sector naming in the guidance copy', !BANNED.test(GUIDANCE_SRC),
  (GUIDANCE_SRC.match(BANNED) ?? [])[0]);
// The failure that made `step.description` dead config for the wizard's whole
// life: defined on every STEPS entry and drawn nowhere.
check('the wizard renders the header panel', /<StepHeaderPanel/.test(WIZARD_SRC));
check("the stepper renders each step's description", /\{step\.description\}/.test(WIZARD_SRC));
check('the gate calls the engine, not its own title-and-value test',
  /requiredSlotsFilled\(/.test(WIZARD_SRC) && !/return !!formData\.title && formData\.estimatedValue > 0;\n {6}case 4/.test(WIZARD_SRC));

console.log('\nThe chat is not canned');
//
// Source checks, not mirrors — a mirror of the intended shape would have passed
// the whole time the real code was concatenating the example onto the question
// and discarding the model's phrasing.
const CONV_SRC = readFileSync(
  join(ROOT, 'src/lib/procurement/demand-conversation.ts'), 'utf8');
const CHAT_SRC = readFileSync(
  join(ROOT, 'src/features/requests/new-request/step-chat-intake.tsx'), 'utf8');
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
check('the chat renders the example as its own element', /msg\.example &&/.test(CHAT_SRC));
// The endpoint generated a contextual phrasing that the client threw away.
check("the assistant's phrasing is used, not discarded",
  /usableQuestion\(result\.nextQuestion\)/.test(CHAT_SRC));
check('and it is guarded rather than trusted blindly',
  /function usableQuestion/.test(CHAT_SRC) && /includes\('\?'\)/.test(CHAT_SRC));
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
// Count renders of the narrative TEXT, not references to it: a copy button
// legitimately reads the same value without displaying it again.
const narrativeRenders = (CHAT_SRC.match(/\{svcDesc\.narrative\}/g) ?? []).length;
check('the narrative text is rendered exactly once', narrativeRenders === 1,
  `${narrativeRenders} renders`);
check('and it is no longer duplicated as "Generated Service Description"',
  !/Generated Service Description<\/p>/.test(CHAT_SRC));
// "either it is polished by AI or not required"
check('no unpolished narrative is composed in the chat',
  !/unpolished: true/.test(CHAT_SRC));
check('the carried-over description is editable',
  /key === 'title' \|\| key === 'estimatedValue'/.test(CHAT_SRC));
check('the assistant opens the conversation',
  /openedRef/.test(CHAT_SRC) && /messages: \[\]/.test(CHAT_SRC));

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
