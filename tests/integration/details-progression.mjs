#!/usr/bin/env node
// The Details step reveals one thing at a time, and the reveal agrees with the gate.
//
// The step used to render everything at once — requester context, the
// service-description conversation, a card of risk switches, and supplier
// selection — all on screen before the requester had answered anything.
//
// The rule is deliberately trivial so it cannot drift: section N+1 is revealed
// exactly when section N is complete, and the last section's completion IS
// `canProceed('details')`. This suite asserts that identity by calling both.

import assert from 'node:assert/strict';
import { detailsSections, descriptionComplete } from '../../src/features/requests/new-request/details-sections.ts';
import { stepById } from '../../src/features/requests/new-request/intake-steps.ts';
import { resolveSlots } from '../../src/lib/procurement/demand-conversation.ts';
import { riskSlotsFor } from '../../src/lib/procurement/residual-question-slots.ts';
import { INITIAL_INTAKE_DATA } from '../../src/features/requests/new-request/intake-form-data.ts';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

const RISK = riskSlotsFor([
  { id: 'privileged-access', field: 'privilegedAccess', question: 'Does this engagement grant privileged or system access?', reason: 'consulting engagements often involve system access' },
]);
const SLOTS = [...resolveSlots(), ...RISK];

const ctx = (over = {}) => ({
  category: 'consulting',
  title: 'Target operating model design',
  estimatedValue: 250_000,
  deliveryDate: '2027-01-15',
  sow: {
    objective: 'Design a target operating model', scope: 'Assessment, design, roadmap',
    exclusions: 'Implementation', deliverables: 'Report, model, roadmap',
    resources: 'Partner plus three consultants', timeline: 'Twelve weeks',
    acceptanceCriteria: 'Steering-group sign-off', pricingModel: 'Fixed price',
    dependencies: 'Finance availability',
  },
  ...over,
});
const input = (over = {}) => ({ isChatIntakePath: true, conversationCtx: ctx(over.ctx), conversationSlots: SLOTS, ...over.rest });

console.log('\nSections reveal in sequence');

check('on arrival, only the requester summary and the conversation are on screen', () => {
  const sections = detailsSections(input({ ctx: { sow: {}, title: undefined, estimatedValue: undefined } }));
  assert.deepEqual(sections.map((section) => [section.id, section.revealed]),
    [['requester', true], ['description', true], ['supplier', false]]);
});

check('supplier appears only once the conversation is finished', () => {
  const unanswered = detailsSections(input({ ctx: { risk: {} } }));
  assert.equal(unanswered.find((section) => section.id === 'supplier').revealed, false);
  const answered = detailsSections(input({ ctx: { risk: { privilegedAccess: false } } }));
  assert.equal(answered.find((section) => section.id === 'supplier').revealed, true);
});

check('each section is revealed exactly when the previous one is complete', () => {
  for (const risk of [{}, { privilegedAccess: true }]) {
    const sections = detailsSections(input({ ctx: { risk } }));
    for (let i = 1; i < sections.length; i++) {
      assert.equal(sections[i].revealed, sections[i - 1].complete,
        `${sections[i].id} reveal disagrees with ${sections[i - 1].id} completion`);
    }
  }
});

console.log('\nThe reveal and the step gate are the same predicate');

const gate = (over = {}) => stepById('details').canProceed({
  data: { ...INITIAL_INTAKE_DATA, preCheckOutcome: 'full-request', category: 'consulting' },
  isChatIntakePath: true,
  conversationCtx: ctx(over),
  conversationSlots: SLOTS,
  hasDetermination: true,
});

check('the last section completing IS canProceed', () => {
  for (const risk of [undefined, {}, { privilegedAccess: false }, { privilegedAccess: true }]) {
    const described = descriptionComplete(input({ ctx: { risk } }));
    assert.equal(gate({ risk }), described, `disagreement for risk=${JSON.stringify(risk)}`);
  }
});

// The floor is a fixed id list, so it cannot see a per-demand risk question.
// Without the agenda check, Next opened with a triggered question unanswered.
// The agenda also carries OPTIONAL slots, and the conversation drops one the
// requester could not answer. Gating on an empty agenda made a declined
// optional question block the step, with the chat saying "that's everything I
// need" while Next stayed disabled and nothing explained why.
check('a declined optional question does not block Next', () => {
  const withoutDate = ctx();
  delete withoutDate.deliveryDate;
  assert.equal(gate({ ...withoutDate, risk: { privilegedAccess: false } }), true);
});

check('a triggered risk question blocks Next', () => {
  assert.equal(gate({ risk: {} }), false);
  assert.equal(gate({ risk: { privilegedAccess: false } }), true);
});

check('answering no unblocks it, exactly as answering yes does', () => {
  assert.equal(gate({ risk: { privilegedAccess: false } }), true);
  assert.equal(gate({ risk: { privilegedAccess: true } }), true);
});

console.log('\nThe other routes are untouched');

check('the catalogue route gates on its cart, not on a conversation', () => {
  const step = stepById('details');
  assert.equal(step.canProceed({
    data: { ...INITIAL_INTAKE_DATA, preCheckOutcome: 'catalogue', catalogueItems: [] },
    isChatIntakePath: false, conversationCtx: ctx(), conversationSlots: SLOTS, hasDetermination: true,
  }), false);
  assert.equal(step.canProceed({
    data: { ...INITIAL_INTAKE_DATA, preCheckOutcome: 'catalogue', catalogueItems: [{ itemId: 'X', name: 'X', quantity: 1 }] },
    isChatIntakePath: false, conversationCtx: ctx(), conversationSlots: SLOTS, hasDetermination: true,
  }), true);
});

check('the form paths keep their title-and-value gate', () => {
  const step = stepById('details');
  const formData = { ...INITIAL_INTAKE_DATA, preCheckOutcome: 'full-request', category: 'contract-renewal' };
  assert.equal(step.canProceed({
    data: formData, isChatIntakePath: false, conversationCtx: ctx(), conversationSlots: SLOTS, hasDetermination: true,
  }), false);
  assert.equal(step.canProceed({
    data: { ...formData, title: 'Renewal', estimatedValue: 1000 },
    isChatIntakePath: false, conversationCtx: ctx(), conversationSlots: SLOTS, hasDetermination: true,
  }), true);
});

console.log(failures === 0
  ? '\nAll details-progression checks passed.'
  : `\n${failures} details-progression check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
