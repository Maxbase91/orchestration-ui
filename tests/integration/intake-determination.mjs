#!/usr/bin/env node
// The determination, pinned.
//
// Channel, risk tier, whether a risk assessment is required, what the
// compliance record will say — the most consequential answers the front door
// produces. Until now they lived in a `useMemo` inside a wizard step, reachable
// only by mounting React, so nothing tested them and only one of the two
// experience densities ever ran them.
//
// This suite exists to make three properties checkable:
//
//   1. **Determinism.** `now` is an input. The same demand twice is the same
//      answer, today and next March.
//   2. **Honesty.** A check that did not run is never recorded as passed. The
//      duplicate search does not exist, so `duplicateCheck` stays null; the
//      validator can be disabled, and then the policy checks say so rather
//      than coming back empty (which reads as "all clear").
//   3. **One derivation.** The channel on the determination is the channel
//      `resolveDemandChannel` gives for the same inputs — not a second opinion.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateIntakeDetermination } from '../../src/lib/procurement/intake-determination.ts';
import { resolveDemandChannel } from '../../src/lib/routing/demand-channel.js';
import { routingRules } from '../../src/data/routing-rules.ts';

const NOW = '2026-09-01';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

// ── Fixtures ────────────────────────────────────────────────────────────────

const supplier = (id, overrides = {}) => ({
  id,
  name: `Supplier ${id}`,
  country: 'Germany',
  countryCode: 'DE',
  riskRating: 'low',
  activeContracts: 1,
  totalSpend12m: 250000,
  onboardingStatus: 'completed',
  sraStatus: 'valid',
  sraExpiryDate: '2027-01-01',
  screeningStatus: 'clear',
  categories: ['services'],
  tier: 2,
  duns: '123456789',
  address: '1 Example Street',
  primaryContact: 'A. Contact',
  primaryContactEmail: 'contact@example.com',
  certifications: [],
  spendHistory: [],
  performanceScore: 80,
  ...overrides,
});

const SUPPLIERS = [
  supplier('SUP-OK'),
  supplier('SUP-EXPIRED', { sraStatus: 'expired', sraExpiryDate: '2026-01-01' }),
  supplier('SUP-UNASSESSED', { sraStatus: 'not-assessed', sraExpiryDate: undefined }),
  supplier('SUP-FLAGGED', { screeningStatus: 'flagged' }),
];

// `threshold` is a human-readable band string; `parseThresholdBand` reads the
// numbers out of it. The shape matters — a chain without one throws.
const chain = (id, name, threshold) => ({
  id, name, threshold, description: '', steps: [], referencedBy: [],
});
const APPROVAL_CHAINS = [
  chain('AC-001', 'Standard', '< €50,000'),
  chain('AC-002', 'Senior', '€50,000 - €250,000'),
  chain('AC-003', 'Executive', '> €250,000'),
];

const ACTIVE_VALIDATOR = { name: 'Request Validator', status: 'active' };

const reusableAssessment = {
  id: 'RA-1',
  title: 'Acme security assessment',
  subjectType: 'supplier',
  category: 'security',
  riskLevel: 'medium',
  score: 42,
  status: 'completed',
  assessor: 'Risk team',
  validUntil: '2027-06-30',
  summary: 'Cleared',
  mitigations: [],
  reusable: true,
  assessedDataClass: 'internal',
  linkedRequestIds: [],
};

/** A demand, with only what the case cares about spelled out. */
const demand = (overrides = {}) => ({
  category: 'services',
  estimatedValue: 8000,
  supplierId: 'SUP-OK',
  isUrgent: false,
  requestTitle: 'Cleaning services for the Berlin site',
  serviceDescription: { objective: 'Weekly office cleaning', scope: 'One site' },
  miniIrq: { privilegedAccess: false, criticalService: false },
  now: NOW,
  suppliers: SUPPLIERS,
  contracts: [],
  matchingRiskAssessments: [],
  routingRules,
  approvalChains: APPROVAL_CHAINS,
  validatorAgent: ACTIVE_VALIDATOR,
  ...overrides,
});

// The labelled set every property below is asserted across.
const CASES = {
  'goods, low value': demand({ category: 'goods', estimatedValue: 8000 }),
  'software with personal data': demand({
    category: 'software',
    estimatedValue: 30000,
    serviceDescription: { objective: 'CRM licences', scope: 'Stores customer personal data' },
  }),
  'material consulting': demand({
    category: 'consulting',
    estimatedValue: 400000,
    serviceDescription: { objective: 'Operating model review', scope: 'Group-wide' },
  }),
  'urgent services': demand({ isUrgent: true }),
  'supplier with an expired SRA': demand({ supplierId: 'SUP-EXPIRED' }),
  'supplier with a reusable assessment': demand({ matchingRiskAssessments: [reusableAssessment] }),
  'flagged supplier': demand({ supplierId: 'SUP-FLAGGED' }),
  'no supplier chosen yet': demand({ supplierId: '' }),
  'privileged access to critical service': demand({
    miniIrq: { privilegedAccess: true, criticalService: true },
  }),
};

const everyCase = (label, assertOne) => {
  check(label, () => {
    for (const [name, input] of Object.entries(CASES)) {
      try {
        assertOne(evaluateIntakeDetermination(input), input, name);
      } catch (error) {
        throw new Error(`${name}: ${error.message}`);
      }
    }
  });
};

// ── Determinism ─────────────────────────────────────────────────────────────

console.log('\nThe same demand is the same determination');

everyCase('evaluating twice gives an identical result', (first, input) => {
  assert.deepEqual(first, evaluateIntakeDetermination(input));
});

everyCase('the answer does not move with the calendar', (today, input) => {
  const marchNextYear = evaluateIntakeDetermination({ ...input, now: '2027-03-14' });
  // Reuse and the second-contract check read `now` legitimately; the channel,
  // the risk tier and the policy checks must not drift with the date.
  assert.equal(today.buyingChannelSlug, marchNextYear.buyingChannelSlug);
  assert.equal(today.inherentRisk.tier, marchNextYear.inherentRisk.tier);
  assert.deepEqual(today.policyChecks, marchNextYear.policyChecks);
});

// ── Honesty ─────────────────────────────────────────────────────────────────

console.log('\nA check that did not run is never recorded as passed');

everyCase('no duplicate search exists, so none is claimed', (result) => {
  assert.equal(result.duplicateCheck, null);
});

everyCase('the SRA line reflects the supplier record, never a guess', (result, input) => {
  const supplierRec = SUPPLIERS.find((s) => s.id === input.supplierId);
  if (!supplierRec) {
    assert.equal(result.supplierSraStatus, undefined);
    assert.match(result.sraStatus, /will be initiated/i);
    return;
  }
  assert.equal(result.supplierSraStatus, supplierRec.sraStatus);
  assert.ok(result.sraStatus.includes(supplierRec.sraStatus));
});

check('a disabled validator says so instead of returning no findings', () => {
  const result = evaluateIntakeDetermination(
    demand({ validatorAgent: { name: 'Request Validator', status: 'disabled' } }),
  );
  assert.equal(result.policyChecks.length, 1);
  assert.equal(result.policyChecks[0].passed, false);
  assert.match(result.policyChecks[0].detail, /currently disabled/i);
  assert.equal(result.validatorAgentStatus, 'disabled');
});

check('an absent validator is reported as missing, not as clear', () => {
  const result = evaluateIntakeDetermination(demand({ validatorAgent: undefined }));
  assert.equal(result.validatorAgentStatus, 'missing');
  assert.equal(result.policyChecks.some((c) => c.passed), false);
});

check('an unassessed supplier does not produce a passing SRA check', () => {
  const result = evaluateIntakeDetermination(demand({ supplierId: 'SUP-UNASSESSED' }));
  const sra = result.policyChecks.find((c) => c.label === 'SRA assessment valid');
  assert.equal(sra.passed, false);
});

// ── One derivation ──────────────────────────────────────────────────────────

console.log('\nThe channel is resolved once, not re-derived');

everyCase('the determination channel equals resolveDemandChannel for the same inputs', (result, input) => {
  const direct = resolveDemandChannel(input.routingRules, {
    category: input.category,
    value: input.estimatedValue,
    supplierId: input.supplierId,
    contractId: input.contractId,
    isUrgent: input.isUrgent,
    riskRating: result.inherentRisk.tier,
    material: result.materiality.material,
    pCardEligible: result.pCardEligible,
  });
  assert.equal(result.buyingChannelSlug, direct.channel);
});

everyCase('a chain is selected for every demand', (result) => {
  assert.ok(APPROVAL_CHAINS.some((c) => c.id === result.approvalChain));
});

// ── The decisions themselves ────────────────────────────────────────────────

console.log('\nThe risk read behaves as the policy describes');

check('privileged access to a critical service raises the inherent tier', () => {
  const calm = evaluateIntakeDetermination(demand());
  const exposed = evaluateIntakeDetermination(
    demand({ miniIrq: { privilegedAccess: true, criticalService: true } }),
  );
  const order = ['low', 'medium', 'high', 'critical'];
  assert.ok(
    order.indexOf(exposed.inherentRisk.tier) > order.indexOf(calm.inherentRisk.tier),
    `expected a raised tier, got ${calm.inherentRisk.tier} → ${exposed.inherentRisk.tier}`,
  );
});

check('a reusable assessment removes the need for a new one', () => {
  const withReuse = evaluateIntakeDetermination(demand({ matchingRiskAssessments: [reusableAssessment] }));
  assert.equal(withReuse.riskAssessmentRequired, false);
  assert.equal(withReuse.matchingRiskAssessments.length, 1);
  assert.ok(withReuse.policyChecks.some((c) => c.label === 'Risk assessment reuse' && c.passed));
});

check('a flagged supplier blocks the demand', () => {
  const result = evaluateIntakeDetermination(demand({ supplierId: 'SUP-FLAGGED' }));
  assert.equal(result.screening.blocking, true);
  assert.equal(result.referral.outcome, 'refer-back');
});

check('a demand with no title or value is referred back, not routed on', () => {
  const result = evaluateIntakeDetermination(demand({ requestTitle: '', estimatedValue: 0 }));
  assert.notEqual(result.referral.outcome, 'proceed');
});

check('no supplier means onboarding is required', () => {
  const result = evaluateIntakeDetermination(demand({ supplierId: '' }));
  assert.equal(result.supplierOnboardingRequired, true);
});

// ── Layering ────────────────────────────────────────────────────────────────

console.log('\nThe determination is pure, and knows nothing about the UI');

check('no density or mode parameter reaches the decision', () => {
  const source = readFileSync(new URL('../../src/lib/procurement/intake-determination.ts', import.meta.url), 'utf8');
  // Comments legitimately discuss the two densities; code must not branch on
  // them. Strip comments, then look for the identifiers.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
  assert.equal(/\b(density|experienceMode)\b/.test(code), false, 'a density parameter leaked into the determination');
  assert.equal(/['"]simple['"]|['"]expert['"]/.test(code), false, 'a mode literal leaked into the determination');
});

check('it imports no React and nothing from the feature layer', () => {
  const source = readFileSync(new URL('../../src/lib/procurement/intake-determination.ts', import.meta.url), 'utf8');
  assert.equal(/from ['"]react['"]/.test(source), false);
  assert.equal(/@\/features\//.test(source), false);
});

console.log('\nWhat the risk questionnaire established is recorded, including silence');

// Both answers used to default to `false`, so a question nobody put and a
// question answered in the negative produced the same determination and the
// same compliance record. A reader could not tell which had happened, which is
// the unearned evidence this codebase forbids.
check('an unanswered question is reported as not-answered, never as no', () => {
  const result = evaluateIntakeDetermination(demand({
    category: 'consulting', estimatedValue: 400_000, miniIrq: {},
  }));
  assert.ok(result.riskQuestionnaire.length > 0, 'this demand should trigger questions');
  for (const entry of result.riskQuestionnaire) assert.equal(entry.answer, 'not-answered');
});

check('answering no is distinguishable from not answering', () => {
  const answered = evaluateIntakeDetermination(demand({
    category: 'consulting', estimatedValue: 400_000,
    miniIrq: { privilegedAccess: false, criticalService: false },
  }));
  assert.deepEqual(answered.riskQuestionnaire.map((entry) => entry.answer), ['no', 'no']);
});

check('every triggered question appears in the record, with its rationale', () => {
  const result = evaluateIntakeDetermination(demand({ category: 'consulting', estimatedValue: 400_000 }));
  assert.deepEqual(
    result.riskQuestionnaire.map((entry) => entry.id).sort(),
    result.residualQuestions.map((question) => question.id).sort(),
  );
  for (const entry of result.riskQuestionnaire) assert.ok(entry.reason.trim().length > 0);
});

// Unanswered must behave exactly as the old `false` default did, or this change
// would silently re-tier every existing demand.
check('an unanswered questionnaire determines the same as an explicit no', () => {
  const strip = (result) => ({ ...result, riskQuestionnaire: undefined });
  assert.deepEqual(
    strip(evaluateIntakeDetermination(demand({ miniIrq: {} }))),
    strip(evaluateIntakeDetermination(demand({ miniIrq: { privilegedAccess: false, criticalService: false } }))),
  );
});

// A stale answer used to keep driving the determination after its question
// stopped applying: say yes to critical-service at a material value, then drop
// the value, and materiality stayed critical with nothing on screen to explain it.
check('an answer to a question this demand no longer asks is ignored', () => {
  const small = evaluateIntakeDetermination(demand({
    category: 'goods', estimatedValue: 500, miniIrq: { criticalService: true },
  }));
  const clean = evaluateIntakeDetermination(demand({ category: 'goods', estimatedValue: 500, miniIrq: {} }));
  assert.ok(!small.residualQuestions.some((question) => question.field === 'criticalService'),
    'this demand should not be asked the critical-service question');
  assert.deepEqual(small.materiality, clean.materiality);
  assert.ok(!small.riskQuestionnaire.some((entry) => entry.id === 'critical-service'));
});

console.log(
  failures === 0
    ? '\nAll intake-determination checks passed.'
    : `\n${failures} intake-determination check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
