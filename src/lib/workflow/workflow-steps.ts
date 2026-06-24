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

/**
 * Compose the lifecycle steps for the Routing preview from a template's nodes
 * plus the determination signals. Conditional Risk assessment / Vendor
 * onboarding steps are inserted before the first approval stage (falling back to
 * the first sourcing/contracting/PO stage, then the end) and are never
 * duplicated when the template already models that node.
 */
export function composeWorkflowSteps(
  nodes: TemplateNode[],
  signals: WorkflowSignals,
): WorkflowStepView[] {
  const steps: WorkflowStepView[] = nodes
    .filter((n) => STEP_NODE_TYPES.has(n.type))
    .map((n, i) => ({ key: `t${i}-${n.label}`, label: n.label, owner: ownerForStage(n.label) }));

  const hasRisk = steps.some((s) => /risk|sra|assessment/i.test(s.label));
  const hasOnboarding = steps.some((s) => /onboard/i.test(s.label));

  const inserts: WorkflowStepView[] = [];
  if (signals.riskAssessmentRequired && !hasRisk) inserts.push(RISK_STEP);
  if (signals.supplierOnboardingRequired && !hasOnboarding) inserts.push(ONBOARDING_STEP);
  if (inserts.length === 0) return steps;

  let idx = steps.findIndex((s) => /approv/i.test(s.label));
  if (idx === -1) idx = steps.findIndex((s) => /sourc|contract|\bpo\b|purchase order/i.test(s.label));
  if (idx === -1) idx = steps.length;

  return [...steps.slice(0, idx), ...inserts, ...steps.slice(idx)];
}

/** Parse an approval-chain threshold string ("< 10,000", "10,000 - 100,000",
 *  "> 500,000") into a numeric [min, max) band. Reads the admin's own value,
 *  no thresholds are baked in here. */
export function parseThresholdBand(threshold: string): { min: number; max: number } {
  const nums = (threshold.match(/[\d,]+(?:\.\d+)?/g) ?? [])
    .map((s) => Number(s.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return { min: 0, max: Infinity };
  if (/</.test(threshold) && nums.length === 1) return { min: 0, max: nums[0] };
  if (/>/.test(threshold) && nums.length === 1) return { min: nums[0], max: Infinity };
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  return { min: nums[0], max: Infinity };
}

/** Select the approval chain whose value band contains `value`. */
export function selectApprovalChainForValue<T extends { threshold: string }>(
  chains: T[],
  value: number,
): T | undefined {
  return chains.find((c) => {
    const { min, max } = parseThresholdBand(c.threshold);
    return value >= min && value < max;
  });
}
