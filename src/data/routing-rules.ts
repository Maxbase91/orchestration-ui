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
    id: 'RR-001',
    name: 'High-value IT software',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'software' },
      { field: 'value', operator: 'greater_than', value: 'policy:budgetApprovalThreshold' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'Routes all software requests above €100K to Procurement-led channel with full approval chain.',
    lastModified: '2024-11-15T10:00:00Z',
    category: 'Software',
  },
  {
    id: 'RR-002',
    name: 'Low-value catalogue purchases',
    status: 'active',
    conditions: [
      { field: 'value', operator: 'less_than', value: '5000' },
      { field: 'category', operator: 'equals', value: 'goods' },
    ],
    action: { buyingChannel: 'catalogue', approvalChain: '' },
    description: 'Auto-routes goods under €5K to catalogue with single-level approval.',
    lastModified: '2024-10-01T09:00:00Z',
    category: 'Goods',
  },
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
    id: 'RR-004',
    name: 'Contingent labour - framework',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'contingent-labour' },
      { field: 'supplierId', operator: 'in', value: 'SUP-013,SUP-014' },
    ],
    action: { buyingChannel: 'framework-call-off', approvalChain: '' },
    description: 'Contingent labour from Randstad or Hays uses framework call-off with two-level approval.',
    lastModified: '2024-08-15T11:00:00Z',
    category: 'Contingent Labour',
  },
  {
    id: 'RR-005',
    name: 'Contract renewals under €50K',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'contract-renewal' },
      { field: 'value', operator: 'less_than', value: '50000' },
    ],
    action: { buyingChannel: 'business-led', approvalChain: '' },
    description: 'Low-value contract renewals can be business-led with category manager oversight.',
    lastModified: '2024-10-10T16:00:00Z',
    category: 'Contract Renewal',
  },
  {
    id: 'RR-006',
    name: 'Mega-deal threshold (>€1M)',
    status: 'active',
    conditions: [
      { field: 'value', operator: 'greater_than', value: 'policy:materialityValueThreshold' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'Any request exceeding €1M requires full approval chain including CPO sign-off.',
    lastModified: '2024-07-01T09:00:00Z',
    category: 'All',
  },
  {
    id: 'RR-007',
    name: 'IT hardware - catalogue eligible',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'goods' },
      { field: 'commodityCode', operator: 'starts_with', value: '432' },
      { field: 'value', operator: 'less_than', value: 'policy:competitiveSourcingThreshold' },
    ],
    action: { buyingChannel: 'catalogue', approvalChain: '' },
    description: 'IT hardware under €25K routes to catalogue if commodity code matches IT equipment.',
    lastModified: '2024-11-01T10:00:00Z',
    category: 'IT Hardware',
  },
  {
    id: 'RR-008',
    name: 'Supplier onboarding flow',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'supplier-onboarding' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: 'chain-compliance' },
    description: 'Supplier onboarding requires compliance review before category manager approval.',
    lastModified: '2024-09-05T09:00:00Z',
    category: 'Supplier Onboarding',
  },
  {
    id: 'RR-009',
    name: 'Facilities services - direct PO',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'services' },
      { field: 'commodityCode', operator: 'starts_with', value: '761' },
      { field: 'value', operator: 'less_than', value: '10000' },
    ],
    action: { buyingChannel: 'direct-po', approvalChain: '' },
    description: 'Low-value facilities services can use direct PO with line manager approval.',
    lastModified: '2024-10-20T14:00:00Z',
    category: 'Facilities',
  },
  {
    id: 'RR-010',
    name: 'Urgent request fast-track',
    status: 'active',
    conditions: [
      { field: 'priority', operator: 'equals', value: 'urgent' },
      { field: 'isUrgent', operator: 'equals', value: 'true' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'Urgent requests skip finance approval and go directly to VP for expedited processing.',
    lastModified: '2024-08-01T08:00:00Z',
    category: 'All',
  },
  {
    id: 'RR-011',
    name: 'Marketing services - mid-tier',
    status: 'draft',
    conditions: [
      { field: 'category', operator: 'equals', value: 'services' },
      { field: 'commodityCode', operator: 'starts_with', value: '8014' },
      { field: 'value', operator: 'between', value: '50000,250000' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'Mid-tier marketing services require Procurement-led procurement with finance approval. Draft — pending policy committee review.',
    lastModified: '2025-01-05T10:00:00Z',
    category: 'Marketing',
  },
  {
    id: 'RR-012',
    name: 'High-risk supplier override',
    status: 'disabled',
    conditions: [
      { field: 'supplierId', operator: 'risk_rating', value: 'high,critical' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: 'chain-compliance' },
    description: 'High/critical risk suppliers require extended approval chain. Disabled — under review after false positive rate exceeded 15%.',
    lastModified: '2024-12-01T09:00:00Z',
    category: 'Risk Management',
  },
  // ── Catch-alls ─────────────────────────────────────────────────────────────
  // These reproduce, exactly, the `fallbackBuyingChannel` if-ladder that used
  // to live in evaluate-routing-rules.ts. It restated three governed numbers in
  // code where no admin could see them, and it is the reason RR-001 sat dead
  // for months: the ladder happened to agree with it, so nothing looked wrong.
  //
  // They run last (priority 900) and are ordered among themselves, because the
  // ladder was ordered: a demand under the competitive-sourcing threshold is
  // catalogue BEFORE anything else is asked about it.
  //
  // The ladder's `value <= 50000` step has no `less_than_or_equal` operator, so
  // it is written as `between 0,ceiling` — `between` is inclusive at both ends,
  // which is exactly the semantics needed.
  {
    id: 'RR-900',
    name: 'Catch-all — below the sourcing threshold',
    status: 'active',
    priority: 900,
    conditions: [
      { field: 'value', operator: 'less_than', value: 'policy:competitiveSourcingThreshold' },
    ],
    action: { buyingChannel: 'catalogue', approvalChain: '' },
    description: 'Unmatched demand below the competitive-sourcing threshold is a catalogue buy.',
    lastModified: '2026-09-13T00:00:00Z',
    category: 'All',
  },
  {
    id: 'RR-901',
    name: 'Catch-all — consulting',
    status: 'active',
    priority: 901,
    conditions: [
      { field: 'category', operator: 'equals', value: 'consulting' },
    ],
    action: { buyingChannel: 'procurement-led', approvalChain: '' },
    description: 'Consulting is procurement-led at any value.',
    lastModified: '2026-09-13T00:00:00Z',
    category: 'All',
  },
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
    id: 'RR-903',
    name: 'Catch-all — contingent labour',
    status: 'active',
    priority: 903,
    conditions: [
      { field: 'category', operator: 'equals', value: 'contingent-labour' },
    ],
    action: { buyingChannel: 'framework-call-off', approvalChain: '' },
    description: 'Contingent labour goes through a framework. RR-004 handles the two suppliers with a standing agreement; this catches the rest.',
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
