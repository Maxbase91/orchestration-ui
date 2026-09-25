// Seed data only — not read by the runtime app.
// Routing rules moved to the database in Wave 3
// (UI uses `@/lib/db/hooks/use-routing-rules`).

import type { RoutingRule } from './types.js';

// `action.approvalChain` holds an approval_chains id, or '' meaning "let the
// value band decide". It held a role-path string ('category-manager > finance')
// for as long as the field existed, while intake looked it up as an id — so the
// lookup never matched and the band silently decided every time, including for
// the two rules written specifically to escalate compliance.
export const routingRules: RoutingRule[] = [
  {
    id: 'RR-003',
    name: 'Consulting engagements',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'consulting' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'All consulting engagements require Procurement-led procurement regardless of value.',
    lastModified: '2024-09-20T14:00:00Z',
    category: 'Consulting',
  },
  {
    id: 'RR-010',
    name: 'Urgent request fast-track',
    status: 'active',
    conditions: [
      { field: 'isUrgent', operator: 'equals', value: 'true' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'An urgent request is run by procurement, whatever its value. Approvals follow the value band as usual.',
    lastModified: '2024-08-01T08:00:00Z',
    category: 'All',
  },
  {
    id: 'RR-012',
    name: 'High-risk supplier override',
    status: 'active',
    conditions: [
      { field: 'supplierRiskRating', operator: 'risk_rating', value: 'high' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: 'chain-compliance' },
    description: 'A supplier rated high or critical goes through the Compliance Escalation chain (supplier manager, legal, category manager), whatever the value.',
    lastModified: '2024-12-01T09:00:00Z',
    category: 'Risk Management',
  },
  // ── Door 1 decides one thing: business-led or procurement-led ────────────
  // The catalogue and a contract call-off are not routing outcomes: they come
  // from a real catalogue item or a transactable contract found on How you'll
  // buy. Rules used to send a demand to them anyway — anything under €25,000
  // to "catalogue" with no item behind it, contingent labour to "call-off" with
  // no contract — and to Direct PO and P-card, which the intake cannot reach
  // honestly. What is left: category rules that are always procurement-led
  // (consulting, contingent labour), the value rules above, then the
  // business-led ceiling, then procurement-led for everything else.
  {
    id: 'RR-013',
    name: 'Contingent labour',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'contingent-labour' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'Contingent labour is always run by procurement. It becomes a call-off only when the contract check finds a framework that covers it.',
    lastModified: '2026-09-25T00:00:00Z',
    category: 'Contingent Labour',
  },
  //
  // The ceiling has no `less_than_or_equal` operator, so it is written as
  // `between 0,ceiling` — inclusive at both ends, which is what is meant.
  {
    id: 'RR-902',
    name: 'Catch-all — above budget approval',
    status: 'active',
    priority: 902,
    conditions: [
      { field: 'value', operator: 'greater_than', value: 'policy:budgetApprovalThreshold' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'Unmatched demand above the budget approval threshold is procurement-led.',
    lastModified: '2026-09-13T00:00:00Z',
    category: 'All',
  },
  {
    id: 'RR-904',
    name: 'Catch-all — under the business-led ceiling',
    status: 'active',
    priority: 904,
    conditions: [
      { field: 'value', operator: 'between', value: '0,policy:businessLedCeiling' },
    ],
    action: { buyingChannel: 'business-led', approvalChain: '' },
    description: 'At or below the business-led ceiling the business buys it themselves.',
    lastModified: '2026-09-13T00:00:00Z',
    category: 'All',
  },
  {
    id: 'RR-905',
    name: 'Catch-all — everything else',
    status: 'active',
    priority: 905,
    conditions: [
      // Always true for any demand carrying a value, zero included: emptiness is
      // tested before the undefined guard, and 0 is not `=== false`.
      { field: 'value', operator: 'is_not_empty', value: '' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'Anything not caught above is run by procurement. Deactivating this leaves the code floor as the only route.',
    lastModified: '2026-09-13T00:00:00Z',
    category: 'All',
  },
];
