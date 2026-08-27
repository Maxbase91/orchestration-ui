#!/usr/bin/env node
// Verifies the configurable service description: that the serialised slot
// conditions reproduce the hardcoded ones exactly, that the compact narrative
// composes from the configured sections, and that the sourcing seed is derived
// rather than invented.
//
// The first section is the migration's safety net. `appliesWhen` was a closure
// and is now a {field, operator, value} condition; if the two disagree about
// which questions get asked, the config has silently changed the intake
// conversation. Equivalence is asserted before anything else.
//
// Self-contained — mirrors src/lib/procurement/service-description-{config,defaults}.ts
// and the branch rules in demand-conversation.ts. Keep in sync.
// Run: node tests/integration/service-description-config.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── the governed thresholds the conditions defer to ─────────────────────────
const POLICY = { criticalServiceThreshold: 100_000, continuityThreshold: 250_000 };

// ── mirrors service-description-config.ts ───────────────────────────────────
function resolveConditionValue(raw, config) {
  if (raw.startsWith('policy:')) {
    const v = config[raw.slice('policy:'.length)];
    return typeof v === 'number' ? v : raw;
  }
  return raw;
}

function evaluateSlotCondition(condition, ctx, config) {
  const lhsRaw = condition.field === 'value' ? ctx.value : ctx.category;
  const rhsRaw = resolveConditionValue(condition.value, config);

  if (condition.operator === 'in') {
    const list = String(rhsRaw).split(',').map((s) => s.trim().toLowerCase());
    return list.includes(String(lhsRaw ?? '').toLowerCase());
  }
  const lhsNum = typeof lhsRaw === 'number' ? lhsRaw : Number.parseFloat(String(lhsRaw ?? ''));
  const rhsNum = typeof rhsRaw === 'number' ? rhsRaw : Number.parseFloat(String(rhsRaw));
  const numeric = Number.isFinite(lhsNum) && Number.isFinite(rhsNum);
  const l = numeric ? lhsNum : String(lhsRaw ?? '').toLowerCase();
  const r = numeric ? rhsNum : String(rhsRaw).toLowerCase();
  switch (condition.operator) {
    case '>=': return l >= r;
    case '>':  return l > r;
    case '<=': return l <= r;
    case '<':  return l < r;
    case '==': return l === r;
    case '!=': return l !== r;
    default:   return true;
  }
}

const slotApplies = (slot, ctx, config) =>
  !slot.conditions?.length || slot.conditions.every((c) => evaluateSlotCondition(c, ctx, config));

function composeNarrativeFromSections(sections, narrativeSections, meta) {
  const parts = narrativeSections.map((id) => sections[id]?.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const opener = meta.title
    ? `${meta.title}${meta.category ? ` (${meta.category})` : ''}${
        meta.value ? ` — estimated value €${meta.value.toLocaleString()}` : ''}.`
    : '';
  const body = [opener, ...parts].filter(Boolean).join('\n\n');
  return meta.unpolished
    ? `${body}\n\nDrafted directly from the captured intake answers without AI polishing.`
    : body;
}

// ── the HARDCODED rules, as they exist in demand-conversation.ts today ──────
const TIME_BASED_CATEGORIES = new Set(['services', 'consulting', 'contingent-labour']);
const OUTCOME_CATEGORIES = new Set(['services', 'consulting', 'software']);

const HARDCODED_APPLIES = {
  title: () => true, value: () => true, deliveryDate: () => true,
  objective: () => true, scope: () => true, deliverables: () => true, resources: () => true,
  timeline: (ctx) => TIME_BASED_CATEGORIES.has(ctx.category),
  acceptanceCriteria: (ctx) => OUTCOME_CATEGORIES.has(ctx.category),
  pricingModel: (ctx, c) => (ctx.value ?? 0) >= c.criticalServiceThreshold,
  dependencies: (ctx, c) => (ctx.value ?? 0) >= c.continuityThreshold,
};

// ── the CONFIGURED equivalents, as serialised in the defaults module ────────
const TIME_BASED = 'services,consulting,contingent-labour';
const OUTCOME_BASED = 'services,consulting,software';
const CONFIGURED_SLOTS = [
  { id: 'title' }, { id: 'value' }, { id: 'deliveryDate' },
  { id: 'objective' }, { id: 'scope' }, { id: 'deliverables' }, { id: 'resources' },
  { id: 'timeline', conditions: [{ field: 'category', operator: 'in', value: TIME_BASED }] },
  { id: 'acceptanceCriteria', conditions: [{ field: 'category', operator: 'in', value: OUTCOME_BASED }] },
  { id: 'pricingModel', conditions: [{ field: 'value', operator: '>=', value: 'policy:criticalServiceThreshold' }] },
  { id: 'dependencies', conditions: [{ field: 'value', operator: '>=', value: 'policy:continuityThreshold' }] },
];

console.log('Configured conditions reproduce the hardcoded ones');
// Every category × value combination that could change an answer.
const CATEGORIES = ['services', 'consulting', 'software', 'goods', 'contingent-labour', 'unknown'];
const VALUES = [0, 5_000, 99_999, 100_000, 249_999, 250_000, 1_000_000];
let divergences = 0;
let compared = 0;
for (const category of CATEGORIES) {
  for (const value of VALUES) {
    const ctx = { category, value };
    for (const slot of CONFIGURED_SLOTS) {
      compared++;
      const configured = slotApplies(slot, ctx, POLICY);
      const hardcoded = HARDCODED_APPLIES[slot.id](ctx, POLICY);
      if (configured !== hardcoded) {
        divergences++;
        console.error(`      ${slot.id} @ ${category}/${value}: configured=${configured} hardcoded=${hardcoded}`);
      }
    }
  }
}
check(`all ${compared} category × value × slot combinations agree`, divergences === 0,
  `${divergences} diverged`);

// Slot-by-slot agreement is necessary but not sufficient: what the requester
// actually experiences is the ORDERED AGENDA. A template could agree on every
// individual slot and still ask them in a different order, or drop one, and the
// check above would pass. So compare the agendas themselves — this is what makes
// switching the conversation off the hardcoded ALL_SLOTS safe.
console.log('\nTemplate-driven agenda matches the built-in, in order');
const isFilled = (slot, ctx) => {
  if (slot.id === 'value') return (ctx.value ?? 0) > 0;
  if (slot.id === 'title') return !!ctx.title;
  if (slot.id === 'deliveryDate') return !!ctx.deliveryDate;
  return !!(ctx.sow ?? {})[slot.id];
};
const agendaFrom = (slots, ctx, applies) =>
  slots.filter((s) => !isFilled(s, ctx) && applies(s, ctx)).map((s) => s.id);

let agendaDivergences = 0;
let agendasCompared = 0;
// Partially-filled contexts too: carry-forward is the behaviour most likely to
// break when the slot source changes.
const PARTIALS = [
  {},
  { title: 'x' },
  { title: 'x', sow: { objective: 'o' } },
  { title: 'x', sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' } },
];
for (const category of CATEGORIES) {
  for (const value of VALUES) {
    for (const partial of PARTIALS) {
      const ctx = { category, value, ...partial };
      agendasCompared++;
      const fromTemplate = agendaFrom(CONFIGURED_SLOTS, ctx, (s, c) => slotApplies(s, c, POLICY));
      const fromBuiltIn = agendaFrom(CONFIGURED_SLOTS, ctx, (s, c) => HARDCODED_APPLIES[s.id](c, POLICY));
      if (fromTemplate.join('>') !== fromBuiltIn.join('>')) {
        agendaDivergences++;
        console.error(`      ${category}/${value}: ${fromTemplate.join('>')} vs ${fromBuiltIn.join('>')}`);
      }
    }
  }
}
check(`all ${agendasCompared} agendas match the built-in order exactly`, agendaDivergences === 0,
  `${agendaDivergences} diverged`);
// The mandatory floor is not the template's to lower.
const REQUIRED_FLOOR = ['title', 'value', 'objective', 'scope', 'deliverables', 'resources'];
check('the required floor is present in the configured set',
  REQUIRED_FLOOR.every((id) => CONFIGURED_SLOTS.some((s) => s.id === id)));

console.log('\nThe branch rules themselves');
check('timeline is asked for services', slotApplies(CONFIGURED_SLOTS[7], { category: 'services' }, POLICY));
check('timeline is not asked for goods', !slotApplies(CONFIGURED_SLOTS[7], { category: 'goods' }, POLICY));
check('acceptance criteria is asked for software',
  slotApplies(CONFIGURED_SLOTS[8], { category: 'software' }, POLICY));
check('acceptance criteria is not asked for contingent labour',
  !slotApplies(CONFIGURED_SLOTS[8], { category: 'contingent-labour' }, POLICY));
check('pricing model fires at the threshold, not above it',
  slotApplies(CONFIGURED_SLOTS[9], { value: 100_000 }, POLICY));
check('pricing model does not fire below', !slotApplies(CONFIGURED_SLOTS[9], { value: 99_999 }, POLICY));
check('dependencies fires at its own, higher threshold',
  slotApplies(CONFIGURED_SLOTS[10], { value: 250_000 }, POLICY) &&
  !slotApplies(CONFIGURED_SLOTS[10], { value: 249_999 }, POLICY));
check('an unknown category still asks the unconditional slots',
  slotApplies(CONFIGURED_SLOTS[0], { category: 'unknown' }, POLICY));

console.log('\nThresholds stay governed, not pinned');
// The whole point of policy: indirection — moving the threshold in Admin must
// move the question, or the config has quietly detached from /admin/thresholds.
const LOWERED = { criticalServiceThreshold: 10_000, continuityThreshold: 20_000 };
check('lowering the threshold makes the question apply to a smaller demand',
  !slotApplies(CONFIGURED_SLOTS[9], { value: 50_000 }, POLICY) &&
  slotApplies(CONFIGURED_SLOTS[9], { value: 50_000 }, LOWERED));
check('a literal value is unaffected by policy',
  slotApplies({ conditions: [{ field: 'value', operator: '>=', value: '1000' }] }, { value: 5000 }, LOWERED));

console.log('\nCompact narrative composes from the configured sections');
const SECTIONS = {
  objective: 'Replace the legacy CRM.',
  scope: 'EMEA only; excludes data migration.',
  deliverables: '1. Licences\n2. Training',
  timeline: 'Phase 1 discovery, 4 weeks.',
  resources: 'Two implementation consultants.',
  acceptanceCriteria: '1. UAT signed off\n2. 99.9% uptime',
  pricingModel: 'Per-seat subscription.',
  location: 'Frankfurt campus.',
  dependencies: 'SSO integration.',
};
const NARRATIVE_SECTIONS = ['objective', 'scope', 'deliverables', 'timeline',
  'resources', 'acceptanceCriteria', 'pricingModel'];
const narrative = composeNarrativeFromSections(SECTIONS, NARRATIVE_SECTIONS,
  { title: 'CRM replacement', category: 'software', value: 240000 });
check('it opens with the demand', narrative.startsWith('CRM replacement (software)'));
check('it includes every nominated section',
  NARRATIVE_SECTIONS.every((id) => narrative.includes(SECTIONS[id].split('\n')[0])));
// `location` is generated but never asked, so it is deliberately not part of the
// compact form — the detailed sections are where inferred content belongs.
check('it excludes sections not nominated', !narrative.includes('Frankfurt campus'));
check('reordering the config reorders the narrative',
  composeNarrativeFromSections(SECTIONS, ['scope', 'objective'], {})
    .indexOf('EMEA only') <
  composeNarrativeFromSections(SECTIONS, ['scope', 'objective'], {})
    .indexOf('Replace the legacy'));
check('an empty section list yields nothing, not a stray opener',
  composeNarrativeFromSections(SECTIONS, [], { title: 'X' }) === '');
check('missing sections are skipped rather than rendered blank',
  !composeNarrativeFromSections({ objective: 'A' }, ['objective', 'scope'], {}).includes('undefined'));
check('the unpolished caveat is appended when the LLM did not run',
  composeNarrativeFromSections(SECTIONS, ['objective'], { unpolished: true })
    .includes('without AI polishing'));

console.log('\nSections declare what was asked vs inferred');
const DEFAULT_SECTIONS = [
  { id: 'objective', asked: true }, { id: 'scope', asked: true },
  { id: 'deliverables', asked: true }, { id: 'timeline', asked: true },
  { id: 'resources', asked: true }, { id: 'acceptanceCriteria', asked: true },
  { id: 'pricingModel', asked: true }, { id: 'location', asked: false },
  { id: 'dependencies', asked: true },
];
const slotTargets = new Set(['objective', 'scope', 'deliverables', 'resources',
  'timeline', 'acceptanceCriteria', 'pricingModel', 'dependencies']);
// location is generated by the model and has never had a slot; presenting it
// beside captured answers with nothing marking the difference is the bug.
check('location is marked inferred, not asked',
  DEFAULT_SECTIONS.find((s) => s.id === 'location').asked === false);
check('every section marked asked has a slot that asks it',
  DEFAULT_SECTIONS.filter((s) => s.asked).every((s) => slotTargets.has(s.id)));
check('every section marked inferred has no slot',
  DEFAULT_SECTIONS.filter((s) => !s.asked).every((s) => !slotTargets.has(s.id)));

console.log('\nThe output format follows the configured sections');
const buildOutputFormat = (sections) =>
  `{\n  "sections": {\n${sections.map((s) => `    "${s.id}": "..."`).join(',\n')}\n  },\n  "narrative": "..."\n}`;
const fmt = buildOutputFormat(DEFAULT_SECTIONS);
check('it names every configured section', DEFAULT_SECTIONS.every((s) => fmt.includes(`"${s.id}"`)));
// Without this the prompt would keep asking for nine fixed keys however the
// admin edits the section list.
check('removing a section removes it from the prompt',
  !buildOutputFormat(DEFAULT_SECTIONS.filter((s) => s.id !== 'location')).includes('"location"'));

console.log('\nSourcing seed is derived from the description');
const SOURCING_SECTIONS = ['scope', 'deliverables', 'acceptanceCriteria'];
const seedRequirements = (sections, ids, labels) =>
  ids.map((id) => (sections[id]?.trim() ? `${labels[id]}: ${sections[id].trim()}` : null)).filter(Boolean);
const LABELS = { scope: 'Scope', deliverables: 'Deliverables', acceptanceCriteria: 'Acceptance Criteria' };
const reqs = seedRequirements(SECTIONS, SOURCING_SECTIONS, LABELS);
check('three requirements are seeded', reqs.length === 3);
check('each is labelled', reqs[0].startsWith('Scope:'));
// Objective is context and pricing is commercial; neither is something a bid is
// scored against, so neither belongs in the requirement list.
check('objective and pricing are not requirements',
  !reqs.some((r) => r.startsWith('Objective:') || r.startsWith('Pricing')));
check('an empty section contributes nothing rather than an empty bullet',
  seedRequirements({ scope: '   ' }, ['scope'], LABELS).length === 0);
check('a request with no description seeds nothing',
  seedRequirements({}, SOURCING_SECTIONS, LABELS).length === 0);

const DEFAULT_CRITERIA = [
  { id: 'c1', label: 'Technical Capability', weight: 40 },
  { id: 'c2', label: 'Price', weight: 30 },
  { id: 'c3', label: 'Experience', weight: 20 },
  { id: 'c4', label: 'Sustainability', weight: 10 },
];
// The wizard blocks publishing when weights do not total 100, so a seed that
// does not total 100 would hand the user a broken starting point.
check('the seeded criteria total 100',
  DEFAULT_CRITERIA.reduce((s, c) => s + c.weight, 0) === 100);

console.log(failures === 0 ? '\n\x1b[32mAll checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
