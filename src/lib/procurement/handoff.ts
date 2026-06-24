// Downstream handoff steps for the determination endpoint.
//
// Derives the structured "next steps" from a determination — each step with its
// target system, status, and an in-app deep-link. This is the R1 boundary: the
// front door routes (deep-links) and never writes upstream. Includes the
// detailed-assessment handoff (no front-door capture — the assessment is routed
// to the risk register). Standardised: generic functional system labels, no
// organisation- or product-specific names.

import type { BuyingChannel } from '@/data/types';

export type HandoffStatus = 'required' | 'recommended' | 'not-required';

export interface HandoffStep {
  key: string;
  label: string;
  /** Generic functional system the step is routed to. */
  system: string;
  status: HandoffStatus;
  detail: string;
  /** In-app route the user is deep-linked to (omitted when not-required). */
  deepLink?: string;
}

export interface HandoffInput {
  channel: BuyingChannel;
  riskOutcome: 'reuse' | 'amend' | 'change' | 'new' | 'no-match';
  material: boolean;
  /** The selected supplier's master data is incomplete (RTE-04). */
  supplierDataIssue?: boolean;
}

const PO_CHANNELS: BuyingChannel[] = ['catalogue', 'direct-po', 'framework-call-off'];

/** Build the ordered list of downstream handoff steps for a determination. */
export function buildHandoffSteps(input: HandoffInput): HandoffStep[] {
  const steps: HandoffStep[] = [];

  // 0. Supplier master-data remediation — a prerequisite when the selected
  //    supplier isn't fully onboarded / has stale records (RTE-04).
  if (input.supplierDataIssue) {
    steps.push({
      key: 'supplier-data',
      label: 'Resolve supplier master data',
      system: 'Supplier management',
      status: 'required',
      detail: 'The selected supplier’s master data is incomplete — complete onboarding / refresh records before proceeding.',
      deepLink: '/suppliers/onboarding',
    });
  }

  // 1. Detailed risk assessment — routed to the risk register, not captured in
  //    the front door. Reuse → not required; delta → recommended; else required.
  const riskStatus: HandoffStatus =
    input.riskOutcome === 'reuse' ? 'not-required'
      : input.riskOutcome === 'amend' ? 'recommended'
        : 'required';
  steps.push({
    key: 'risk-assessment',
    label:
      input.riskOutcome === 'reuse' ? 'Risk assessment — reuse existing'
        : input.riskOutcome === 'amend' ? 'Risk assessment — delta'
          : 'Detailed risk assessment',
    system: 'Third-party risk register',
    status: riskStatus,
    detail:
      input.riskOutcome === 'reuse' ? 'A valid assessment already covers this engagement.'
        : input.riskOutcome === 'amend' ? 'A delta reassessment is needed against the existing one.'
          : 'A full assessment is required; routed to the risk register (no front-door capture).',
    deepLink: riskStatus === 'not-required' ? undefined : '/suppliers/risk',
  });

  // 2. Heightened approval + regulatory register, when material.
  if (input.material) {
    steps.push({
      key: 'materiality-governance',
      label: 'Heightened approval & regulatory register',
      system: 'Governance',
      status: 'required',
      detail: 'Material demand — the added approval chain and a regulatory register entry apply.',
      deepLink: '/approvals',
    });
  }

  // 3. Sourcing event, for the sourcing channels.
  if (input.channel === 'procurement-led' || input.channel === 'business-led') {
    steps.push({
      key: 'sourcing',
      label: 'Sourcing event',
      system: 'Sourcing',
      status: input.channel === 'procurement-led' ? 'required' : 'recommended',
      detail: input.channel === 'procurement-led'
        ? 'A procurement-led sourcing event is required.'
        : 'Business-led — a lightweight competition is recommended.',
      deepLink: '/sourcing/new',
    });
  }

  // 4. Contract.
  if (input.channel === 'framework-call-off') {
    steps.push({ key: 'contract', label: 'Contract call-off', system: 'Contract management', status: 'required', detail: 'Call off against the existing framework or contract.', deepLink: '/contracts' });
  } else if (input.channel === 'procurement-led') {
    steps.push({ key: 'contract', label: 'New contract', system: 'Contract management', status: 'required', detail: 'A new contract is authored from the sourcing outcome.', deepLink: '/contracts' });
  }

  // 5. Purchasing — raise the requisition.
  const poNow = PO_CHANNELS.includes(input.channel);
  steps.push({
    key: 'purchasing',
    label: 'Raise purchase requisition',
    system: 'Purchasing',
    status: poNow ? 'required' : 'recommended',
    detail: poNow
      ? 'Raise the requisition to convert to a purchase order.'
      : 'The requisition follows once sourcing/contract completes.',
    deepLink: '/purchasing/orders',
  });

  return steps;
}
