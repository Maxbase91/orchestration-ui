#!/usr/bin/env node
// The configurable service description actually configures something.
//
// Three things are asserted: that the serialised slot conditions reproduce the
// hardcoded ones exactly, that the compact narrative composes from the
// configured sections, and that the sourcing seed is derived rather than
// invented.
//
// THIS FILE USED TO MIRROR THE CODE IT TESTS. It carried its own copies of
// `evaluateSlotCondition`, `slotApplies`, `composeNarrativeFromSections`,
// `buildOutputFormat`, the seed function, `DEFAULT_SECTIONS`,
// `DEFAULT_CRITERIA` and the configured slot set — with a header saying "keep
// in sync", which it had not been. Two live defects passed it cleanly:
//
//  * The mirror's `default: return true` matched the real evaluator's, so
//    neither was tested. An operator this evaluator does not implement made a
//    slot always asked and a section always mandatory.
//  * The mirror resolved the left-hand side as
//    `field === 'value' ? ctx.value : ctx.category` — a two-field world. The
//    real `SlotConditionField` declares six, and the four governance fields
//    never reached slots at all. A copy cannot notice what the original is
//    missing.
//
// Everything now drives the real modules. The only local constants left are
// fixtures — inputs and expected answers — never reimplementations.
import { readFileSync } from 'node:fs';
import {
  slotApplies, evaluateSlotCondition, composeNarrativeFromSections, diagnoseSlotConditions,
} from '../../src/lib/procurement/service-description-config.ts';
import {
  DEFAULT_TEMPLATE, DEFAULT_SECTIONS, DEFAULT_SLOTS, DEFAULT_NARRATIVE_SECTIONS,
  DEFAULT_SOURCING_CRITERIA, buildOutputFormat, renderSystemPrompt, builtInGuidanceFor, BUILT_IN_CATEGORY_GUIDANCE,
} from '../../src/lib/procurement/service-description-defaults.ts';
import { seedRequirementsFromDescription } from '../../src/lib/procurement/service-description-seed.ts';
import {
  ALL_SLOTS, applicableSlots, resolveSlots, outstandingRequiredSlots, REQUIRED_SLOT_IDS,
} from '../../src/lib/procurement/demand-conversation.ts';
import { DEFAULT_POLICY_CONFIG, resolvePolicyConfig } from '../../src/lib/procurement/policy-config.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const POLICY = DEFAULT_POLICY_CONFIG;

// ── The configured set reproduces the built-in one ──────────────────────────
// `appliesWhen` was a closure and is now a {field, operator, value} condition.
// If the two disagree about which questions get asked, the config has silently
// changed the intake conversation. Both sides are the REAL slot sets and the
// REAL filter, so this compares the engine against itself rather than two
// transcriptions against each other.
console.log('Configured conditions reproduce the built-in ones');
const CATEGORIES = ['services', 'consulting', 'software', 'goods', 'contingent-labour', 'unknown'];
const VALUES = [0, 5_000, 99_999, 100_000, 249_999, 250_000, 1_000_000];
// Partially-filled contexts too: carry-forward is the behaviour most likely to
// break when the slot source changes.
const PARTIALS = [
  {},
  { title: 'x' },
  { title: 'x', sow: { objective: 'o' } },
  { title: 'x', sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' } },
];

let divergences = 0;
let compared = 0;
const configuredSlots = resolveSlots(DEFAULT_SLOTS);
for (const category of CATEGORIES) {
  for (const value of VALUES) {
    for (const partial of PARTIALS) {
      const ctx = { category, estimatedValue: value, sow: {}, ...partial };
      compared++;
      // The ORDERED agenda, not slot-by-slot: a template could agree on every
      // individual slot and still ask them in a different order or drop one.
      const fromTemplate = applicableSlots(ctx, POLICY, configuredSlots).map((s) => s.id).join('>');
      const fromBuiltIn = applicableSlots(ctx, POLICY, ALL_SLOTS).map((s) => s.id).join('>');
      if (fromTemplate !== fromBuiltIn) {
        divergences++;
        if (divergences <= 5) console.error(`      ${category}/${value}: ${fromTemplate} vs ${fromBuiltIn}`);
      }
    }
  }
}
check(`all ${compared} agendas match the built-in order exactly`, divergences === 0,
  `${divergences} diverged`);

// The mandatory floor is not the template's to lower.
check('the required floor is present in the configured set',
  REQUIRED_SLOT_IDS.every((id) => DEFAULT_SLOTS.some((s) => s.id === id)));

// ── The branch rules themselves ─────────────────────────────────────────────
console.log('\nThe branch rules themselves');
const slot = (id) => DEFAULT_SLOTS.find((s) => s.id === id);
const applies = (id, ctx, config = POLICY) => slotApplies(slot(id), ctx, config);

check('timeline is asked for services', applies('timeline', { category: 'services' }));
check('timeline is not asked for goods', !applies('timeline', { category: 'goods' }));
check('acceptance criteria is asked for software', applies('acceptanceCriteria', { category: 'software' }));
check('acceptance criteria is not asked for contingent labour',
  !applies('acceptanceCriteria', { category: 'contingent-labour' }));
check('pricing model fires at the threshold, not above it',
  applies('pricingModel', { value: POLICY.criticalServiceThreshold }));
check('pricing model does not fire below',
  !applies('pricingModel', { value: POLICY.criticalServiceThreshold - 1 }));
check('dependencies fires at its own, higher threshold',
  applies('dependencies', { value: POLICY.continuityThreshold })
  && !applies('dependencies', { value: POLICY.continuityThreshold - 1 }));
check('an unknown category still asks the unconditional slots',
  applies('title', { category: 'unknown' }));

// ── Thresholds stay governed, not pinned ───────────────────────────────────
console.log('\nThresholds stay governed, not pinned');
// The whole point of `policy:` indirection — moving the threshold in Admin must
// move the question, or the config has quietly detached from /admin/thresholds.
const LOWERED = resolvePolicyConfig({ criticalServiceThreshold: 10_000, continuityThreshold: 20_000 });
check('lowering the threshold makes the question apply to a smaller demand',
  !applies('pricingModel', { value: 50_000 })
  && applies('pricingModel', { value: 50_000 }, LOWERED));
check('a literal value is unaffected by policy',
  slotApplies({ conditions: [{ field: 'value', operator: '>=', value: '1000' }] }, { value: 5000 }, LOWERED));

// ── An unusable condition does not silently pass ───────────────────────────
console.log('\nA condition this evaluator cannot act on never holds');
// `default: return true` made a typo'd operator look like policy: the slot was
// always asked and the section always mandatory, and nothing said why.
check('an unimplemented operator is false, not true',
  evaluateSlotCondition({ field: 'value', operator: 'greater_than', value: '1' }, { value: 5 }, POLICY) === false);
check('an implemented operator still evaluates',
  evaluateSlotCondition({ field: 'value', operator: '>', value: '1' }, { value: 5 }, POLICY) === true);
check('an unknown field does not hold',
  evaluateSlotCondition({ field: 'nope', operator: '==', value: 'x' }, { value: 5 }, POLICY) === false);

// …and is reported rather than absorbed.
const diagnosed = diagnoseSlotConditions({
  slots: [{ id: 's1', conditions: [{ field: 'value', operator: 'greater_than', value: '1' }] },
    { id: 's2', requiredWhen: [{ field: 'nope', operator: '==', value: 'x' }] }],
  sections: [{ id: 'sec', label: 'Sec', requiredWhen: [{ field: 'value', operator: '>=', value: 'policy:nope' }] }],
}, POLICY);
const problems = diagnosed.map((d) => d.problem).join(' ');
check('an unimplemented operator is reported', /not implemented/.test(problems), problems);
check('an unknown field is reported', /nothing supplies/.test(problems), problems);
check('an unknown governed threshold is reported', /does not exist/.test(problems), problems);
check('the shipped template has no unusable condition',
  diagnoseSlotConditions(DEFAULT_TEMPLATE, POLICY).length === 0,
  diagnoseSlotConditions(DEFAULT_TEMPLATE, POLICY).map((d) => d.problem).join(' | '));

// ── The governance signals reach slots, not only sections ──────────────────
console.log('\nA slot can branch on the governance read, as its type says');
// `SlotConditionField` declares six fields. `fromConfiguredSlot` supplied two,
// so `materiality`, `riskTier`, `dataSensitivity` and `sourcingType` silently
// never matched on a SLOT — while working on a SECTION, because generate-sow
// builds the full context. Half working is why it looked fine.
const signalSlot = {
  id: 'exclusions',
  targetKind: 'sow',
  targetField: 'exclusions',
  required: false,
  prompt: 'What is excluded?',
  conditions: [{ field: 'materiality', operator: 'in', value: 'important,critical' }],
};
const withSignals = resolveSlots([...DEFAULT_SLOTS.filter((s) => s.id !== 'exclusions'), signalSlot]);
const asked = (value) => applicableSlots(
  { category: 'consulting', estimatedValue: value, sow: {} }, POLICY, withSignals,
).some((s) => s.id === 'exclusions');
// A €2m consulting engagement reads as material; a €1k one does not.
check('a materiality condition is evaluated at all', asked(2_000_000) !== asked(1_000),
  `€1k → ${asked(1_000)}, €2m → ${asked(2_000_000)} — the field never reached the slot`);
check('the material demand is the one asked', asked(2_000_000) === true);

// ── requiredWhen makes an answer mandatory ─────────────────────────────────
console.log('\nA template can add a requirement, and it binds');
// `ConfiguredSlot.requiredWhen` was declared, edited, persisted — and read by
// nothing: `fromConfiguredSlot` dropped it, so "a material engagement must
// state its exit provisions" saved successfully and governed nothing.
const mandatory = resolveSlots([
  ...DEFAULT_SLOTS.filter((s) => s.id !== 'exclusions'),
  { ...signalSlot, conditions: [], requiredWhen: [{ field: 'materiality', operator: 'in', value: 'important,critical' }] },
]);
const filled = { category: 'consulting', title: 't', deliveryDate: '2026-12-31', sow: { objective: 'o', scope: 's', deliverables: 'd', resources: 'r' } };
const outstandingBig = outstandingRequiredSlots({ ...filled, estimatedValue: 2_000_000 }, mandatory, POLICY);
const outstandingSmall = outstandingRequiredSlots({ ...filled, estimatedValue: 1_000 }, mandatory, POLICY);
check('the requirement binds on the demand it names',
  outstandingBig.some((s) => s.id === 'exclusions'),
  outstandingBig.map((s) => s.id).join(', ') || '(none outstanding)');
check('and not on the demand it does not',
  !outstandingSmall.some((s) => s.id === 'exclusions'));
// The floor is code-owned and a template cannot lower it.
const noneRequired = resolveSlots(DEFAULT_SLOTS.map((s) => ({ ...s, required: false, requiredWhen: [] })));
check('a template cannot lower the mandatory floor',
  outstandingRequiredSlots({ category: 'services', sow: {} }, noneRequired, POLICY).length > 0);

// ── Compact narrative composes from the configured sections ────────────────
console.log('\nCompact narrative composes from the configured sections');
const SECTIONS = {
  objective: 'Replace the legacy CRM.',
  scope: 'EMEA only; excludes data migration.',
  // The hand-copied narrative list in the previous version of this file omitted
  // `exclusions`, so the fixture never needed it and the omission never showed.
  exclusions: 'Hardware procurement is out of scope.',
  deliverables: '1. Licences\n2. Training',
  timeline: 'Phase 1 discovery, 4 weeks.',
  resources: 'Two implementation consultants.',
  acceptanceCriteria: '1. UAT signed off\n2. 99.9% uptime',
  pricingModel: 'Per-seat subscription.',
  location: 'Frankfurt campus.',
  dependencies: 'SSO integration.',
};
const narrative = composeNarrativeFromSections(SECTIONS, DEFAULT_NARRATIVE_SECTIONS,
  { title: 'CRM replacement', category: 'software', value: 240000 });
check('it opens with the demand', narrative.startsWith('CRM replacement (software)'));
check('it includes every nominated section',
  DEFAULT_NARRATIVE_SECTIONS.every((id) => narrative.includes(SECTIONS[id].split('\n')[0])));
// `location` is generated but never asked, so it is deliberately not part of the
// compact form — the detailed sections are where inferred content belongs.
check('it excludes sections not nominated', !narrative.includes('Frankfurt campus'));
check('reordering the config reorders the narrative',
  composeNarrativeFromSections(SECTIONS, ['scope', 'objective'], {}).indexOf('EMEA only')
  < composeNarrativeFromSections(SECTIONS, ['scope', 'objective'], {}).indexOf('Replace the legacy'));
check('an empty section list yields nothing, not a stray opener',
  composeNarrativeFromSections(SECTIONS, [], { title: 'X' }) === '');
check('missing sections are skipped rather than rendered blank',
  !composeNarrativeFromSections({ objective: 'A' }, ['objective', 'scope'], {}).includes('undefined'));
check('the unpolished caveat is appended when the LLM did not run',
  composeNarrativeFromSections(SECTIONS, ['objective'], { unpolished: true }).includes('without AI polishing'));

// ── Sections declare what was asked vs inferred ────────────────────────────
console.log('\nSections declare what was asked vs inferred');
const slotTargets = new Set(DEFAULT_SLOTS.filter((s) => s.targetKind === 'sow').map((s) => s.targetField));
// location is generated by the model and has never had a slot; presenting it
// beside captured answers with nothing marking the difference is the bug.
check('location is marked inferred, not asked',
  DEFAULT_SECTIONS.find((s) => s.id === 'location')?.asked === false);
check('every section marked asked has a slot that asks it',
  DEFAULT_SECTIONS.filter((s) => s.asked).every((s) => slotTargets.has(s.id)),
  DEFAULT_SECTIONS.filter((s) => s.asked && !slotTargets.has(s.id)).map((s) => s.id).join(', '));
check('every section marked inferred has no slot',
  DEFAULT_SECTIONS.filter((s) => !s.asked).every((s) => !slotTargets.has(s.id)));

// ── The output format follows the configured sections ──────────────────────
console.log('\nThe output format follows the configured sections');
const fmt = buildOutputFormat(DEFAULT_SECTIONS);
check('it names every configured section', DEFAULT_SECTIONS.every((s) => fmt.includes(`"${s.id}"`)));
// Without this the prompt would keep asking for nine fixed keys however the
// admin edits the section list.
check('removing a section removes it from the prompt',
  !buildOutputFormat(DEFAULT_SECTIONS.filter((s) => s.id !== 'location')).includes('"location"'));

// ── Sourcing seed is derived from the description ──────────────────────────
console.log('\nSourcing seed is derived from the description');
const reqs = seedRequirementsFromDescription(SECTIONS, DEFAULT_TEMPLATE);
check('a requirement is seeded for every nominated section',
  reqs.length === DEFAULT_TEMPLATE.sourcingRequirementSections.length,
  `${reqs.length} of ${DEFAULT_TEMPLATE.sourcingRequirementSections.length}`);
check('each is labelled with the section label',
  reqs.every((r) => DEFAULT_SECTIONS.some((s) => r.startsWith(`${s.label}: `))), reqs.join(' | '));
// Objective is context and pricing is commercial; neither is something a bid is
// scored against, so neither belongs in the requirement list.
check('objective and pricing are not requirements',
  !DEFAULT_TEMPLATE.sourcingRequirementSections.some((id) => id === 'objective' || id === 'pricingModel'));
check('an empty section contributes nothing rather than an empty bullet',
  seedRequirementsFromDescription({ scope: '   ' }, DEFAULT_TEMPLATE).length === 0);
check('a request with no description seeds nothing',
  seedRequirementsFromDescription({}, DEFAULT_TEMPLATE).length === 0);

// The wizard blocks publishing when weights do not total 100, so a seed that
// does not total 100 would hand the user a broken starting point.
check('the seeded criteria total 100',
  DEFAULT_SOURCING_CRITERIA.reduce((s, c) => s + c.weight, 0) === 100);

// ── Risk questions stay out of the admin-editable slot set ─────────────────
// `resolveSlots` REPLACES the built-in set when a template row exists, so a
// risk question living in `slots` would silently stop being asked for exactly
// the categories most likely to have a template. And the admin editor gives
// every slot a `required` switch and an editable prompt — turning off "does
// this grant privileged access?" would be a change to the inherent-risk
// cascade dressed as a copy edit.
{
  const configSource = readFileSync(new URL('../../src/lib/procurement/service-description-config.ts', import.meta.url), 'utf8');
  const start = configSource.indexOf('interface ConfiguredSlot');
  check('a configured slot cannot target a risk field',
    !/'risk'/.test(configSource.slice(start, start + 600)));
  const defaults = readFileSync(new URL('../../src/lib/procurement/service-description-defaults.ts', import.meta.url), 'utf8');
  check('no default slot is a risk question', !/privileged-access|critical-service/.test(defaults));
}

// ── The built-in drafting guidance is visible, not hidden in the route ─────
// It lived in api/generate-sow.ts, where the admin tab could not show it while
// its help said "leave empty to use the built-in guidance".
console.log('\nBuilt-in category guidance');
{
  const route = readFileSync(new URL('../../api/generate-sow.ts', import.meta.url), 'utf8');
  check('the generation route keeps no guidance of its own', !/CATEGORY_GUIDANCE\s*[:=]/.test(route) && /builtInGuidanceFor\(category\)/.test(route));
  check('a category with its own entry gets it', builtInGuidanceFor('consulting') === BUILT_IN_CATEGORY_GUIDANCE.consulting);
  check('a category with none (incl. one added in Admin) gets the general text', builtInGuidanceFor('research-services') === BUILT_IN_CATEGORY_GUIDANCE.default);
  const rendered = renderSystemPrompt({ ...DEFAULT_TEMPLATE, category: 'consulting', categoryGuidance: '', systemPrompt: 'X {{guidance}} Y' });
  check('an empty field renders the built-in text, as the server sends it', rendered.includes(BUILT_IN_CATEGORY_GUIDANCE.consulting.trim().slice(0, 40)));
  const own = renderSystemPrompt({ ...DEFAULT_TEMPLATE, category: 'consulting', categoryGuidance: 'OWN TEXT', systemPrompt: 'X {{guidance}} Y' });
  check('an admin\u2019s own guidance replaces it', own === 'X OWN TEXT Y');
  const page = readFileSync(new URL('../../src/features/admin/service-description-page.tsx', import.meta.url), 'utf8');
  check('the tab shows the built-in text and offers it to edit',
    /placeholder=\{builtInGuidanceFor\(current\.category\)\.trim\(\)\}/.test(page) && /Edit the built-in text/.test(page));
}

// ── Risk question wording ────────────────────────────────────────────────────
// The two residual questions were literals in residual-questions.ts. A
// category's template can word them; blank falls back; WHEN they are asked is
// still the Decisioning threshold, untouched by wording.
console.log('\nRisk question wording');
{
  const { determineResidualQuestions, RESIDUAL_QUESTION_TEXT } = await import('../../src/lib/procurement/residual-questions.ts');
  const { evaluateIntakeDetermination } = await import('../../src/lib/procurement/intake-determination.ts');
  const ctx = { category: 'software', dataSensitivity: 'low', estimatedValue: 200_000 };
  const plain = determineResidualQuestions(ctx, DEFAULT_POLICY_CONFIG);
  check('with no wording, the built-in text is asked', plain[0]?.question === RESIDUAL_QUESTION_TEXT['privileged-access']);
  const worded = determineResidualQuestions(ctx, DEFAULT_POLICY_CONFIG, { 'privileged-access': 'Will they get admin rights to our systems?', 'critical-service': '  ' });
  check('a category\u2019s wording replaces it', worded[0]?.question === 'Will they get admin rights to our systems?');
  check('blank wording falls back', worded.find((q) => q.id === 'critical-service')?.question === RESIDUAL_QUESTION_TEXT['critical-service']);
  check('wording never changes which questions are asked', JSON.stringify(plain.map((q) => q.id)) === JSON.stringify(worded.map((q) => q.id)));
  check('the default template carries no wording of its own', JSON.stringify(DEFAULT_TEMPLATE.riskQuestionWording) === '{}');
  const determination = evaluateIntakeDetermination({
    category: 'software', estimatedValue: 200_000, supplierId: '', isUrgent: false, miniIrq: {}, now: '2026-09-24',
    suppliers: [], contracts: [], matchingRiskAssessments: [], routingRules: [], approvalChains: [],
    policyConfig: DEFAULT_POLICY_CONFIG, riskQuestionWording: { 'privileged-access': 'Will they get admin rights to our systems?' },
  });
  check('the determination — which feeds the chat, the form and the record — carries the wording',
    determination.residualQuestions.some((q) => q.question === 'Will they get admin rights to our systems?'));
  const page = readFileSync(new URL('../../src/features/admin/service-description-page.tsx', import.meta.url), 'utf8');
  check('the Service description tab edits it', /id=\{`sd-risk-\$\{id\}`\}/.test(page) && /placeholder=\{RESIDUAL_QUESTION_TEXT\[id\]\}/.test(page));
}

console.log(failures === 0 ? '\n\x1b[32mAll checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
