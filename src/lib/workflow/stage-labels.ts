// What a lifecycle stage is called, in one place.
//
// This map existed four times — the lifecycle stepper, the workflow tab, the
// SLA targets page and the Form Builder — with three different answers for
// `po` ("Purchase Order" / "PO Creation") and two of the copies missing `risk`
// and `onboarding` entirely, so those stages rendered as raw ids or not at all.
//
// The stage ids themselves come from the workflow templates (see
// channel-stages.ts). These are the display names for them, which is a
// presentation concern and stays in code — but only once.
import type { RequestStatus } from '../../data/types.js';

const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft',
  intake: 'Intake',
  validation: 'Validation',
  // Conditional: entered only when the intake triage required an assessment
  // and no reusable one matched. Rendered as skipped otherwise, not omitted.
  risk: 'Risk Assessment',
  onboarding: 'Vendor Onboarding',
  approval: 'Approval',
  sourcing: 'Sourcing',
  contracting: 'Contracting',
  po: 'Purchase Order',
  receipt: 'Goods Receipt',
  invoice: 'Invoice',
  payment: 'Payment',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'referred-back': 'Referred Back',
};

/**
 * Compact names, for chart axes and kanban column headers.
 *
 * Only where the full name does not fit — the copies this replaced had five
 * different answers for `po` ("Purchase Order", "PO Creation", "PO"), and the
 * shortest of them existed for real layout reasons. One map per context beats
 * ten maps per codebase.
 */
const SHORT_LABELS: Record<string, string> = {
  risk: 'Risk',
  onboarding: 'Onboarding',
  po: 'PO',
  receipt: 'Receipt',
};

/** The display name for a stage. Falls back to the id, never to blank. */
export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

/** The compact display name, for a chart axis or a column header. */
export function stageLabelShort(stage: string): string {
  return SHORT_LABELS[stage] ?? stageLabel(stage);
}

/** `{ id, label }` pairs for a stage list, for the steppers. */
export function labelledStages(
  stages: readonly RequestStatus[],
): { id: RequestStatus; label: string }[] {
  return stages.map((id) => ({ id, label: stageLabel(id) }));
}

/** Every stage id this module can name — asserted against the lifecycle. */
export const LABELLED_STAGE_IDS: readonly string[] = Object.keys(STAGE_LABELS);
