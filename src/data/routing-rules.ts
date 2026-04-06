import type { RoutingRule } from './types';

export const routingRules: RoutingRule[] = [
  {
    id: 'RR-001',
    name: 'High-value IT software',
    status: 'active',
    conditions: [
      { field: 'category', operator: 'equals', value: 'software' },
      { field: 'value', operator: 'greater_than', value: '100000' },
    ],
    action: { buyingChannel: 'gp-led', approvalChain: 'category-manager > finance > vp-procurement' },
    description: 'Routes all software requests above €100K to GP-led channel with full approval chain.',
    matchCount: 42,
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
    action: { buyingChannel: 'catalogue', approvalChain: 'line-manager' },
    description: 'Auto-routes goods under €5K to catalogue with single-level approval.',
    matchCount: 187,
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
    action: { buyingChannel: 'gp-led', approvalChain: 'category-manager > finance > vp-procurement' },
    description: 'All consulting engagements require GP-led procurement regardless of value.',
    matchCount: 28,
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
    action: { buyingChannel: 'framework-call-off', approvalChain: 'category-manager > finance' },
    description: 'Contingent labour from Randstad or Hays uses framework call-off with two-level approval.',
    matchCount: 35,
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
    action: { buyingChannel: 'business-led', approvalChain: 'category-manager' },
    description: 'Low-value contract renewals can be business-led with category manager oversight.',
    matchCount: 15,
    lastModified: '2024-10-10T16:00:00Z',
    category: 'Contract Renewal',
  },
  {
    id: 'RR-006',
    name: 'Mega-deal threshold (>€1M)',
    status: 'active',
    conditions: [
      { field: 'value', operator: 'greater_than', value: '1000000' },
    ],
    action: { buyingChannel: 'gp-led', approvalChain: 'category-manager > finance > vp-procurement > cpo' },
    description: 'Any request exceeding €1M requires full approval chain including CPO sign-off.',
    matchCount: 8,
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
      { field: 'value', operator: 'less_than', value: '25000' },
    ],
    action: { buyingChannel: 'catalogue', approvalChain: 'line-manager > category-manager' },
    description: 'IT hardware under €25K routes to catalogue if commodity code matches IT equipment.',
    matchCount: 62,
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
    action: { buyingChannel: 'gp-led', approvalChain: 'supplier-manager > compliance > category-manager' },
    description: 'Supplier onboarding requires compliance review before category manager approval.',
    matchCount: 12,
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
    action: { buyingChannel: 'direct-po', approvalChain: 'line-manager' },
    description: 'Low-value facilities services can use direct PO with line manager approval.',
    matchCount: 24,
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
    action: { buyingChannel: 'gp-led', approvalChain: 'category-manager > vp-procurement' },
    description: 'Urgent requests skip finance approval and go directly to VP for expedited processing.',
    matchCount: 6,
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
    action: { buyingChannel: 'gp-led', approvalChain: 'category-manager > finance' },
    description: 'Mid-tier marketing services require GP-led procurement with finance approval. Draft — pending policy committee review.',
    matchCount: 0,
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
    action: { buyingChannel: 'gp-led', approvalChain: 'supplier-manager > compliance > vp-procurement > cpo' },
    description: 'High/critical risk suppliers require extended approval chain. Disabled — under review after false positive rate exceeded 15%.',
    matchCount: 3,
    lastModified: '2024-12-01T09:00:00Z',
    category: 'Risk Management',
  },
];

export function getActiveRules(): RoutingRule[] {
  return routingRules.filter((r) => r.status === 'active');
}

export function getRuleById(id: string): RoutingRule | undefined {
  return routingRules.find((r) => r.id === id);
}
