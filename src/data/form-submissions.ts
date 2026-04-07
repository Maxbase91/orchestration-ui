export interface FormSubmission {
  id: string;
  formTemplateId: string;
  formName: string;
  requestId: string;
  stage: string;
  submittedBy: string;
  submittedAt: string;
  values: Record<string, string | string[] | boolean>;
  status: 'completed' | 'in-progress' | 'draft';
}

export const formSubmissions: FormSubmission[] = [
  // ── REQ-2024-0001 (Cloud hosting migration - AWS, completed, software) ──
  {
    id: 'FSUB-001',
    formTemplateId: 'FORM-001',
    formName: 'Risk Assessment Triage',
    requestId: 'REQ-2024-0001',
    stage: 'validation',
    submittedBy: 'u1',
    submittedAt: '2024-03-18T10:30:00Z',
    status: 'completed',
    values: {
      'f001-registered': 'yes',
      'f001-sra-status': 'yes-valid',
      'f001-annual-spend': '480000',
      'f001-data-sensitivity': 'high',
      'f001-premises': 'no',
      'f001-high-risk-jurisdiction': false,
      'f001-notes': 'AWS is an established cloud provider with SOC 2 and ISO 27001. Data will reside in EU-West (Frankfurt) region per company policy.',
    },
  },
  {
    id: 'FSUB-002',
    formTemplateId: 'FORM-006',
    formName: 'IT Security Assessment',
    requestId: 'REQ-2024-0001',
    stage: 'validation',
    submittedBy: 'u3',
    submittedAt: '2024-03-20T14:00:00Z',
    status: 'completed',
    values: {
      'f006-app-name': 'AWS Cloud Infrastructure (EC2, RDS, S3)',
      'f006-data-classification': 'confidential',
      'f006-hosting': 'public-cloud',
      'f006-encryption-rest': 'yes',
      'f006-encryption-transit': 'yes',
      'f006-mfa': 'yes',
      'f006-api-security': 'yes',
      'f006-pen-test': 'yes',
      'f006-last-audit': '2024-01-15',
      'f006-security-contact': 'security@amazon.com',
    },
  },
  {
    id: 'FSUB-003',
    formTemplateId: 'FORM-005',
    formName: 'Budget Approval Form',
    requestId: 'REQ-2024-0001',
    stage: 'approval',
    submittedBy: 'u7',
    submittedAt: '2024-04-02T09:15:00Z',
    status: 'completed',
    values: {
      'f005-budget-code': 'CC-ENG-001',
      'f005-gl-account': '6300-10-001',
      'f005-cost-allocation': '100',
      'f005-fiscal-year': '2024',
      'f005-manager-name': 'Elena Petrova',
      'f005-manager-confirmation': true,
    },
  },
  {
    id: 'FSUB-004',
    formTemplateId: 'FORM-004',
    formName: 'Contract Intake Form',
    requestId: 'REQ-2024-0001',
    stage: 'contracting',
    submittedBy: 'u3',
    submittedAt: '2024-05-10T11:00:00Z',
    status: 'completed',
    values: {
      'f004-contract-type': 'framework',
      'f004-term-months': '36',
      'f004-auto-renewal': true,
      'f004-obligations': 'AWS to provide cloud infrastructure services (EC2, RDS, S3) with 99.99% SLA uptime. Buyer commits to minimum annual spend of EUR 400,000. AWS provides dedicated Technical Account Manager.',
      'f004-sla': 'Compute: 99.99% uptime. Storage: 99.999999999% durability. Support: Enterprise plan with 15-min critical response.',
      'f004-exit-clause': '30-day notice for convenience. Data export assistance for 90 days post-termination at no charge.',
      'f004-liability-cap': 'EUR 2,000,000',
      'f004-ip-ownership': 'na',
      'f004-governing-law': 'german',
      'f004-special-conditions': 'Data residency: all data must remain in EU-West (Frankfurt) region. GDPR DPA required as annex.',
    },
  },

  // ── REQ-2024-0002 (SAP S/4HANA license renewal, completed) ──
  {
    id: 'FSUB-005',
    formTemplateId: 'FORM-001',
    formName: 'Risk Assessment Triage',
    requestId: 'REQ-2024-0002',
    stage: 'validation',
    submittedBy: 'u1',
    submittedAt: '2024-06-05T08:45:00Z',
    status: 'completed',
    values: {
      'f001-registered': 'yes',
      'f001-sra-status': 'yes-valid',
      'f001-annual-spend': '1200000',
      'f001-data-sensitivity': 'critical',
      'f001-premises': 'no',
      'f001-high-risk-jurisdiction': false,
      'f001-notes': 'Existing tier-1 supplier with valid SRA. Renewal of existing contract - no change in scope.',
    },
  },
  {
    id: 'FSUB-006',
    formTemplateId: 'FORM-005',
    formName: 'Budget Approval Form',
    requestId: 'REQ-2024-0002',
    stage: 'approval',
    submittedBy: 'u7',
    submittedAt: '2024-07-12T14:30:00Z',
    status: 'completed',
    values: {
      'f005-budget-code': 'CC-IT-001',
      'f005-gl-account': '6200-00-010',
      'f005-cost-allocation': '100',
      'f005-fiscal-year': '2024',
      'f005-manager-name': 'Sarah Chen',
      'f005-manager-confirmation': true,
    },
  },

  // ── REQ-2024-0003 (Office furniture - Berlin HQ, payment stage) ──
  {
    id: 'FSUB-007',
    formTemplateId: 'FORM-007',
    formName: 'Goods Receipt Confirmation',
    requestId: 'REQ-2024-0003',
    stage: 'receipt',
    submittedBy: 'u6',
    submittedAt: '2024-11-18T09:00:00Z',
    status: 'completed',
    values: {
      'f007-po-ref': 'PO-003',
      'f007-items-description': '120 ergonomic standing desks (Steelcase Ology), 120 task chairs (Herman Miller Aeron), 15 meeting room tables, 30 meeting room chairs, cable management kits.',
      'f007-quantity': '285',
      'f007-condition': 'good',
      'f007-quality-rating': '4',
      'f007-notes': 'All items delivered in two batches. Minor packaging damage on 3 chairs - no functional impact. Assembly completed by supplier team on-site.',
    },
  },

  // ── REQ-2024-0004 (Marketing agency retainer, completed) ──
  {
    id: 'FSUB-008',
    formTemplateId: 'FORM-004',
    formName: 'Contract Intake Form',
    requestId: 'REQ-2024-0004',
    stage: 'contracting',
    submittedBy: 'u4',
    submittedAt: '2024-06-15T10:00:00Z',
    status: 'completed',
    values: {
      'f004-contract-type': 'retainer',
      'f004-term-months': '6',
      'f004-auto-renewal': false,
      'f004-obligations': 'WPP to deliver integrated marketing campaigns covering brand strategy, digital advertising, and event management. Monthly reporting on KPIs and ROAS. Dedicated account team of 5 FTEs.',
      'f004-sla': 'Campaign briefs responded to within 48 hours. Monthly performance reports by 5th business day.',
      'f004-exit-clause': '60-day notice period. All creative assets and campaign data transferred to buyer within 30 days of termination.',
      'f004-liability-cap': '100% of contract value',
      'f004-ip-ownership': 'buyer',
      'f004-governing-law': 'german',
      'f004-special-conditions': 'Exclusivity clause: WPP may not work with direct competitors during the retainer period.',
    },
  },

  // ── REQ-2024-0005 (Data centre security audit, completed, consulting) ──
  {
    id: 'FSUB-009',
    formTemplateId: 'FORM-002',
    formName: 'Full Risk Questionnaire',
    requestId: 'REQ-2024-0005',
    stage: 'validation',
    submittedBy: 'u4',
    submittedAt: '2024-08-05T11:30:00Z',
    status: 'completed',
    values: {
      'f002-legal-entity': 'Deloitte Touche Tohmatsu Limited',
      'f002-country': 'United Kingdom',
      'f002-category': 'consulting',
      'f002-personal-data': 'no',
      'f002-data-volume': 'none',
      'f002-subcontractors': false,
      'f002-bcp': 'Deloitte maintains a comprehensive BCP with RPO < 4 hours and RTO < 8 hours for critical engagement systems. Annual DR tests conducted and documented. Redundant office locations available across the UK.',
      'f002-pi-insurance': 'EUR 50,000,000',
      'f002-certifications': ['iso27001', 'iso9001'],
      'f002-sanctions': 'no',
      'f002-compliance-notes': 'Deloitte is an existing tier-1 supplier with a strong compliance track record. No adverse findings in prior engagements.',
    },
  },

  // ── REQ-2024-0006 (ERP integration middleware, sourcing, software, overdue) ──
  {
    id: 'FSUB-010',
    formTemplateId: 'FORM-006',
    formName: 'IT Security Assessment',
    requestId: 'REQ-2024-0006',
    stage: 'validation',
    submittedBy: 'u3',
    submittedAt: '2024-09-18T16:00:00Z',
    status: 'completed',
    values: {
      'f006-app-name': 'ERP Integration Middleware',
      'f006-data-classification': 'confidential',
      'f006-hosting': 'private-cloud',
      'f006-encryption-rest': 'yes',
      'f006-encryption-transit': 'yes',
      'f006-mfa': 'yes',
      'f006-api-security': 'yes',
      'f006-pen-test': 'no',
      'f006-last-audit': '2024-06-01',
      'f006-security-contact': 'security@middleware-vendor.com',
    },
  },
  {
    id: 'FSUB-011',
    formTemplateId: 'FORM-001',
    formName: 'Risk Assessment Triage',
    requestId: 'REQ-2024-0006',
    stage: 'validation',
    submittedBy: 'u1',
    submittedAt: '2024-09-15T09:30:00Z',
    status: 'completed',
    values: {
      'f001-registered': 'no',
      'f001-sra-status': 'no',
      'f001-annual-spend': '290000',
      'f001-data-sensitivity': 'high',
      'f001-premises': 'no',
      'f001-high-risk-jurisdiction': false,
      'f001-notes': 'New supplier, not yet registered. Full SRA required due to data sensitivity and spend level. Middleware will integrate SAP with Salesforce and handle customer/financial data.',
    },
  },

  // ── REQ-2024-0007 (Contingent workforce - Java devs, approval, overdue) ──
  {
    id: 'FSUB-012',
    formTemplateId: 'FORM-005',
    formName: 'Budget Approval Form',
    requestId: 'REQ-2024-0007',
    stage: 'approval',
    submittedBy: 'u7',
    submittedAt: '2025-01-08T10:00:00Z',
    status: 'in-progress',
    values: {
      'f005-budget-code': 'CC-ENG-002',
      'f005-gl-account': '6400-20-005',
      'f005-cost-allocation': '100',
      'f005-fiscal-year': '2025',
      'f005-manager-name': 'Elena Petrova',
      'f005-manager-confirmation': false,
    },
  },

  // ── REQ-2024-0008 (Managed print services, validation, overdue) ──
  {
    id: 'FSUB-013',
    formTemplateId: 'FORM-001',
    formName: 'Risk Assessment Triage',
    requestId: 'REQ-2024-0008',
    stage: 'validation',
    submittedBy: 'u1',
    submittedAt: '2025-01-06T08:00:00Z',
    status: 'in-progress',
    values: {
      'f001-registered': 'yes',
      'f001-sra-status': 'yes-expiring',
      'f001-annual-spend': '45000',
      'f001-data-sensitivity': 'low',
      'f001-premises': 'yes',
      'f001-high-risk-jurisdiction': false,
      'f001-notes': '',
    },
  },

  // ── REQ-2024-0009 (AI/ML platform - Databricks, referred-back, software) ──
  {
    id: 'FSUB-014',
    formTemplateId: 'FORM-006',
    formName: 'IT Security Assessment',
    requestId: 'REQ-2024-0009',
    stage: 'validation',
    submittedBy: 'u3',
    submittedAt: '2024-10-22T13:00:00Z',
    status: 'completed',
    values: {
      'f006-app-name': 'Databricks Unity Catalog & ML Runtime',
      'f006-data-classification': 'restricted',
      'f006-hosting': 'public-cloud',
      'f006-encryption-rest': 'yes',
      'f006-encryption-transit': 'yes',
      'f006-mfa': 'yes',
      'f006-api-security': 'yes',
      'f006-pen-test': 'yes',
      'f006-last-audit': '2024-08-20',
      'f006-security-contact': 'security@databricks.com',
    },
  },

  // ── REQ-2024-0010 (Corporate travel management, referred-back) ──
  {
    id: 'FSUB-015',
    formTemplateId: 'FORM-008',
    formName: 'Change Request Form',
    requestId: 'REQ-2024-0010',
    stage: 'sourcing',
    submittedBy: 'u4',
    submittedAt: '2025-01-02T11:00:00Z',
    status: 'completed',
    values: {
      'f008-description': 'Expanding RFP scope to include expense management integration with SAP Concur. Original scope only covered booking and policy enforcement. Business stakeholders identified the need for a unified platform during requirements gathering.',
      'f008-reason': 'scope-change',
      'f008-impact': 'Timeline extended by 4 weeks to allow vendors to respond to updated requirements. Budget may increase by 15-20% due to additional integration work. Two additional vendors added to long-list who specialise in integrated travel + expense solutions.',
      'f008-additional-cost': '35000',
      'f008-approval-required': true,
      'f008-documents': '',
    },
  },
];

export function getSubmissionsForRequest(requestId: string): FormSubmission[] {
  return formSubmissions.filter((s) => s.requestId === requestId);
}

export function getSubmissionForStage(
  requestId: string,
  stage: string,
): FormSubmission[] {
  return formSubmissions.filter(
    (s) => s.requestId === requestId && s.stage === stage,
  );
}
