// The shape of a workflow template node, and the gate rule derived from it.
//
// Nodes used to carry only id/type/label/x/y. The Workflow Designer collected
// assignee, approver, timeout and approval type in its config panel and then
// threw all of it away on save, so an admin could configure a stage owner and
// nothing anywhere would read it. These fields close that loop: the designer
// persists them, the engine acts on them.
//
// Every field beyond the original five is optional, so templates saved before
// this existed stay valid and simply fall back to the defaults below.

/** A stage either runs straight through or waits for a person. */
export type NodeGate = 'auto' | 'manual';

export interface TemplateNode {
  id: string;
  type: string;
  label: string;
  x?: number;
  y?: number;
  /** Chain role that owns this stage, e.g. 'Category Manager'. */
  role?: string;
  /** Working days allowed in this stage; drives sla_deadline. */
  slaDays?: number;
  /** One line saying what this stage is for — shown as the stage's exit criteria. */
  purpose?: string;
  /** Whether leaving this stage needs a human action. */
  gate?: NodeGate;
}

/**
 * Stages that pass straight through when the template says nothing.
 *
 * The default is **manual**, and the list of exceptions is deliberately tiny.
 * Every stage in this lifecycle names a real thing somebody does — validate the
 * demand, assess the risk, sign the contract, raise the PO, receive the goods,
 * pay the invoice — so auto-advancing past one asserts that work happened when
 * nobody did it. `intake` is the exception because it IS the submission: by the
 * time the engine runs, intake is already finished.
 *
 * A template can override any of this per node via `gate`.
 */
const DEFAULT_AUTO_STAGES = new Set(['intake']);

/** Stage statuses the engine suspends on regardless of node config. */
export const ALWAYS_SUSPEND_STAGES = new Set(['approval', 'sourcing']);

/**
 * Does entering this stage stop the engine?
 *
 * `status` is the normalised RequestStatus, not the raw node label, so a
 * renamed node keeps its gate as long as it still maps to the same stage.
 */
export function isGatedStage(node: TemplateNode | undefined, status: string): boolean {
  if (ALWAYS_SUSPEND_STAGES.has(status)) return true;
  if (node?.gate) return node.gate === 'manual';
  return !DEFAULT_AUTO_STAGES.has(status);
}

/** Human-facing label for the action that leaves a gated stage. */
export function gateActionLabel(status: string): string {
  switch (status) {
    case 'validation': return 'Complete validation';
    case 'risk': return 'Record risk decision';
    case 'onboarding': return 'Complete vendor onboarding';
    case 'contracting': return 'Contract signed';
    case 'po': return 'PO issued';
    case 'receipt': return 'Goods received';
    case 'invoice': return 'Invoice matched';
    case 'payment': return 'Payment released';
    default: return 'Complete stage';
  }
}

// ── Label → RequestStatus normalisation ──────────────────────────────────────
// Lives here rather than in the engine because the UI needs the same answer:
// "which stage is this node?" is asked by the engine when it executes a node and
// by the request page when it decides which gate action to show. Two copies
// would drift.

const LABEL_TO_STATUS: Record<string, string> = {
  'intake': 'intake',
  'validation': 'validation',
  'approval': 'approval',
  'sourcing': 'sourcing',
  // WF-004 labels its sourcing node 'Sourcing (RFP)'. Without this entry
  // nodeToStatus falls back to slugifying the label and writes the invalid
  // status 'sourcing-(rfp)' onto the request — which also skips its gate.
  'sourcing (rfp)': 'sourcing',
  'risk': 'risk',
  'risk assessment': 'risk',
  'onboarding': 'onboarding',
  'vendor onboarding': 'onboarding',
  'supplier onboarding': 'onboarding',
  'contracting': 'contracting',
  'po creation': 'po',
  'po created': 'po',
  'auto-po': 'po',
  'manager approval': 'approval',
  'auto-validate': 'validation',
  'initial review': 'validation',
  'due diligence': 'validation',
  'receipt': 'receipt',
  'invoice': 'invoice',
  'payment': 'payment',
  'completed': 'completed',
  'complete': 'completed',
  'referred back': 'referred-back',
};

export function nodeToStatus(label: string): string {
  const key = label.toLowerCase().trim();
  return LABEL_TO_STATUS[key] ?? key.replace(/\s+/g, '-');
}

/** Statuses from which a request never advances again. */
const TERMINAL_STATUSES = new Set(['completed', 'cancelled']);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
