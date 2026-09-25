// Seed data only — not read by the runtime app; the engine loads templates from
// the workflow_templates table. Kept in sync with the live WF-001 node config
// (role / slaDays / gate / purpose) so a fresh seed reproduces the same
// governance rather than nodes with no owner.
//
// Workflow templates moved to the database in Wave 3
// (UI uses `@/lib/db/hooks/use-workflow-templates`).

import type { WorkflowTemplate } from './types.js';

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'WF-001',
    name: 'Standard Procurement',
    description: 'Default end-to-end procurement workflow from intake to payment, covering all standard stages.',
    type: 'procurement',
    channels: ['procurement-led'],
    requesterHeadline: 'Procurement runs a sourcing exercise',
    requesterDescription: 'A buyer takes this on, approaches the market and negotiates on your behalf.',
    nodes: [
      { id: 'n1', type: 'start', label: 'Request Submitted', x: 50, y: 200 },
      { id: 'n2', type: 'stage', label: 'Intake', x: 200, y: 200, role: 'Business Requestor', slaDays: 1, gate: 'auto' as const, purpose: 'Demand captured and classified. Completed by submission.' },
      { id: 'n3', type: 'stage', label: 'Validation', x: 350, y: 200, role: 'Category Manager', slaDays: 3, gate: 'manual' as const, purpose: 'Demand is complete, correctly categorised and routed to the right channel.' },
      { id: 'n14', type: 'stage', label: 'Risk Assessment', x: 350, y: 330, role: 'Third-party risk', slaDays: 7, gate: 'manual' as const, purpose: 'Third-party risk assessed and a decision recorded, or an existing assessment reused.' },
      { id: 'n5', type: 'stage', label: 'Approval', x: 650, y: 100, role: 'Approver', slaDays: 5, gate: 'manual' as const, purpose: 'All approvers in the value-banded chain have responded.' },
      { id: 'n6', type: 'stage', label: 'Sourcing', x: 650, y: 300, role: 'Procurement Lead', slaDays: 20, gate: 'manual' as const, purpose: 'A supplier has been selected and the event awarded.' },
      { id: 'n7', type: 'stage', label: 'Contracting', x: 800, y: 200, role: 'Legal', slaDays: 10, gate: 'manual' as const, purpose: 'Contract agreed and signed by both parties.' },
      { id: 'n8', type: 'stage', label: 'PO Creation', x: 950, y: 200, role: 'Procurement Ops', slaDays: 2, gate: 'manual' as const, purpose: 'Purchase order raised and issued to the supplier.' },
      { id: 'n9', type: 'stage', label: 'Receipt', x: 1100, y: 200, role: 'Business Requestor', slaDays: 5, gate: 'manual' as const, purpose: 'Goods or services received and confirmed.' },
      { id: 'n10', type: 'stage', label: 'Invoice', x: 1250, y: 200, role: 'Accounts Payable', slaDays: 5, gate: 'manual' as const, purpose: 'Invoice received and matched to the PO and receipt.' },
      { id: 'n11', type: 'stage', label: 'Payment', x: 1400, y: 200, role: 'Finance', slaDays: 3, gate: 'manual' as const, purpose: 'Payment released to the supplier.' },
      { id: 'n12', type: 'end', label: 'Completed', x: 1550, y: 200 },
      // Referred-back is an error node, not a stage, so no stage lookup reaches it.
      // Its SLA measures the *requester's* time to respond — a request parked here
      // for weeks is exactly what nobody notices today.
      { id: 'n13', type: 'error', label: 'Referred Back', x: 500, y: 400, slaDays: 3 },
      { id: 'n15', type: 'stage', label: 'Vendor Onboarding', x: 760, y: 60, role: 'Vendor management', slaDays: 5, gate: 'manual' as const, purpose: 'Create and screen the supplier so they can be invited to market and assessed' },
    ],
    edges: [
      { source: 'n1', target: 'n2' },
      { source: 'n2', target: 'n3' },
      // Conditional: the risk stage is entered only when the intake triage said
      // one was needed. 'Risk required' is listed first so it is evaluated first;
      // 'Skip risk' is the catch-all for demand that does not need one.
      { source: 'n3', target: 'n14', label: 'Risk required' },
      { source: 'n3', target: 'n5', label: 'Skip risk' },
      // Onboarding is entered only when the supplier the requester named is not
      // yet on the register — so it can be invited to market. 'Onboarding
      // required' is listed first so it is evaluated first.
      { source: 'n14', target: 'n15', label: 'Onboarding required' },
      { source: 'n15', target: 'n5' },
      { source: 'n14', target: 'n5', label: 'Skip onboarding' },
      // Approval, THEN sourcing. There used to be an "Auto-Route" decision here
      // whose two exits ("Needs Approval" / "Direct to Sourcing") were captions,
      // not conditions — so the engine always took the first, and Approval led
      // straight to Contracting. Sourcing never ran on the engine path; three
      // live requests went approval → contracting without a sourcing event.
      { source: 'n5', target: 'n6', label: 'Approved' },
      { source: 'n5', target: 'n13', label: 'Rejected' },
      { source: 'n6', target: 'n7' },
      { source: 'n7', target: 'n8' },
      { source: 'n8', target: 'n9' },
      { source: 'n9', target: 'n10' },
      { source: 'n10', target: 'n11' },
      { source: 'n11', target: 'n12' },
      { source: 'n13', target: 'n2', label: 'Resubmit' },
    ],
  },
  {
    id: 'WF-002',
    name: 'Catalogue Purchase',
    description: 'Simplified workflow for catalogue-based purchases with minimal approval steps.',
    type: 'catalogue',
    channels: ['catalogue'],
    requesterHeadline: 'Order it from the catalogue',
    requesterDescription: 'Pre-approved and pre-priced, so it goes straight through with no sourcing exercise.',
    nodes: [
      { id: 'n1', type: 'start', label: 'Catalogue Order', x: 50, y: 150 },
      // Renamed from "Auto-Validate", which normalised to `validation` — a
      // stage the catalogue channel skips, so every catalogue request showed a
      // phantom stage while lacking the intake it actually has. It IS the
      // automated intake check; one rename removes the phantom and supplies
      // the missing stage.
      { id: 'n2', type: 'stage', label: 'Intake', x: 200, y: 150, role: 'Business Requestor', slaDays: 1, gate: 'auto' as const, purpose: 'Catalogue order captured and checked against the item.' },
      { id: 'n3', type: 'decision', label: 'Value Check', x: 350, y: 150 },
      { id: 'n4', type: 'stage', label: 'Manager Approval', x: 500, y: 50, slaDays: 3 },
      { id: 'n5', type: 'stage', label: 'Auto-PO', x: 500, y: 250, slaDays: 1 },
      { id: 'n6', type: 'stage', label: 'PO Created', x: 650, y: 150, slaDays: 2 },
      { id: 'n7', type: 'stage', label: 'Receipt', x: 800, y: 150, role: 'Business Requestor', slaDays: 5, gate: 'manual' as const, purpose: 'Goods or services received and confirmed.' },
      // A catalogue order is still invoiced and paid — the template ended at
      // Receipt while the channel map (and the real process) carried both.
      { id: 'n9', type: 'stage', label: 'Invoice', x: 950, y: 150, role: 'Accounts Payable', slaDays: 5, gate: 'manual' as const, purpose: 'Invoice received and matched to the PO and receipt.' },
      { id: 'n10', type: 'stage', label: 'Payment', x: 1100, y: 150, role: 'Finance', slaDays: 3, gate: 'manual' as const, purpose: 'Payment released to the supplier.' },
      { id: 'n8', type: 'end', label: 'Complete', x: 1250, y: 150 },
      // Manager Approval had only an "Approved" exit, so a rejected order fell
      // through to the PO.
      { id: 'n11', type: 'error', label: 'Referred Back', x: 500, y: 300, slaDays: 3 },
    ],
    edges: [
      { source: 'n1', target: 'n2' },
      { source: 'n2', target: 'n3' },
      // These labels were `> €5K` / `< €5K` and evaluated to nothing: the
      // parser needed a field name and got a currency symbol, so the branch
      // fell through to the first edge and EVERY catalogue order went to
      // Manager Approval regardless of value. Typed now, against the governed
      // threshold that already decides catalogue auto-approval elsewhere — so
      // the boundary moves from /admin/thresholds rather than from a caption.
      {
        source: 'n3',
        target: 'n4',
        label: 'Above the auto-approval threshold',
        condition: { field: 'value', operator: 'greater_than', value: 'policy:catalogueAutoApprovalThreshold' },
      },
      // The default branch: no condition, so it is taken when the one above
      // does not hold.
      { source: 'n3', target: 'n5', label: 'Auto-approve' },
      { source: 'n4', target: 'n6', label: 'Approved' },
      { source: 'n4', target: 'n11', label: 'Rejected' },
      { source: 'n11', target: 'n2', label: 'Resubmit' },
      { source: 'n5', target: 'n6' },
      { source: 'n6', target: 'n7' },
      { source: 'n7', target: 'n9' },
      { source: 'n9', target: 'n10' },
      { source: 'n10', target: 'n8' },
    ],
  },
  // ── The channels that never had a lifecycle ────────────────────────────────
  // Only procurement-led and catalogue had a template, so deriving the stage
  // map from templates was impossible for four of six channels — there was
  // nothing to derive from, and `type` (procurement/catalogue/onboarding/
  // renewal) has no column to join a BuyingChannel on.
  //
  // Stages, owner roles and SLAs are WF-001's, so these describe exactly what
  // buying-channel-stages.ts already claimed. They change no behaviour; what
  // they change is that an admin can now SEE what p-card and direct-po do.
  {
    id: 'WF-006',
    name: 'Business-Led Buying',
    description: 'The business runs the buy with a supplier it chooses. Procurement assures risk, onboarding and the contract rather than running the deal.',
    type: 'business-led',
    // Business-led only. It used to claim framework-call-off too, on the view
    // that the two traverse the same stages — they do not: a call-off against
    // a transactable contract needs no vendor onboarding (the contract supplier
    // is set up) and no fresh risk assessment when the contract's one can be
    // reused. WF-008 carries the call-off.
    channels: ['business-led'],
    requesterHeadline: 'Your team runs this one',
    requesterDescription: 'You lead the buying decision; Procurement is available if you want help.',
    nodes: [
      { id: 'n1', type: 'start', label: 'Request Submitted', x: 50, y: 200 },
      { id: 'n2', type: 'stage', label: 'Intake', x: 200, y: 200, role: 'Business Requestor', slaDays: 1, gate: 'auto' as const, purpose: 'Demand captured and classified. Completed by submission.' },
      { id: 'n3', type: 'stage', label: 'Risk Assessment', x: 350, y: 200, role: 'Third-party risk', slaDays: 7, gate: 'manual' as const, purpose: 'Third-party risk assessed and a decision recorded, or an existing assessment reused.' },
      { id: 'n4', type: 'stage', label: 'Vendor Onboarding', x: 500, y: 200, role: 'Vendor management', slaDays: 5, gate: 'manual' as const, purpose: 'Create and screen the supplier so they can be transacted with.' },
      { id: 'n5', type: 'stage', label: 'Approval', x: 650, y: 200, role: 'Approver', slaDays: 5, gate: 'manual' as const, purpose: 'All approvers in the value-banded chain have responded.' },
      { id: 'n6', type: 'stage', label: 'PO Creation', x: 800, y: 200, role: 'Procurement Ops', slaDays: 2, gate: 'manual' as const, purpose: 'Purchase order raised and issued to the supplier.' },
      { id: 'n7', type: 'stage', label: 'Receipt', x: 950, y: 200, role: 'Business Requestor', slaDays: 5, gate: 'manual' as const, purpose: 'Goods or services received and confirmed.' },
      { id: 'n8', type: 'stage', label: 'Invoice', x: 1100, y: 200, role: 'Accounts Payable', slaDays: 5, gate: 'manual' as const, purpose: 'Invoice received and matched to the PO and receipt.' },
      { id: 'n9', type: 'stage', label: 'Payment', x: 1250, y: 200, role: 'Finance', slaDays: 3, gate: 'manual' as const, purpose: 'Payment released to the supplier.' },
      { id: 'n10', type: 'end', label: 'Completed', x: 1400, y: 200 },
      { id: 'n11', type: 'error', label: 'Referred Back', x: 650, y: 350, slaDays: 3 },
      // The business chooses the supplier, but the terms are still agreed and
      // signed before a PO: without this stage a business-led services buy
      // reached a purchase order with no contract behind it.
      { id: 'n12', type: 'stage', label: 'Contracting', x: 725, y: 80, role: 'Legal', slaDays: 10, gate: 'manual' as const, purpose: 'Supplier terms agreed and signed before the PO.' },
    ],
    edges: [
      { source: 'n1', target: 'n2' },
      { source: 'n2', target: 'n3' },
      // Business-led buying always gets a risk review — the supplier is the
      // business's own choice. Onboarding is conditional on it being new.
      { source: 'n3', target: 'n4', label: 'Onboarding required' },
      { source: 'n3', target: 'n5', label: 'Skip onboarding' },
      { source: 'n4', target: 'n5' },
      { source: 'n5', target: 'n12', label: 'Approved' },
      { source: 'n12', target: 'n6' },
      { source: 'n5', target: 'n11', label: 'Rejected' },
      { source: 'n6', target: 'n7' },
      { source: 'n7', target: 'n8' },
      { source: 'n8', target: 'n9' },
      { source: 'n9', target: 'n10' },
      { source: 'n11', target: 'n2', label: 'Resubmit' },
    ],
  },
  {
    id: 'WF-008',
    name: 'Contract Call-Off',
    description: 'A call-off against a transactable contract. The contract already governs the supplier and the price, so there is no sourcing and no vendor onboarding; risk is assessed only when the contract supplier\'s assessment cannot be reused.',
    type: 'call-off',
    channels: ['framework-call-off'],
    requesterHeadline: 'Call it off an existing contract',
    requesterDescription: 'The agreement is already negotiated, so there is no new sourcing exercise.',
    nodes: [
      { id: 'n1', type: 'start', label: 'Call-off Submitted', x: 50, y: 200 },
      { id: 'n2', type: 'stage', label: 'Intake', x: 200, y: 200, role: 'Business Requestor', slaDays: 1, gate: 'auto' as const, purpose: 'Call-off captured against the contract. Completed by submission.' },
      { id: 'n3', type: 'stage', label: 'Contracting', x: 350, y: 80, role: 'Legal', slaDays: 10, gate: 'manual' as const, purpose: 'The contract is amended so this call-off falls within it.' },
      { id: 'n4', type: 'stage', label: 'Risk Assessment', x: 350, y: 320, role: 'Third-party risk', slaDays: 7, gate: 'manual' as const, purpose: 'The contract supplier\'s assessment is extended to this scope.' },
      { id: 'n5', type: 'stage', label: 'Approval', x: 500, y: 200, role: 'Approver', slaDays: 5, gate: 'manual' as const, purpose: 'All approvers in the value-banded chain have responded.' },
      { id: 'n6', type: 'stage', label: 'PO Creation', x: 650, y: 200, role: 'Procurement Ops', slaDays: 2, gate: 'manual' as const, purpose: 'Purchase order raised against the contract.' },
      { id: 'n7', type: 'stage', label: 'Receipt', x: 800, y: 200, role: 'Business Requestor', slaDays: 5, gate: 'manual' as const, purpose: 'Goods or services received and confirmed.' },
      { id: 'n8', type: 'stage', label: 'Invoice', x: 950, y: 200, role: 'Accounts Payable', slaDays: 5, gate: 'manual' as const, purpose: 'Invoice received and matched to the PO and receipt.' },
      { id: 'n9', type: 'stage', label: 'Payment', x: 1100, y: 200, role: 'Finance', slaDays: 3, gate: 'manual' as const, purpose: 'Payment released to the supplier.' },
      { id: 'n10', type: 'end', label: 'Completed', x: 1250, y: 200 },
      { id: 'n11', type: 'error', label: 'Referred Back', x: 500, y: 380, slaDays: 3 },
    ],
    edges: [
      { source: 'n1', target: 'n2' },
      // Each detour is taken only when its signal says so; the plain path is
      // Intake → Approval. The first matching condition wins, so an amendment
      // is dealt with before the risk question is asked.
      { source: 'n2', target: 'n3', label: 'Contract amendment required' },
      { source: 'n2', target: 'n4', label: 'Risk required' },
      { source: 'n2', target: 'n5' },
      { source: 'n3', target: 'n4', label: 'Risk required' },
      { source: 'n3', target: 'n5' },
      { source: 'n4', target: 'n5' },
      { source: 'n5', target: 'n6', label: 'Approved' },
      { source: 'n5', target: 'n11', label: 'Rejected' },
      { source: 'n6', target: 'n7' },
      { source: 'n7', target: 'n8' },
      { source: 'n8', target: 'n9' },
      { source: 'n9', target: 'n10' },
      { source: 'n11', target: 'n2', label: 'Resubmit' },
    ],
  },
];
