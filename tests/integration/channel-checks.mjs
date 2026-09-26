#!/usr/bin/env node
// The Channel page's "Checks": what a requester is told before they submit.
//
// lib/procurement/channel-checks.ts turns the object submit records — the
// intake determination, or the governed decision for a call-off — into verdicts
// with reasons. It replaced the Review step's fifteen cards. This drives it
// with REAL determinations and decisions, not hand-built ones, and holds the
// things that matter: every line is read from that object, a check that did not
// run is never shown as clear, and nothing addressed to an administrator
// reaches the person submitting.
//
// Run: npm run test:channel-checks
import { evaluateIntakeDetermination } from '../../src/lib/procurement/intake-determination.ts';
import { evaluateGovernedCheckout } from '../../src/lib/procurement/governed-checkout.ts';
import { requestChecks, callOffChecks, approvalsCheck } from '../../src/lib/procurement/channel-checks.ts';
import { routingRules } from '../../src/data/routing-rules.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const supplier = (id, overrides = {}) => ({
  id, name: `Supplier ${id}`, country: 'Germany', countryCode: 'DE', riskRating: 'low',
  activeContracts: 1, totalSpend12m: 250000, onboardingStatus: 'completed',
  sraStatus: 'valid', sraExpiryDate: '2027-01-01', screeningStatus: 'clear',
  categories: ['consulting'], tier: 2, duns: '123456789', address: '1 Example Street',
  primaryContact: 'A. Contact', primaryContactEmail: 'contact@example.com',
  certifications: [], spendHistory: [], performanceScore: 80, ...overrides,
});
const chain = (id, minValue, maxValue) => ({ id, name: id, threshold: '', description: '', steps: [], referencedBy: [], minValue, maxValue });
const determine = (overrides = {}) => evaluateIntakeDetermination({
  category: 'consulting', estimatedValue: 180000, supplierId: '', isUrgent: false,
  requestTitle: 'Finance transformation', serviceDescription: { objective: 'Redesign record-to-report' },
  miniIrq: { privilegedAccess: false, criticalService: false }, now: '2026-09-26',
  suppliers: [supplier('SUP-1')], contracts: [], matchingRiskAssessments: [], routingRules,
  approvalChains: [chain('AC-LOW', null, '100000'), chain('AC-HIGH', '100000', null)],
  validatorAgent: { name: 'Request Validator', status: 'active' },
  policyConfig: DEFAULT_POLICY_CONFIG,
  ...overrides,
});
const base = { approvers: null, missingSections: [], supplierPreferred: null, overrideNeedsApproval: false, sourcingInvites: null };
const verdicts = (checks) => checks.map((c) => c.verdict);

console.log('Why this channel, in the words of the rule that chose it');
{
  const d = determine();
  const checks = requestChecks({ ...base, determination: d });
  check('the first line is the channel, with the matched rule\'s own description',
    checks[0].verdict === d.buyingChannelResult && checks[0].reason === d.matchedRuleDescription && Boolean(d.matchedRuleDescription),
    JSON.stringify(checks[0]));
  const noRule = requestChecks({ ...base, determination: { ...d, matchedRuleName: undefined, matchedRuleDescription: undefined } });
  check('with no rule matched it says the value band decided', /value band decided/.test(noRule[0].reason));
}

console.log('\nA check that did not run is never shown as clear');
{
  const off = determine({ validatorAgent: { name: 'Request Validator', status: 'disabled' } });
  const checks = requestChecks({ ...base, determination: off });
  const text = JSON.stringify(checks);
  check('a switched-off validator says the policy checks did not run', verdicts(checks).includes('Policy checks did not run'));
  check('…in the requester\'s terms, not the admin instruction the determination records',
    !/Admin|Enable it/.test(text) && /Enable it in Admin/.test(JSON.stringify(off.policyChecks)));
  check('approvers still loading give no line, rather than "No approval needed"',
    !verdicts(checks).some((v) => /approval/i.test(v)));
  check('an empty chain says no approval is needed', approvalsCheck([])?.verdict === 'No approval needed');
}

console.log('\nWhat ran is reported, failures and all');
{
  const d = determine();
  const failed = d.policyChecks.filter((c) => !c.passed).map((c) => c.label);
  const checks = requestChecks({ ...base, determination: d });
  check('every failed policy check is listed', failed.length > 0 && failed.every((label) => verdicts(checks).includes(label)), failed.join(', '));
  check('a passed one is not — it is in the workings', d.policyChecks.filter((c) => c.passed).every((c) => !verdicts(checks).includes(c.label)));
  const missing = requestChecks({ ...base, determination: d, missingSections: ['Scope', 'Acceptance Criteria'] });
  check('missing required sections are named, and submitting stays possible',
    missing.some((c) => /lacks 2 required sections/.test(c.verdict) && /Scope, Acceptance Criteria/.test(c.reason) && /still submit/.test(c.reason)));
  check('reasons read as sentences', checks.every((c) => /^[A-Z€0-9]/.test(c.reason) && /[.!?]$/.test(c.reason)),
    checks.map((c) => c.reason).find((r) => !/^[A-Z€0-9]/.test(r) || !/[.!?]$/.test(r)));
}

console.log('\nRisk, as a conclusion');
{
  const needed = determine({ supplierId: '' });
  check('with no supplier an assessment is needed, and says why',
    requestChecks({ ...base, determination: needed }).some((c) => c.verdict === 'Risk assessment needed' && c.reason.length > 0));
  const reused = determine({
    supplierId: 'SUP-1',
    matchingRiskAssessments: [{ id: 'RA-1', title: 'Supplier SUP-1 assessment', subjectType: 'supplier', supplierId: 'SUP-1', category: 'operational', riskLevel: 'low', score: 1, status: 'completed', assessorId: 'u', assessorName: 'Risk', assessedAt: '2026-01-01', validUntil: '2027-06-01', summary: '', mitigations: [], reusable: true, linkedRequestIds: [] }],
  });
  check('an assessment that covers it reads as reused, with its date',
    requestChecks({ ...base, determination: reused }).some((c) => c.verdict === 'Risk assessment reused' && /2027-06-01/.test(c.reason)));
}

console.log('\nSuppliers: who sourcing invites, or why a choice needs a reason');
{
  const d = determine();
  const invited = requestChecks({ ...base, determination: d, sourcingInvites: { total: 3, preferred: 2 } });
  check('the invitation list is counted, with the preferred ones', invited.some((c) => c.verdict === '3 suppliers invited to sourcing' && /Including 2 preferred suppliers/.test(c.reason)));
  const nobody = requestChecks({ ...base, determination: d, sourcingInvites: { total: 0, preferred: 0 } });
  check('nobody invited is not a finding — the Supplier section says who chooses', !nobody.some((c) => /invited/i.test(c.verdict)));
  const override = requestChecks({ ...base, determination: d, supplierPreferred: false, overrideNeedsApproval: true });
  check('a supplier outside the list says the category manager approves, when the thresholds say so',
    override.some((c) => c.verdict === 'Supplier outside the preferred list' && /category manager approves/.test(c.reason)));
  const noApproval = requestChecks({ ...base, determination: d, supplierPreferred: false, overrideNeedsApproval: false });
  check('…and does not claim it when they do not', noApproval.some((c) => c.verdict === 'Supplier outside the preferred list' && !/category manager/.test(c.reason)));
}

console.log('\nApprovers: the ones submit writes, in order');
{
  const line = approvalsCheck([
    { stepOrder: 2, role: 'Category Manager', assignmentMode: 'role', approverId: null, approverName: 'Category Manager — A or B', delegatedTo: null },
    { stepOrder: 1, role: 'Budget Owner', assignmentMode: 'person', approverId: 'u1', approverName: 'Sofia Ricci', delegatedTo: null },
  ]);
  check('ordered by step, a person with their role, a role entry as it names itself',
    line?.verdict === '2 approvals, in order' && line.reason === 'Sofia Ricci (Budget Owner), then Category Manager — A or B.', line?.reason);
}

console.log('\nA call-off, from its governed decision');
{
  const sup = supplier('SUP-1');
  const contract = { id: 'CON-1', title: 'Advisory framework', supplierId: 'SUP-1', supplierName: 'Supplier SUP-1', value: 100000, startDate: '2025-01-01', endDate: '2027-12-31', status: 'active', ownerId: 'u1', ownerName: 'Owner', department: 'Procurement', category: 'Services', renewalDate: '2027-10-01', utilisationPercentage: 10, linkedRequestIds: [] };
  const risk = { id: 'RISK-1', title: 'Supplier risk', subjectType: 'supplier', supplierId: 'SUP-1', contractId: 'CON-1', category: 'operational', riskLevel: 'low', score: 1, status: 'completed', assessorId: 'u2', assessorName: 'Risk', assessedAt: '2026-01-01', validUntil: '2027-06-01', summary: '', mitigations: [], reusable: true, linkedRequestIds: [] };
  const decide = (unitPrice, riskAssessment = risk) => evaluateGovernedCheckout({
    route: 'contract-call-off', supplier: sup, contract, riskAssessment, purpose: 'Advisory days',
    profile: { userId: 'u1', defaultCurrency: 'EUR', costCentre: 'CC-1', approvedShipToLocations: [], defaultShipToLocationId: 'office' },
    lines: [{ description: 'Advisory days', quantity: 1, unit: 'service', unitPrice, supplierId: 'SUP-1', contractId: 'CON-1', commodityCode: '80101500' }],
    activeCostCentreIds: ['CC-1'], activeDeliveryLocationIds: ['office'], now: new Date('2026-09-26'),
  });
  const input = (decision, approvers = null) => ({
    decision, approvers, contract: { title: contract.title, supplierName: contract.supplierName, endDate: '31 Dec 2027' },
    riskAssessment: { title: risk.title, validUntil: '1 Jun 2027' },
    directCallOffLimit: DEFAULT_POLICY_CONFIG.directCallOffLimit, autoApprovalThreshold: DEFAULT_POLICY_CONFIG.catalogueAutoApprovalThreshold,
  });
  const auto = callOffChecks(input(decide(800)));
  check('auto-approved: no approval, and the purchase order is raised on submit',
    auto.some((c) => c.verdict === 'No approval needed' && /raised when you submit/.test(c.reason)));
  check('the contract and the call-off limit are stated', verdicts(auto).includes('The contract can be called off') && verdicts(auto).includes('Within the direct call-off limit'));
  const over = callOffChecks(input(decide(5000), [{ stepOrder: 1, role: 'Contract Owner', assignmentMode: 'person', approverId: 'u1', approverName: 'Owner', delegatedTo: null }]));
  check('over the threshold: the approvers submit will ask', over.some((c) => c.verdict === 'One approval' && /Owner \(Contract Owner\)/.test(c.reason)));
  const expired = callOffChecks(input(decide(5000, { ...risk, validUntil: '2026-01-01' })));
  check('an expired assessment means a risk review first', verdicts(expired).includes('Risk review first'));
  const beyond = callOffChecks(input(decide(95000)));
  check('beyond the contract, it is amended first', verdicts(beyond).includes('The contract is amended first'));
  const refused = { ...decide(800), ok: false, errors: ['the delivery location is not active'] };
  check('a refused decision says it cannot be placed, and why',
    callOffChecks(input(refused)).some((c) => c.tone === 'stop' && c.reason === 'The delivery location is not active.'));
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All channel-checks checks passed.');
