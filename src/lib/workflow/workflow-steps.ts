// Routing-step lifecycle composition (INT-11 / item 7+11).
//
// The Routing step is a PRESENTATION of config-driven outputs — it holds no
// policy of its own. The workflow lifecycle shown to the requester comes from
// the admin Workflow Designer template attached to the request (its `stage`
// nodes), with two determination-driven steps overlaid: a Risk assessment when
// the determination says one is required, and Vendor onboarding when the
// supplier is new/incomplete. Both are skipped if the template already carries
// an equivalent node, so an admin who models them stays authoritative.
//
// Pure + deterministic (no React, no literals beyond the cosmetic owner labels).
// Mirrored by tests/integration/workflow-steps.mjs.

/** A workflow template node (subset — only what the preview reads). */
export interface TemplateNode {
  type: string;
  label: string;
}

/** Determination signals that overlay conditional steps onto the lifecycle. */
export interface WorkflowSignals {
  riskAssessmentRequired: boolean;
  supplierOnboardingRequired: boolean;
}

/** A composed lifecycle step, ready for <WorkflowPreview>. */
export interface WorkflowStepView {
  key: string;
  label: string;
  /** Responsible function — a cosmetic subtitle, not an approver assignment. */
  owner: string;
  parallel?: boolean;
}

/**
 * Map a lifecycle stage label to the function that owns it. This is presentation
 * only — the steps themselves come from the admin template; this just supplies a
 * human subtitle so the preview never shows the opaque "System" owner again.
 */
const STAGE_OWNER: { match: RegExp; owner: string }[] = [
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

function ownerForStage(label: string): string {
  return STAGE_OWNER.find((s) => s.match.test(label))?.owner ?? 'Procurement';
}

const RISK_STEP: WorkflowStepView = {
  key: 'risk-assessment',
  label: 'Risk assessment',
  owner: 'Third-party risk',
};
const ONBOARDING_STEP: WorkflowStepView = {
  key: 'vendor-onboarding',
  label: 'Vendor onboarding',
  owner: 'Vendor management',
};

// Only `stage` nodes are real lifecycle steps; start/end/error/decision/parallel
// are structural canvas nodes and are not shown as steps.
const STEP_NODE_TYPES = new Set(['stage']);

/** Does this node's label name the risk stage? */
const isRiskLabel = (label: string) => /risk|sra|assessment/i.test(label);
/** Does this node's label name the vendor-onboarding stage? */
const isOnboardingLabel = (label: string) => /onboard/i.test(label);

/**
 * Compose the lifecycle steps for the Routing preview from a template's nodes
 * plus the determination signals.
 *
 * Two directions, both driven by the same signal. Where a template does NOT
 * model a risk or onboarding node, a synthetic step is inserted before the first
 * approval stage so the preview still tells the requester it is coming. Where a
 * template DOES model one — WF-001 gained a real Risk Assessment node — the node
 * is dropped when the signal says it will not run, because the engine's
 * conditional edge is going to skip it and a preview that shows it anyway
 * promises a step that never happens.
 */
export function composeWorkflowSteps(
  nodes: TemplateNode[],
  signals: WorkflowSignals,
): WorkflowStepView[] {
  const steps: WorkflowStepView[] = nodes
    .filter((n) => STEP_NODE_TYPES.has(n.type))
    // The template's own risk node is conditional at runtime; mirror that here.
    .filter((n) => signals.riskAssessmentRequired || !isRiskLabel(n.label))
    // Same for onboarding: WF-001 now models it as a real node behind a
    // conditional edge, so a preview that showed it regardless would promise a
    // stage the engine is about to skip — the exact fault R4 fixed for risk.
    .filter((n) => signals.supplierOnboardingRequired || !isOnboardingLabel(n.label))
    .map((n, i) => ({ key: `t${i}-${n.label}`, label: n.label, owner: ownerForStage(n.label) }));

  const hasRisk = steps.some((s) => isRiskLabel(s.label));
  const hasOnboarding = steps.some((s) => isOnboardingLabel(s.label));

  const inserts: WorkflowStepView[] = [];
  if (signals.riskAssessmentRequired && !hasRisk) inserts.push(RISK_STEP);
  if (signals.supplierOnboardingRequired && !hasOnboarding) inserts.push(ONBOARDING_STEP);
  if (inserts.length === 0) return steps;

  let idx = steps.findIndex((s) => /approv/i.test(s.label));
  if (idx === -1) idx = steps.findIndex((s) => /sourc|contract|\bpo\b|purchase order/i.test(s.label));
  if (idx === -1) idx = steps.length;

  return [...steps.slice(0, idx), ...inserts, ...steps.slice(idx)];
}


// The regex band parser lived here. It read a string with no number in it as
// [0, Infinity), so an unbanded chain matched every value and shadowed every
// banded one behind it. Bands are structured now — see approval-bands.ts —
// and `selectChainForValue` skips a chain it cannot place, because "we do not
// know what this applies to" is not a licence to apply to everything.
export { selectChainForValue as selectApprovalChainForValue } from './approval-bands.js';
