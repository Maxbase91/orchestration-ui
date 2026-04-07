export interface ComplianceCheck {
  id: string;
  category: 'Budget' | 'Contract' | 'Supplier Compliance' | 'Policy' | 'Risk' | 'Value';
  check: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ComplianceReport {
  requestId: string;
  agentId: string;
  agentName: string;
  decision: 'approved' | 'rejected' | 'needs-review';
  confidence: number;
  generatedAt: string;
  summary: string;
  checks: ComplianceCheck[];
  recommendation: string;
}

export const complianceReports: ComplianceReport[] = [
  // 1 — REQ-2024-0001 (completed, cloud hosting) — approved
  {
    requestId: 'REQ-2024-0001',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'approved',
    confidence: 97.2,
    generatedAt: '2024-04-02T10:15:00Z',
    summary: 'Cloud hosting migration request fully compliant. Active contract in place, budget confirmed, supplier risk low.',
    checks: [
      { id: 'CHK-001-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €480,000 within approved IT capex envelope for FY2024.', severity: 'critical' },
      { id: 'CHK-001-2', category: 'Budget', check: 'Quarterly budget threshold', status: 'pass', detail: 'Within department quarterly budget allocation (62% utilised).', severity: 'medium' },
      { id: 'CHK-001-3', category: 'Contract', check: 'Contract coverage', status: 'pass', detail: 'Active contract found (CON-006) — valid until 2026-03-31.', severity: 'high' },
      { id: 'CHK-001-4', category: 'Supplier Compliance', check: 'SRA status', status: 'pass', detail: 'SRA valid until 2025-12-15. Supplier fully assessed.', severity: 'high' },
      { id: 'CHK-001-5', category: 'Policy', check: 'Delegated authority', status: 'pass', detail: 'Value within delegated authority for Head of Engineering.', severity: 'high' },
      { id: 'CHK-001-6', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. No adverse findings in last 12 months.', severity: 'medium' },
      { id: 'CHK-001-7', category: 'Value', check: 'Market benchmark', status: 'pass', detail: 'Pricing within market benchmark ±10% based on Gartner cloud pricing index.', severity: 'medium' },
    ],
    recommendation: 'All compliance checks passed. Recommend proceeding to PO creation without additional review.',
  },

  // 2 — REQ-2024-0002 (completed, SAP renewal) — approved
  {
    requestId: 'REQ-2024-0002',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'approved',
    confidence: 95.8,
    generatedAt: '2024-07-10T14:30:00Z',
    summary: 'SAP license renewal compliant. High-value contract renewal follows established precedent. Budget pre-approved by CFO.',
    checks: [
      { id: 'CHK-002-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €1,200,000 pre-approved in annual IT budget.', severity: 'critical' },
      { id: 'CHK-002-2', category: 'Contract', check: 'Contract coverage', status: 'pass', detail: 'Active contract found (CON-002) — renewal under existing master agreement.', severity: 'high' },
      { id: 'CHK-002-3', category: 'Supplier Compliance', check: 'SRA status', status: 'pass', detail: 'SRA valid until 2026-06-30. SAP SE fully compliant.', severity: 'high' },
      { id: 'CHK-002-4', category: 'Policy', check: 'Delegated authority', status: 'warning', detail: 'Value exceeds €1M threshold — CFO approval obtained and documented.', severity: 'high' },
      { id: 'CHK-002-5', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. Publicly traded, investment-grade credit.', severity: 'medium' },
      { id: 'CHK-002-6', category: 'Risk', check: 'Concentration risk', status: 'info', detail: 'SAP represents 18% of total IT spend. Within acceptable concentration limits.', severity: 'low' },
      { id: 'CHK-002-7', category: 'Value', check: 'Price comparison', status: 'pass', detail: 'Renewal pricing 3% above prior year — within expected inflationary adjustment.', severity: 'medium' },
    ],
    recommendation: 'Compliant with all policies. CFO approval already documented for high-value threshold. Proceed to PO.',
  },

  // 3 — REQ-2024-0003 (payment, office furniture) — approved
  {
    requestId: 'REQ-2024-0003',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'approved',
    confidence: 93.4,
    generatedAt: '2024-09-05T09:20:00Z',
    summary: 'Office furniture procurement compliant via framework agreement. Budget confirmed, supplier assessed.',
    checks: [
      { id: 'CHK-003-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €175,000 within Facilities capex budget.', severity: 'critical' },
      { id: 'CHK-003-2', category: 'Contract', check: 'Framework agreement', status: 'pass', detail: 'Active framework agreement (CON-015) in place. Call-off permitted.', severity: 'high' },
      { id: 'CHK-003-3', category: 'Supplier Compliance', check: 'SRA status', status: 'pass', detail: 'SRA valid until 2025-09-30. Supplier compliant.', severity: 'high' },
      { id: 'CHK-003-4', category: 'Policy', check: 'Buying channel', status: 'pass', detail: 'Framework call-off buying channel correctly selected.', severity: 'medium' },
      { id: 'CHK-003-5', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. No delivery issues in past 24 months.', severity: 'medium' },
      { id: 'CHK-003-6', category: 'Value', check: 'Framework pricing', status: 'pass', detail: 'Pricing per framework agreement schedule — no deviation.', severity: 'medium' },
    ],
    recommendation: 'Framework call-off compliant. All checks passed. Proceed to PO creation.',
  },

  // 4 — REQ-2024-0004 (completed, marketing agency) — approved
  {
    requestId: 'REQ-2024-0004',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'approved',
    confidence: 91.0,
    generatedAt: '2024-06-18T11:45:00Z',
    summary: 'Marketing agency retainer compliant. Contract in place, budget approved. Minor note on value-for-money benchmarking.',
    checks: [
      { id: 'CHK-004-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €320,000 within Marketing opex allocation.', severity: 'critical' },
      { id: 'CHK-004-2', category: 'Contract', check: 'Contract coverage', status: 'pass', detail: 'Active contract found (CON-011) — retainer terms defined.', severity: 'high' },
      { id: 'CHK-004-3', category: 'Supplier Compliance', check: 'SRA status', status: 'pass', detail: 'SRA valid until 2025-11-20. WPP Group assessed.', severity: 'high' },
      { id: 'CHK-004-4', category: 'Policy', check: 'Delegated authority', status: 'pass', detail: 'Value within delegated authority for VP Marketing.', severity: 'high' },
      { id: 'CHK-004-5', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. Global agency with strong track record.', severity: 'medium' },
      { id: 'CHK-004-6', category: 'Value', check: 'Market benchmark', status: 'warning', detail: '15% above historical average for comparable agency retainers — within acceptable range but flagged.', severity: 'medium' },
      { id: 'CHK-004-7', category: 'Value', check: 'Rate card review', status: 'info', detail: 'Rate card last negotiated 18 months ago. Consider renegotiation at next renewal.', severity: 'low' },
    ],
    recommendation: 'Compliant. Pricing slightly above benchmark but within tolerance. Suggest rate card review at next renewal cycle.',
  },

  // 5 — REQ-2024-0005 (completed, security audit) — approved
  {
    requestId: 'REQ-2024-0005',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'approved',
    confidence: 98.1,
    generatedAt: '2024-08-20T08:10:00Z',
    summary: 'Security audit engagement fully compliant. Mandatory compliance requirement with established provider.',
    checks: [
      { id: 'CHK-005-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €95,000 within Security & Compliance budget.', severity: 'critical' },
      { id: 'CHK-005-2', category: 'Contract', check: 'Contract coverage', status: 'pass', detail: 'Active contract found (CON-003) — master services agreement in place.', severity: 'high' },
      { id: 'CHK-005-3', category: 'Supplier Compliance', check: 'SRA status', status: 'pass', detail: 'SRA valid until 2025-08-15. Deloitte fully assessed and cleared.', severity: 'high' },
      { id: 'CHK-005-4', category: 'Policy', check: 'Consulting engagement policy', status: 'pass', detail: 'Consulting engagement policy satisfied — scope and deliverables documented.', severity: 'high' },
      { id: 'CHK-005-5', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. Big Four firm, no adverse findings.', severity: 'medium' },
      { id: 'CHK-005-6', category: 'Value', check: 'Market benchmark', status: 'pass', detail: 'Pricing within market benchmark ±10% for comparable security audit engagements.', severity: 'medium' },
    ],
    recommendation: 'All checks passed. Mandatory compliance engagement — recommend immediate PO creation.',
  },

  // 6 — REQ-2024-0016 (po, laptop refresh) — approved
  {
    requestId: 'REQ-2024-0016',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'approved',
    confidence: 94.5,
    generatedAt: '2024-12-10T13:00:00Z',
    summary: 'Laptop refresh programme compliant. Catalogue purchase via established contract. Standard hardware lifecycle replacement.',
    checks: [
      { id: 'CHK-006-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €525,000 within IT hardware refresh allocation.', severity: 'critical' },
      { id: 'CHK-006-2', category: 'Budget', check: 'Quarterly budget threshold', status: 'warning', detail: 'Exceeds department quarterly budget by 12% — annual allocation confirmed by budget owner.', severity: 'medium' },
      { id: 'CHK-006-3', category: 'Contract', check: 'Contract coverage', status: 'pass', detail: 'Active contract found (CON-016) — catalogue pricing applies.', severity: 'high' },
      { id: 'CHK-006-4', category: 'Supplier Compliance', check: 'SRA status', status: 'pass', detail: 'SRA valid until 2026-01-31. Supplier fully compliant.', severity: 'high' },
      { id: 'CHK-006-5', category: 'Policy', check: 'Catalogue purchase policy', status: 'pass', detail: 'Catalogue buying channel correctly selected. Items on approved product list.', severity: 'medium' },
      { id: 'CHK-006-6', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. Established hardware vendor.', severity: 'medium' },
      { id: 'CHK-006-7', category: 'Value', check: 'Catalogue pricing', status: 'pass', detail: 'Pricing per catalogue schedule — volume discount of 8% applied.', severity: 'medium' },
    ],
    recommendation: 'Compliant. Quarterly budget threshold flagged but annual allocation confirmed. Proceed to PO.',
  },

  // 7 — REQ-2024-0017 (invoice, KPMG tax advisory) — needs-review
  {
    requestId: 'REQ-2024-0017',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'needs-review',
    confidence: 84.3,
    generatedAt: '2024-08-01T15:20:00Z',
    summary: 'Tax advisory engagement mostly compliant but requires human review. Consulting engagement exceeds standard rates and requires VP approval per policy.',
    checks: [
      { id: 'CHK-007-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €180,000 within Finance advisory budget.', severity: 'critical' },
      { id: 'CHK-007-2', category: 'Contract', check: 'Contract coverage', status: 'pass', detail: 'Active contract found (CON-004) — master services agreement with KPMG.', severity: 'high' },
      { id: 'CHK-007-3', category: 'Supplier Compliance', check: 'SRA status', status: 'pass', detail: 'SRA valid until 2025-10-01. KPMG fully assessed.', severity: 'high' },
      { id: 'CHK-007-4', category: 'Policy', check: 'Consulting engagement policy', status: 'warning', detail: 'Consulting engagement requires VP approval — approval not yet documented in system.', severity: 'high' },
      { id: 'CHK-007-5', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. Big Four firm.', severity: 'medium' },
      { id: 'CHK-007-6', category: 'Value', check: 'Market benchmark', status: 'warning', detail: '25% above historical average for comparable tax advisory — driven by multi-jurisdiction scope.', severity: 'medium' },
      { id: 'CHK-007-7', category: 'Value', check: 'Rate comparison', status: 'info', detail: 'Partner rate of €450/hr exceeds benchmark of €380/hr. Justified by specialist TP expertise.', severity: 'low' },
    ],
    recommendation: 'VP approval documentation required before PO creation. Pricing above benchmark but justified by scope complexity. Recommend obtaining sign-off and proceeding.',
  },

  // 8 — REQ-2024-0018 (receipt, records management) — approved
  {
    requestId: 'REQ-2024-0018',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'approved',
    confidence: 96.7,
    generatedAt: '2024-11-01T10:05:00Z',
    summary: 'Records management services compliant. Low-value direct PO with established supplier. Regulatory requirement.',
    checks: [
      { id: 'CHK-008-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €35,000 within Legal operations budget.', severity: 'critical' },
      { id: 'CHK-008-2', category: 'Contract', check: 'Contract coverage', status: 'pass', detail: 'Active contract found (CON-012) — service level agreement in place.', severity: 'high' },
      { id: 'CHK-008-3', category: 'Supplier Compliance', check: 'SRA status', status: 'pass', detail: 'SRA valid until 2025-09-30. Supplier compliant.', severity: 'high' },
      { id: 'CHK-008-4', category: 'Policy', check: 'Direct PO threshold', status: 'pass', detail: 'Value within direct PO threshold of €50,000. No competitive sourcing required.', severity: 'medium' },
      { id: 'CHK-008-5', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. Established records management provider.', severity: 'medium' },
      { id: 'CHK-008-6', category: 'Value', check: 'Market benchmark', status: 'pass', detail: 'Pricing within market benchmark ±10% for records management services.', severity: 'medium' },
    ],
    recommendation: 'All checks passed. Low-risk, low-value regulatory requirement. Proceed to PO.',
  },

  // 9 — REQ-2024-0024 (po, Hays finance temp staff) — needs-review
  {
    requestId: 'REQ-2024-0024',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'needs-review',
    confidence: 82.1,
    generatedAt: '2024-12-12T09:30:00Z',
    summary: 'Contingent labour request mostly compliant but flagged for review. Urgency noted — framework call-off valid but SRA expiring soon.',
    checks: [
      { id: 'CHK-009-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €72,000 within Finance temporary staffing budget.', severity: 'critical' },
      { id: 'CHK-009-2', category: 'Contract', check: 'Framework agreement', status: 'pass', detail: 'Active framework agreement (CON-014) — call-off terms apply.', severity: 'high' },
      { id: 'CHK-009-3', category: 'Supplier Compliance', check: 'SRA status', status: 'warning', detail: 'SRA expiring in 45 days (2025-02-25). Renewal should be initiated.', severity: 'high' },
      { id: 'CHK-009-4', category: 'Policy', check: 'Contingent labour policy', status: 'pass', detail: 'Contingent labour policy requirements met — justification documented.', severity: 'medium' },
      { id: 'CHK-009-5', category: 'Policy', check: 'Urgency flag review', status: 'warning', detail: 'Request flagged as urgent — urgency justification reviewed and accepted.', severity: 'medium' },
      { id: 'CHK-009-6', category: 'Risk', check: 'Supplier risk rating', status: 'pass', detail: 'Supplier risk rating: Low. Hays is an approved panel supplier.', severity: 'medium' },
      { id: 'CHK-009-7', category: 'Value', check: 'Rate comparison', status: 'pass', detail: 'Day rates within framework agreement schedule. No deviation.', severity: 'medium' },
    ],
    recommendation: 'SRA renewal should be initiated in parallel. Urgent request justified — recommend proceeding with PO while flagging SRA renewal to supplier management.',
  },

  // 10 — REQ-2024-0033 (receipt, Randstad IT helpdesk) — rejected
  {
    requestId: 'REQ-2024-0033',
    agentId: 'AI-006',
    agentName: 'PR Compliance Reviewer',
    decision: 'rejected',
    confidence: 89.6,
    generatedAt: '2024-11-05T11:40:00Z',
    summary: 'IT helpdesk staff augmentation failed compliance review. No existing contract for this scope — sourcing required. Supplier flagged for sanctions screening.',
    checks: [
      { id: 'CHK-010-1', category: 'Budget', check: 'Budget availability', status: 'pass', detail: 'Budget availability confirmed — €216,000 within IT operations budget.', severity: 'critical' },
      { id: 'CHK-010-2', category: 'Budget', check: 'Quarterly budget threshold', status: 'warning', detail: 'Exceeds department quarterly budget by 8% — requires budget owner confirmation.', severity: 'medium' },
      { id: 'CHK-010-3', category: 'Contract', check: 'Contract coverage', status: 'pass', detail: 'Active framework agreement (CON-013) covers IT contingent labour.', severity: 'high' },
      { id: 'CHK-010-4', category: 'Supplier Compliance', check: 'SRA status', status: 'fail', detail: 'SRA expired on 2024-10-15. Supplier assessment renewal overdue.', severity: 'critical' },
      { id: 'CHK-010-5', category: 'Policy', check: 'Contingent labour policy', status: 'pass', detail: 'Contingent labour requirements documented — headcount justification provided.', severity: 'medium' },
      { id: 'CHK-010-6', category: 'Risk', check: 'Sanctions screening', status: 'fail', detail: 'Supplier flagged for sanctions screening — subsidiary entity requires additional verification.', severity: 'critical' },
      { id: 'CHK-010-7', category: 'Value', check: 'Market benchmark', status: 'pass', detail: 'Pricing within market benchmark ±10% for L1/L2 IT support staff.', severity: 'medium' },
    ],
    recommendation: 'Cannot proceed. SRA renewal required and sanctions screening flag must be resolved. Escalate to supplier management and compliance teams before re-submission.',
  },
];

export function getComplianceReport(requestId: string): ComplianceReport | undefined {
  return complianceReports.find((r) => r.requestId === requestId);
}
