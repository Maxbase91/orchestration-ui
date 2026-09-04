#!/usr/bin/env node
// A request must never carry a compliance check it did not run.
//
// Simple-mode intake persisted, on every submission:
//   sraCheck: { status: 'pass', detail: 'Automated checks will continue…' }
//   duplicateCheck: { found: false, detail: 'No duplicate demand detected at intake.' }
// Neither check runs on that path. A reviewer opening the request saw a passed
// supplier-risk screen and a clean duplicate search as stored governance
// evidence — the most damaging failure available to this codebase, because
// unlike a crash it is invisible and it is believed.
//
// It was a source check, because the values were literals in two submit
// payloads. They are not any more: `buildIntakeComplianceRecord` derives the
// record from the determination's structured fields, so the honesty properties
// can be asserted by *calling* the builder over a labelled set of demands.
// Behavioural assertions survive a rewording; greps do not.
//
// The source checks that remain are the ones that must stay source checks: the
// record type has to be able to express "not run", and the reviewer's screen
// has to render that differently from "checked, nothing found".

import { readFileSync } from 'node:fs';
import {
  buildIntakeComplianceRecord,
  buildUndeterminedComplianceRecord,
} from '../../src/lib/procurement/intake-compliance-record.ts';
import { evaluateIntakeDetermination } from '../../src/lib/procurement/intake-determination.ts';
import { routingRules } from '../../src/data/routing-rules.ts';
import { buyingChannelLabel } from '../../src/lib/routing/evaluate-routing-rules.js';

const ROOT = new URL('../../', import.meta.url);
// Comments are stripped before scanning: a comment that quotes the old literal
// (explaining why it is gone) must not read as the literal still being there.
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(path, ROOT), 'utf8'));

const TYPES = read('src/data/request-compliance.ts');
const TAB = read('src/features/requests/request-detail/tab-compliance.tsx');
const PAYMENTS = read('src/features/purchasing/payment-tracker-page.tsx');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};

console.log('\nThe record can express a check that did not run');
check("sraCheck has a 'not-run' status distinct from 'not-applicable'",
  /'not-run'/.test(TYPES) && /'not-applicable'/.test(TYPES));
check('duplicateCheck records whether a search was performed',
  /performed\?: boolean/.test(TYPES));

// ── Fixtures ────────────────────────────────────────────────────────────────

const supplier = (id, overrides = {}) => ({
  id, name: `Supplier ${id}`, country: 'Germany', countryCode: 'DE', riskRating: 'low',
  activeContracts: 1, totalSpend12m: 250000, onboardingStatus: 'completed',
  sraStatus: 'valid', sraExpiryDate: '2027-01-01', screeningStatus: 'clear',
  categories: ['services'], tier: 2, duns: '123456789', address: '1 Example Street',
  primaryContact: 'A. Contact', primaryContactEmail: 'contact@example.com',
  certifications: [], spendHistory: [], performanceScore: 80, ...overrides,
});
const SUPPLIERS = [
  supplier('SUP-VALID'),
  supplier('SUP-EXPIRING', { sraStatus: 'expiring', sraExpiryDate: '2026-10-01' }),
  supplier('SUP-EXPIRED', { sraStatus: 'expired', sraExpiryDate: '2026-01-01' }),
  supplier('SUP-UNASSESSED', { sraStatus: 'not-assessed', sraExpiryDate: undefined }),
];
const chain = (id, threshold) => ({ id, name: id, threshold, description: '', steps: [], referencedBy: [] });
const APPROVAL_CHAINS = [chain('AC-001', '< €50,000'), chain('AC-002', '> €50,000')];

const determinationFor = (overrides = {}) => evaluateIntakeDetermination({
  category: 'services', estimatedValue: 8000, supplierId: 'SUP-VALID', isUrgent: false,
  requestTitle: 'Cleaning services', serviceDescription: { objective: 'Weekly cleaning' },
  miniIrq: { privilegedAccess: false, criticalService: false }, now: '2026-09-01',
  suppliers: SUPPLIERS, contracts: [], matchingRiskAssessments: [], routingRules,
  approvalChains: APPROVAL_CHAINS, validatorAgent: { name: 'Request Validator', status: 'active' },
  ...overrides,
});
const recordFor = (overrides = {}) =>
  buildIntakeComplianceRecord(determinationFor(overrides), { determinedAt: '2026-09-01T00:00:00Z' });

console.log('\nNo record claims a duplicate search that never ran');
// Expert used to write `found: false, detail: 'No duplicate demand detected at
// intake.'` — a sentence describing a search that has never existed.
for (const [name, overrides] of Object.entries({
  'a plain demand': {},
  'a high-value demand': { estimatedValue: 400000 },
  'a demand with no supplier': { supplierId: '' },
})) {
  const record = recordFor(overrides);
  check(`${name}: the duplicate search is recorded as not performed`,
    record.duplicateCheck.performed === false, JSON.stringify(record.duplicateCheck));
  check(`${name}: no record says a duplicate demand was not detected`,
    !/No duplicate demand detected/.test(record.duplicateCheck.detail), record.duplicateCheck.detail);
}

console.log('\nThe SRA outcome comes from the supplier record, not a rendered label');
// Expert derived this with `formData.sraStatus.includes('expired')`, so a
// never-assessed supplier — whose label contains neither 'expired' nor
// 'expiring' — recorded a PASS for an assessment that did not exist.
const SRA_EXPECTATIONS = {
  'SUP-VALID': 'pass',
  'SUP-EXPIRING': 'warning',
  'SUP-EXPIRED': 'fail',
  'SUP-UNASSESSED': 'fail',
};
for (const [supplierId, expected] of Object.entries(SRA_EXPECTATIONS)) {
  const record = recordFor({ supplierId });
  check(`${supplierId} records sraCheck '${expected}'`,
    record.sraCheck.status === expected, `got '${record.sraCheck.status}'`);
}
check('no supplier records not-applicable rather than a pass',
  recordFor({ supplierId: '' }).sraCheck.status === 'not-applicable');

console.log('\nA disabled validator produces findings, not silence');
// An empty policyChecks array reads to a reviewer as "all clear".
const unvalidated = recordFor({ validatorAgent: { name: 'Request Validator', status: 'disabled' } });
check('the disabled validator is reported as a failed check',
  unvalidated.policyChecks.length === 1 && unvalidated.policyChecks[0].passed === false);

console.log('\nAn intake with no determination asserts nothing at all');
const undetermined = buildUndeterminedComplianceRecord({
  determinedAt: '2026-09-01T00:00:00Z', channel: 'direct-po', label: 'Direct PO',
});
check('its SRA check is not-run', undetermined.sraCheck.status === 'not-run');
check('its duplicate search is not performed', undetermined.duplicateCheck.performed === false);
check('it claims no policy checks', undetermined.policyChecks.length === 0);
check('it flags no risks it did not assess', undetermined.riskFlags.length === 0);

console.log('\nThe reviewer can see the difference');
check('a not-run SRA is not styled as a warning',
  /'not-run' \?/.test(TAB) || /status === 'not-run'/.test(TAB));
check('an unperformed duplicate search does not render as "No duplicates"',
  /performed === false/.test(TAB) && /Not checked/.test(TAB));

console.log('\nA simulated action says so where the user can see it');
// The disclaimer used to live only in a source header and a module README. The
// buttons write a real status and a real paidDate and move the "Paid" KPI, so a
// finance user had no way to tell this apart from a real payment release.
check('the screen carries an internal-tracker notice',
  /Internal tracker only/.test(PAYMENTS));
check('the notice says no upstream system is contacted',
  /no upstream payment or banking system is[\s\S]{0,20}contacted/.test(PAYMENTS));
check('the confirmation toasts say no payment was sent',
  (PAYMENTS.match(/no payment sent/g) ?? []).length >= 2);

console.log('\nOne route decides both the recorded channel and its copy');
// Three surfaces used to disagree: the recommendation card read the channel,
// while the review and confirmation screens read a route state that was never
// set to p-card or direct-po. Now the label is derived from the slug by the
// same function the screens call, so the record cannot name one channel and
// display another — asserted by comparing them rather than by grepping for the
// expression that happens to produce them today.
for (const [name, overrides] of Object.entries({
  'a low-value demand': { estimatedValue: 3000 },
  'a high-value demand': { estimatedValue: 400000 },
  'an urgent demand': { isUrgent: true },
})) {
  const record = recordFor(overrides);
  check(`${name}: the recorded label matches the recorded channel`,
    record.buyingChannel.label === buyingChannelLabel(record.buyingChannel.channel),
    `${record.buyingChannel.channel} → "${record.buyingChannel.label}"`);
  check(`${name}: the reasoning names the rule that decided it`,
    /routing rule|value-band fallback/.test(record.buyingChannel.reasoning),
    record.buyingChannel.reasoning);
}

// There is one page and one recorded channel, so the three surfaces that used
// to disagree cannot: the confirmation reads the same determination the record
// was built from.
const INTAKE = read('src/features/requests/new-request/new-request-page.tsx');
check('the confirmation screen reads the determined channel, not a separate route state',
  /buyingChannelResult: determination\?\.buyingChannelResult/.test(INTAKE));

// ── The risk questionnaire, in the record ──────────────────────────────────
// Both answers used to default to `false`, so the record could not distinguish
// a question answered in the negative from one nobody ever put. `risk_flags` is
// already TEXT[], so carrying the distinction needs no schema change.
{
  const triggered = { category: 'consulting', estimatedValue: 400_000 };
  const silent = recordFor({ ...triggered, miniIrq: {} });
  const answered = recordFor({ ...triggered, miniIrq: { privilegedAccess: false, criticalService: false } });
  const yes = recordFor({ ...triggered, miniIrq: { privilegedAccess: true, criticalService: true } });

  check('an unanswered risk question is recorded as not-answered',
    silent.riskFlags.some((flag) => /^risk-question:.*=not-answered$/.test(flag)));
  check('it never records an unanswered question as a negative answer',
    !silent.riskFlags.some((flag) => /^risk-question:.*=no$/.test(flag)));
  check('a negative answer IS recorded, and distinguishably',
    answered.riskFlags.some((flag) => /^risk-question:.*=no$/.test(flag))
    && !answered.riskFlags.some((flag) => /=not-answered$/.test(flag)));
  check('a positive answer is recorded as such',
    yes.riskFlags.some((flag) => /^risk-question:.*=yes$/.test(flag)));
  // The flags mirror the triggered set exactly — no more, no fewer. A record
  // carrying a question this demand was never asked is as wrong as one omitting
  // a question it was.
  const smallDemand = determinationFor({ category: 'goods', estimatedValue: 500 });
  const smallRecord = buildIntakeComplianceRecord(smallDemand, { determinedAt: '2026-09-01T00:00:00Z' });
  const recordedIds = smallRecord.riskFlags
    .filter((flag) => flag.startsWith('risk-question:'))
    .map((flag) => flag.slice('risk-question:'.length).split('=')[0]).sort();
  check('the recorded questions are exactly the ones this demand triggered',
    JSON.stringify(recordedIds) === JSON.stringify(smallDemand.residualQuestions.map((q) => q.id).sort()),
    `recorded=${recordedIds.join(',')} triggered=${smallDemand.residualQuestions.map((q) => q.id).join(',')}`);
}

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All intake-evidence checks passed.');
process.exit(failures === 0 ? 0 : 1);
