#!/usr/bin/env node
// Verifies the Routing-step lifecycle composition + approval-chain banding.
//
// Band selection is IMPORTED; the lifecycle composition below is still
// mirrored. This file carried a copy of the regex band parser that read a
// string with no number in it as [0, Infinity) — the shadowing bug — so the
// mirror would have gone on asserting the broken behaviour after the real
// parser was deleted.
// Run: npm run test:workflow-steps
import { selectChainForValue } from '../../src/lib/workflow/approval-bands.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── Mirror of workflow-steps.ts ─────────────────────────────────────
const STAGE_OWNER = [
  { match: /intake|submit|request/i, owner: 'Requester' },
  { match: /validat/i, owner: 'Category Manager' },
  { match: /approv/i, owner: 'Approver' },
  { match: /sourc|rfp|benchmark|negotiat/i, owner: 'Procurement' },
  { match: /contract/i, owner: 'Legal' },
  { match: /\bpo\b|purchase order/i, owner: 'Procurement Ops' },
  { match: /receipt|goods received/i, owner: 'Requester' },
  { match: /invoice/i, owner: 'Accounts Payable' },
  { match: /payment/i, owner: 'Finance' },
];
const ownerForStage = (label) => STAGE_OWNER.find((s) => s.match.test(label))?.owner ?? 'Procurement';
const RISK_STEP = { key: 'risk-assessment', label: 'Risk assessment', owner: 'Third-party risk' };
const ONBOARDING_STEP = { key: 'vendor-onboarding', label: 'Vendor onboarding', owner: 'Vendor management' };
const STEP_NODE_TYPES = new Set(['stage']);

function composeWorkflowSteps(nodes, signals) {
  const steps = nodes
    .filter((n) => STEP_NODE_TYPES.has(n.type))
    .map((n, i) => ({ key: `t${i}-${n.label}`, label: n.label, owner: ownerForStage(n.label) }));
  const hasRisk = steps.some((s) => /risk|sra|assessment/i.test(s.label));
  const hasOnboarding = steps.some((s) => /onboard/i.test(s.label));
  const inserts = [];
  if (signals.riskAssessmentRequired && !hasRisk) inserts.push(RISK_STEP);
  if (signals.supplierOnboardingRequired && !hasOnboarding) inserts.push(ONBOARDING_STEP);
  if (inserts.length === 0) return steps;
  let idx = steps.findIndex((s) => /approv/i.test(s.label));
  if (idx === -1) idx = steps.findIndex((s) => /sourc|contract|\bpo\b|purchase order/i.test(s.label));
  if (idx === -1) idx = steps.length;
  return [...steps.slice(0, idx), ...inserts, ...steps.slice(idx)];
}


// ── Fixtures — the real seed templates (WF-001 standard, WF-003 onboarding) ──
const labels = (steps) => steps.map((s) => s.label);
const WF001_NODES = [
  { type: 'start', label: 'Request Submitted' },
  { type: 'stage', label: 'Intake' },
  { type: 'stage', label: 'Validation' },
  { type: 'decision', label: 'Auto-Route' },
  { type: 'stage', label: 'Approval' },
  { type: 'stage', label: 'Sourcing' },
  { type: 'stage', label: 'Contracting' },
  { type: 'stage', label: 'PO Creation' },
  { type: 'stage', label: 'Receipt' },
  { type: 'stage', label: 'Invoice' },
  { type: 'stage', label: 'Payment' },
  { type: 'end', label: 'Completed' },
  { type: 'error', label: 'Referred Back' },
];
const WF003_NODES = [
  { type: 'start', label: 'Onboarding Request' },
  { type: 'stage', label: 'Initial Review' },
  { type: 'stage', label: 'Due Diligence' },
  { type: 'parallel', label: 'Parallel Checks' },
  { type: 'stage', label: 'SRA Assessment' },
  { type: 'decision', label: 'Risk Decision' },
  { type: 'stage', label: 'Compliance Approval' },
  { type: 'end', label: 'Active Supplier' },
];

console.log('Lifecycle composition');

// 1. Structural nodes (start/end/error/decision/parallel) are dropped — only stages.
const base = composeWorkflowSteps(WF001_NODES, { riskAssessmentRequired: false, supplierOnboardingRequired: false });
check('only stage nodes become steps (start/end/decision/error dropped)',
  labels(base).join('|') === ['Intake', 'Validation', 'Approval', 'Sourcing', 'Contracting', 'PO Creation', 'Receipt', 'Invoice', 'Payment'].join('|'),
  labels(base).join('|'));
check('both flags false → template stages unchanged', base.length === 9);
check('owner subtitle derives from the stage (no opaque "System")',
  base[0].owner === 'Requester' && base.find((s) => s.label === 'Approval').owner === 'Approver');

// 2. Risk-assessment-required inserts a Risk step before Approval, once.
const risk = composeWorkflowSteps(WF001_NODES, { riskAssessmentRequired: true, supplierOnboardingRequired: false });
check('riskAssessmentRequired inserts a Risk assessment step', labels(risk).includes('Risk assessment'));
check('Risk assessment is placed before Approval',
  labels(risk).indexOf('Risk assessment') < labels(risk).indexOf('Approval'));
check('Risk assessment not duplicated (single insert)',
  labels(risk).filter((l) => l === 'Risk assessment').length === 1);
check('Vendor onboarding NOT added when its flag is false', !labels(risk).includes('Vendor onboarding'));

// 3. Onboarding-required inserts a Vendor onboarding step before Approval.
const onb = composeWorkflowSteps(WF001_NODES, { riskAssessmentRequired: false, supplierOnboardingRequired: true });
check('supplierOnboardingRequired inserts a Vendor onboarding step', labels(onb).includes('Vendor onboarding'));
check('Vendor onboarding is placed before Approval',
  labels(onb).indexOf('Vendor onboarding') < labels(onb).indexOf('Approval'));

// 4. Both flags → both inserted, Risk before Onboarding, both before Approval.
const both = composeWorkflowSteps(WF001_NODES, { riskAssessmentRequired: true, supplierOnboardingRequired: true });
check('both flags → both steps present', labels(both).includes('Risk assessment') && labels(both).includes('Vendor onboarding'));
check('insertion order: Risk assessment → Vendor onboarding → Approval',
  labels(both).indexOf('Risk assessment') < labels(both).indexOf('Vendor onboarding')
  && labels(both).indexOf('Vendor onboarding') < labels(both).indexOf('Approval'));
check('exactly two steps added over the base', both.length === base.length + 2);

// 5. Template that already models risk (WF-003 "SRA Assessment") → no duplicate.
const wf3 = composeWorkflowSteps(WF003_NODES, { riskAssessmentRequired: true, supplierOnboardingRequired: false });
check('template carrying an SRA node is not given a duplicate Risk assessment',
  !labels(wf3).includes('Risk assessment') && labels(wf3).includes('SRA Assessment'));

// 6. No approval stage → conditional steps fall back before sourcing/contract/PO.
const noApproval = composeWorkflowSteps(
  [{ type: 'stage', label: 'Intake' }, { type: 'stage', label: 'Sourcing' }, { type: 'stage', label: 'PO Creation' }],
  { riskAssessmentRequired: true, supplierOnboardingRequired: false },
);
check('no approval stage → Risk assessment inserted before Sourcing',
  labels(noApproval).indexOf('Risk assessment') < labels(noApproval).indexOf('Sourcing'));

console.log('\nApproval-chain value banding');
const CHAINS = [
  { id: 'chain-2', name: 'Fast-Track', minValue: null, maxValue: '10000' },
  { id: 'chain-1', name: 'Standard', minValue: '10000', maxValue: 'policy:budgetApprovalThreshold' },
  { id: 'chain-3', name: 'VP-Level', minValue: 'policy:budgetApprovalThreshold', maxValue: 'policy:delegatedAuthorityThreshold' },
  { id: 'chain-4', name: 'Board-Level', minValue: 'policy:delegatedAuthorityThreshold', maxValue: null },
];
const bandFor = (v) => selectChainForValue(CHAINS, v, DEFAULT_POLICY_CONFIG)?.name;
check('€5k → Fast-Track', bandFor(5_000) === 'Fast-Track');
check('€50k → Standard', bandFor(50_000) === 'Standard');
check('€150k → VP-Level (promptathon demand)', bandFor(150_000) === 'VP-Level');
check('€750k → Board-Level', bandFor(750_000) === 'Board-Level');
check('boundary €100k lands in the higher band (VP-Level)', bandFor(100_000) === 'VP-Level');
check('boundary €10k lands in the higher band (Standard)', bandFor(10_000) === 'Standard');
// The bug the parser had: no band must never mean "every value".
check('a chain with no band is skipped, not treated as [0, ∞)',
  selectChainForValue([{ id: 'x', name: 'Unbanded' }, ...CHAINS], 150_000, DEFAULT_POLICY_CONFIG)?.name === 'VP-Level');

// The template is no longer chosen by category. That rule gave the standard
// procurement template to nearly every category, and submit preferred it over
// the channel's template, so a business-led request would have run the
// procurement-led lifecycle. The channel decides it (intake-submit.ts).
console.log('\nThe template follows the channel, not the category');
{
  const { readFileSync } = await import('node:fs');
  const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
  check('no category-based template selection remains',
    !/selectWorkflowTemplateForCategory/.test(read('src/lib/workflow/workflow-steps.ts') + read('src/features/requests/new-request/use-intake-determination.ts')));
  const submit = read('api/_domains/intake-submit.ts');
  check('submit takes the template that claims the channel, never the browser\u2019s',
    /const templateId = templateForChannel\(templates, buyingChannel\) \|\| null;/.test(submit) && !/payload\.workflowTemplateId/.test(submit));
  const page = read('src/features/requests/new-request/new-request-page.tsx');
  check('the call-off does not start a second workflow instance in the browser', !/initWorkflow\(/.test(page));
  check('Review previews the channel\u2019s template', /templateForChannel\(workflowTemplates, determination\?\.buyingChannelSlug\)/.test(page));
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All workflow-steps checks passed.');
