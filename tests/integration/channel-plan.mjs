#!/usr/bin/env node
// The Channel page's "Step by step" is the workflow's own answer.
//
// lib/workflow/channel-plan.ts says, before a request is submitted, which of its
// channel template's stages will run, which might, and which will not. It is
// worth something only if it agrees with the two things that actually move the
// request: where the server LANDS it (firstActionableStage for intake,
// checkoutEntryStage for a call-off) and how the engine WALKS it from there
// (getNextNodeIds). The Review step's preview disagreed with both — it overlaid
// risk and onboarding from flags and chose its own approval chain.
//
// So this drives the plan over the shipped templates (seed = live, per
// test:seed-parity) for every combination of the signals, checks the entry
// rules' declared conditions against real decisions, and pins the words.
//
// Run: npm run test:channel-plan
import { workflowTemplates } from '../../src/data/workflows.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import {
  planChannel, applicabilityTag, applyCountLabel, stagesInGraphOrder,
} from '../../src/lib/workflow/channel-plan.ts';
import {
  channelStageMapFromTemplates, firstActionableStage, templateForChannel, INTAKE_ENTRY_CONDITIONS,
} from '../../src/lib/workflow/channel-stages.ts';
import {
  evaluateGovernedCheckout, checkoutEntryStage, CHECKOUT_ENTRY_CONDITIONS,
} from '../../src/lib/procurement/governed-checkout.ts';
import { edgeConditionHolds } from '../../src/lib/workflow/edge-conditions.ts';
import { nodeToStatus } from '../../src/lib/workflow/node-config.ts';

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const CONFIG = DEFAULT_POLICY_CONFIG;
const map = channelStageMapFromTemplates(workflowTemplates);
const templateFor = (channel) => workflowTemplates.find((t) => t.id === templateForChannel(workflowTemplates, channel));
const labels = (template) => stagesInGraphOrder(template).map((n) => n.label);
const tags = (plan) => Object.fromEntries(plan.stages.map((s) => [s.node.label, applicabilityTag(s.applicability, CONFIG)]));
const holds = (condition, ctx) => edgeConditionHolds({ condition }, ctx, CONFIG);

/** The plan for a full request, landed by the intake writer's own rule. */
function intakePlan(channel, context, unknown = []) {
  return planChannel(templateFor(channel), {
    entryStage: firstActionableStage(map, channel, { riskAssessmentRequired: context.riskRequired === true }),
    entryConditions: INTAKE_ENTRY_CONDITIONS,
    context,
    unknown,
  }, CONFIG);
}

console.log('Stages are listed in the order the graph reaches them');
check('procurement-led: onboarding after risk, before approval — not authoring or breadth-first order',
  JSON.stringify(labels(templateFor('procurement-led'))) === JSON.stringify([
    'Intake', 'Validation', 'Risk Assessment', 'Vendor Onboarding', 'Approval', 'Sourcing',
    'Contracting', 'PO Creation', 'Receipt', 'Invoice', 'Payment',
  ]), labels(templateFor('procurement-led')).join(' → '));
check('business-led: contracting after approval, as its graph says',
  JSON.stringify(labels(templateFor('business-led'))) === JSON.stringify([
    'Intake', 'Risk Assessment', 'Vendor Onboarding', 'Approval', 'Contracting', 'PO Creation',
    'Receipt', 'Invoice', 'Payment',
  ]), labels(templateFor('business-led')).join(' → '));
check('call-off: contracting, then risk, then approval',
  JSON.stringify(labels(templateFor('framework-call-off')).slice(0, 4)) === JSON.stringify([
    'Intake', 'Contracting', 'Risk Assessment', 'Approval',
  ]), labels(templateFor('framework-call-off')).join(' → '));
check('Referred Back is where a request waits, not a stage of the channel',
  !workflowTemplates.some((t) => labels(t).includes('Referred Back')));

console.log('\nProcurement-led, no risk assessment, supplier known and set up');
{
  const plan = intakePlan('procurement-led', { value: 180000, category: 'consulting', riskRequired: false, onboardingRequired: false });
  const t = tags(plan);
  check('the requester is at intake', t.Intake === 'You are here');
  check('it enters at validation — the intake writer\'s own landing', plan.entry?.status === 'validation');
  check('risk is skipped by the branch that did not hold', t['Risk Assessment'] === 'Skipped · no risk assessment needed', t['Risk Assessment']);
  check('onboarding is skipped because it only follows risk', t['Vendor Onboarding'] === 'Skipped · only after Risk Assessment', t['Vendor Onboarding']);
  check('the stages that simply run carry no tag', t.Validation === null && t.Sourcing === null && t.Payment === null);
  check('9 of 11 apply', applyCountLabel(plan) === '9 of 11', applyCountLabel(plan));
  check('the target is the sum of the running stages\' SLAs', plan.targetDays === 1 + 3 + 5 + 20 + 10 + 2 + 5 + 5 + 3, String(plan.targetDays));
}

console.log('\nProcurement-led, risk required, no supplier chosen yet');
{
  const plan = intakePlan('procurement-led', { value: 180000, category: 'consulting', riskRequired: true }, ['onboardingRequired']);
  const t = tags(plan);
  check('risk applies, and says why', t['Risk Assessment'] === 'Applies · risk assessment required', t['Risk Assessment']);
  check('onboarding is conditional on a signal nobody knows yet — in the branch\'s own words',
    t['Vendor Onboarding'] === 'If the supplier is new', t['Vendor Onboarding']);
  check('approval runs either way, and is not tagged with the branch one path took', t.Approval === null, t.Approval);
  check('"10+ of 11" — more may run', applyCountLabel(plan) === '10+ of 11', applyCountLabel(plan));
  check('a conditional stage does not count toward the target', plan.targetDays === 1 + 3 + 7 + 5 + 20 + 10 + 2 + 5 + 5 + 3, String(plan.targetDays));
}

console.log('\nProcurement-led, risk required, a new supplier chosen');
{
  const t = tags(intakePlan('procurement-led', { value: 180000, category: 'consulting', riskRequired: true, onboardingRequired: true }));
  check('onboarding applies, because the supplier is new', t['Vendor Onboarding'] === 'Applies · new supplier', t['Vendor Onboarding']);
}

console.log('\nBusiness-led lands past risk when none is needed');
{
  // WF-006's graph goes Intake → Risk Assessment unconditionally. The server
  // lands the request at Approval anyway (firstActionableStage), so a plan
  // walked from the start would promise a risk assessment that never happens.
  const plan = intakePlan('business-led', { value: 38000, category: 'facilities', riskRequired: false, onboardingRequired: false });
  const t = tags(plan);
  check('it enters at approval', plan.entry?.status === 'approval', plan.entry?.status);
  check('risk is skipped for the reason the entry rule declares', t['Risk Assessment'] === 'Skipped · no risk assessment needed', t['Risk Assessment']);
  check('onboarding, reachable only through risk, is skipped with it', t['Vendor Onboarding'] === 'Skipped · only after Risk Assessment', t['Vendor Onboarding']);
  check('contracting runs — the business agrees terms before the PO', t.Contracting === null);
  const reused = applicabilityTag(plan.stages.find((s) => s.node.label === 'Risk Assessment').applicability, CONFIG, { riskReused: true });
  check('an existing assessment reads as reused, not as unnecessary', reused === 'Skipped · existing assessment reused', reused);
}
{
  const plan = intakePlan('business-led', { value: 38000, category: 'facilities', riskRequired: true }, ['onboardingRequired']);
  check('with risk required it enters at risk, and the tag says why',
    plan.entry?.status === 'risk' && tags(plan)['Risk Assessment'] === 'Applies · risk assessment required', tags(plan)['Risk Assessment']);
}

console.log('\nThe intake entry rule and its declared conditions agree');
for (const channel of ['procurement-led', 'business-led']) {
  const order = labels(templateFor(channel)).map(nodeToStatus);
  for (const riskRequired of [true, false]) {
    const ctx = { riskRequired };
    const entry = firstActionableStage(map, channel, { riskAssessmentRequired: riskRequired });
    const jumped = order.slice(1, order.indexOf(entry));
    const wrong = jumped.filter((stage) => INTAKE_ENTRY_CONDITIONS[stage] && holds(INTAKE_ENTRY_CONDITIONS[stage], ctx));
    const entryCondition = INTAKE_ENTRY_CONDITIONS[entry];
    check(`${channel}, risk ${riskRequired ? 'required' : 'not required'}: every jumped stage's condition fails, the entry's holds`,
      wrong.length === 0 && (!entryCondition || holds(entryCondition, ctx)), `entry ${entry}; jumped ${jumped.join(', ')}`);
  }
}

console.log('\nA call-off, from real governed decisions');
const supplier = { id: 'SUP-1', name: 'Example Supplier', riskRating: 'low', screeningStatus: 'clear' };
const contract = { id: 'CON-1', title: 'Advisory framework', supplierId: 'SUP-1', supplierName: 'Example Supplier', value: 100000, startDate: '2025-01-01', endDate: '2027-12-31', status: 'active', ownerId: 'u1', ownerName: 'Owner', department: 'Procurement', category: 'Services', renewalDate: '2027-10-01', utilisationPercentage: 10, linkedRequestIds: [] };
const profile = { userId: 'u1', defaultCurrency: 'EUR', costCentre: 'CC-1', approvedShipToLocations: [], defaultShipToLocationId: 'office' };
const risk = { id: 'RISK-1', title: 'Supplier risk', subjectType: 'supplier', supplierId: 'SUP-1', contractId: 'CON-1', category: 'operational', riskLevel: 'low', score: 1, status: 'completed', assessorId: 'u2', assessorName: 'Risk', assessedAt: '2026-01-01', validUntil: '2027-06-01', summary: '', mitigations: [], reusable: true, linkedRequestIds: [] };
const decide = (unitPrice, riskAssessment = risk) => evaluateGovernedCheckout({
  route: 'contract-call-off', supplier, contract, riskAssessment, profile, purpose: 'Advisory call-off',
  lines: [{ description: 'Advisory days', quantity: 1, unit: 'service', unitPrice, supplierId: 'SUP-1', contractId: 'CON-1', commodityCode: '80101500' }],
  activeCostCentreIds: ['CC-1'], activeDeliveryLocationIds: ['office'], now: new Date('2026-09-26'),
});
const cases = {
  'auto-approved': decide(800),
  'over the threshold': decide(5000),
  'expired assessment': decide(5000, { ...risk, validUntil: '2026-01-01' }),
  'beyond the contract': decide(95000),
};
check('the fixtures reach all four entries',
  JSON.stringify(Object.values(cases).map((d) => checkoutEntryStage('contract-call-off', d.status)))
    === JSON.stringify(['po', 'approval', 'risk', 'contracting']),
  Object.values(cases).map((d) => d.status).join(', '));
const callOffPlan = (decision) => planChannel(templateFor('framework-call-off'), {
  entryStage: checkoutEntryStage('contract-call-off', decision.status),
  entryConditions: CHECKOUT_ENTRY_CONDITIONS,
  context: {
    value: decision.totalValue, riskRequired: decision.riskReviewRequired,
    contractAmendmentRequired: decision.contractAmendmentRequired, onboardingRequired: false,
  },
}, CONFIG);
{
  const t = tags(callOffPlan(cases['auto-approved']));
  check('auto-approved: the purchase order is raised straight away, and each jumped stage says why',
    t.Contracting === 'Skipped · contract used as it stands'
      && t['Risk Assessment'] === 'Skipped · no risk assessment needed'
      && t.Approval === 'Skipped · up to €1,000',
    JSON.stringify(t));
}
{
  const plan = callOffPlan(cases['over the threshold']);
  check('over the threshold: approval applies, because of the value', tags(plan).Approval === 'Applies · over €1,000', tags(plan).Approval);
  const raised = { ...CONFIG, catalogueAutoApprovalThreshold: 2500 };
  const approval = planChannel(templateFor('framework-call-off'), {
    entryStage: 'approval', entryConditions: CHECKOUT_ENTRY_CONDITIONS,
    context: { value: 5000, riskRequired: false, contractAmendmentRequired: false, onboardingRequired: false },
  }, raised).stages.find((s) => s.node.label === 'Approval');
  check('the threshold is the governed one, not a figure in the plan',
    applicabilityTag(approval.applicability, raised) === 'Applies · over €2,500', applicabilityTag(approval.applicability, raised));
}
{
  const t = tags(callOffPlan(cases['beyond the contract']));
  check('beyond the contract: contracting applies first', t.Contracting === 'Applies · contract amended first', t.Contracting);
}
console.log('\nThe checkout entry rule and its declared conditions agree');
const offOrder = labels(templateFor('framework-call-off')).map(nodeToStatus);
for (const [name, decision] of Object.entries(cases)) {
  const ctx = { value: decision.totalValue, riskRequired: decision.riskReviewRequired, contractAmendmentRequired: decision.contractAmendmentRequired };
  const entry = checkoutEntryStage('contract-call-off', decision.status);
  const jumped = offOrder.slice(1, offOrder.indexOf(entry));
  const wrong = jumped.filter((stage) => !CHECKOUT_ENTRY_CONDITIONS[stage] || holds(CHECKOUT_ENTRY_CONDITIONS[stage], ctx));
  const entryCondition = CHECKOUT_ENTRY_CONDITIONS[entry];
  check(`${name}: every jumped stage's condition fails, the entry's holds`,
    wrong.length === 0 && (!entryCondition || holds(entryCondition, ctx)), `entry ${entry}; wrong ${wrong.join(', ')}`);
}

console.log('\nNo stage is skipped without a reason');
for (const template of workflowTemplates.filter((t) => (t.channels ?? []).some((c) => c !== 'catalogue'))) {
  const channel = template.channels[0];
  const bare = [];
  for (const riskRequired of [true, false]) {
    for (const onboardingRequired of [true, false, undefined]) {
      const plan = channel === 'framework-call-off'
        ? callOffPlan({ ...cases['over the threshold'], riskReviewRequired: riskRequired })
        : intakePlan(channel, { value: 50000, riskRequired, onboardingRequired }, onboardingRequired === undefined ? ['onboardingRequired'] : []);
      for (const stage of plan.stages) {
        if (applicabilityTag(stage.applicability, CONFIG) === 'Skipped') bare.push(`${stage.node.label} (risk ${riskRequired}, onboarding ${onboardingRequired})`);
      }
    }
  }
  check(`${template.id}: every skipped stage says why`, bare.length === 0, bare.join('; '));
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All channel-plan checks passed.');
