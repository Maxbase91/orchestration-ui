// Shared types + mock seed for intake compliance records.
// The `intakeComplianceRecords` array is seed-only (Wave 2 migrated reads
// to `@/lib/db/hooks/use-intake-compliance`); the record type and module-load
// backfill of `matchingRiskAssessmentIds` still run at import time so the
// seed endpoint gets consistent data.

import { riskAssessments } from './risk-assessments.js';

export interface IntakeComplianceRecord {
  requestId: string;
  determinedAt: string;
  buyingChannel: {
    channel: string;
    label: string;
    reasoning: string;
  };
  sraCheck: {
    status: 'pass' | 'warning' | 'fail' | 'not-applicable';
    detail: string;
  };
  policyChecks: {
    label: string;
    passed: boolean;
    detail: string;
  }[];
  duplicateCheck: {
    found: boolean;
    detail: string;
  };
  riskFlags: string[];
  matchingRiskAssessmentIds?: string[];
}

export const intakeComplianceRecords: IntakeComplianceRecord[] = [
  // REQ-2024-0001 — Cloud hosting migration - AWS
  {
    requestId: 'REQ-2024-0001',
    determinedAt: '2024-03-15T09:10:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€480,000) exceeds €100K threshold and category is Software — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2026-01-31. AWS fully assessed with low risk rating.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'IT capex budget confirmed by budget owner Elena Petrova.' },
      { label: 'Delegated authority', passed: true, detail: 'Value within Head of Engineering delegated authority limit (€500K).' },
      { label: 'Competitive sourcing requirement', passed: true, detail: 'Existing framework agreement — competitive sourcing waived.' },
      { label: 'Data protection assessment', passed: true, detail: 'Cloud hosting requires DPIA — completed and approved by DPO.' },
      { label: 'Business justification', passed: true, detail: 'Justification documented: TCO reduction of 35% and infrastructure end-of-life.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate or similar active requests found for AWS cloud hosting.',
    },
    riskFlags: [],
  },
  // REQ-2024-0002 — SAP S/4HANA license renewal
  {
    requestId: 'REQ-2024-0002',
    determinedAt: '2024-06-01T10:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€1,200,000) exceeds €1M threshold — Procurement-Led Sourcing required with CFO approval.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-12-31. SAP SE fully assessed and compliant.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Pre-approved in annual IT budget by CFO.' },
      { label: 'Delegated authority', passed: true, detail: 'CFO approval obtained for >€1M threshold.' },
      { label: 'Contract renewal policy', passed: true, detail: 'Renewal under existing master agreement — policy compliant.' },
      { label: 'Vendor lock-in review', passed: true, detail: 'SAP concentration risk reviewed — within acceptable limits at 18% of IT spend.' },
      { label: 'Business justification', passed: true, detail: 'Mission-critical ERP — continuity justification accepted.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate requests. Previous SAP renewal (2023) archived.',
    },
    riskFlags: ['High-value contract: requires dual sign-off'],
  },
  // REQ-2024-0003 — Office furniture - Berlin HQ
  {
    requestId: 'REQ-2024-0003',
    determinedAt: '2024-07-20T09:05:00Z',
    buyingChannel: {
      channel: 'framework-call-off',
      label: 'Framework Call-Off',
      reasoning: 'Active framework agreement (CON-015) in place for office furniture. Call-off permitted under existing terms.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-07-31. Iron Mountain (furniture framework) fully assessed.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Facilities capex budget confirmed.' },
      { label: 'Framework agreement validity', passed: true, detail: 'Framework CON-015 active and within call-off limits.' },
      { label: 'Delegated authority', passed: true, detail: 'Value within Facilities Manager authority (€200K).' },
      { label: 'Business justification', passed: true, detail: 'Berlin HQ expansion — 120 workstations required.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate furniture requests found.',
    },
    riskFlags: [],
  },
  // REQ-2024-0004 — Marketing agency retainer Q3-Q4
  {
    requestId: 'REQ-2024-0004',
    determinedAt: '2024-05-10T14:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€320,000) exceeds €100K threshold and category is Services — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-04-30. WPP plc assessed and cleared.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Marketing opex allocation confirmed.' },
      { label: 'Delegated authority', passed: true, detail: 'Value within VP Marketing delegated authority.' },
      { label: 'Consulting/agency engagement policy', passed: true, detail: 'Agency engagement justification and scope documented.' },
      { label: 'Business justification', passed: true, detail: 'Product launch campaign with documented ROAS targets.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No overlapping marketing agency engagements found.',
    },
    riskFlags: ['Rate card last negotiated 18 months ago — renegotiation recommended at renewal'],
  },
  // REQ-2024-0005 — Data centre security audit
  {
    requestId: 'REQ-2024-0005',
    determinedAt: '2024-08-01T07:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Category is Consulting and value (€95,000) requires procurement oversight per consulting engagement policy.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-07-31. Deloitte fully assessed — Big Four provider.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Security & Compliance budget confirmed.' },
      { label: 'Consulting engagement policy', passed: true, detail: 'Scope and deliverables documented per policy.' },
      { label: 'Regulatory requirement', passed: true, detail: 'ISO 27001 certification renewal — mandatory compliance engagement.' },
      { label: 'Business justification', passed: true, detail: 'Annual compliance requirement — external audit mandatory.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate security audit requests. Previous audit completed in 2023.',
    },
    riskFlags: [],
  },
  // REQ-2024-0006 — ERP integration middleware
  {
    requestId: 'REQ-2024-0006',
    determinedAt: '2024-09-10T11:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€290,000) exceeds €100K threshold and category is Software — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'not-applicable',
      detail: 'No supplier selected at intake. SRA will be assessed during supplier evaluation.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'IT budget allocation confirmed for integration project.' },
      { label: 'Competitive sourcing requirement', passed: true, detail: 'RFP required — multiple vendors to be evaluated.' },
      { label: 'Architecture review', passed: true, detail: 'Enterprise architecture team reviewed integration approach.' },
      { label: 'Business justification', passed: true, detail: 'Documented 20+ hours/week of manual rework to be eliminated.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate integration middleware requests.',
    },
    riskFlags: ['Urgent timeline — delivery date at risk', 'Budget revision may be needed based on vendor pricing'],
  },
  // REQ-2024-0007 — Contingent workforce - Java developers
  {
    requestId: 'REQ-2024-0007',
    determinedAt: '2024-10-25T13:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€960,000) exceeds €100K threshold and category is Contingent Labour — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-09-30. Randstad NV assessed and compliant.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: false, detail: 'Budget pending confirmation from programme board.' },
      { label: 'Delegated authority', passed: true, detail: 'Requires VP-level approval for contingent labour >€500K.' },
      { label: 'Contingent labour policy', passed: true, detail: 'Headcount justification provided — 8 senior Java developers.' },
      { label: 'IR35/employment status', passed: true, detail: 'Status determination assessments to be completed by supplier.' },
      { label: 'Business justification', passed: true, detail: 'Digital transformation programme critically understaffed.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate contingent labour requests for Java developers.',
    },
    riskFlags: ['Urgent: timeline at risk without developers by end of January', 'High value contingent labour — programme board approval pending'],
  },
  // REQ-2024-0008 — Managed print services renewal
  {
    requestId: 'REQ-2024-0008',
    determinedAt: '2024-11-01T09:20:00Z',
    buyingChannel: {
      channel: 'business-led',
      label: 'Business-Led Purchase',
      reasoning: 'Value (€45,000) is below €50K threshold — Business-Led Purchase channel applicable for contract renewal.',
    },
    sraCheck: {
      status: 'warning',
      detail: 'Supplier SRA expiring on 2025-01-31. Renewal should be initiated before contract renewal.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Facilities budget allocation confirmed.' },
      { label: 'Contract renewal policy', passed: true, detail: 'Existing contract under review for renewal terms.' },
      { label: 'Usage data review', passed: false, detail: 'Print usage data not yet provided by IT — required for right-sizing contract.' },
      { label: 'Business justification', passed: true, detail: 'Operational continuity — print services across 12 offices.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate managed print requests.',
    },
    riskFlags: ['SRA expiring — supplier assessment renewal needed', 'Stalled: awaiting usage data from IT department'],
  },
  // REQ-2024-0009 — AI/ML platform subscription - Databricks
  {
    requestId: 'REQ-2024-0009',
    determinedAt: '2024-10-15T10:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€380,000) exceeds €100K threshold and category is Software — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'fail',
      detail: 'New supplier — SRA not yet assessed. Databricks onboarding and risk assessment required.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Data team budget allocation confirmed.' },
      { label: 'New supplier onboarding', passed: false, detail: 'Databricks not yet onboarded — requires screening and SRA completion.' },
      { label: 'Competitive evaluation', passed: false, detail: 'ROI analysis vs Azure ML required before proceeding.' },
      { label: 'Data security assessment', passed: true, detail: 'DPIA initiated for data analytics platform.' },
      { label: 'Business justification', passed: true, detail: 'Unified ML pipeline needed — 40% development time reduction documented.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate data analytics platform requests.',
    },
    riskFlags: ['New supplier — onboarding not complete', 'Competitive evaluation with Azure ML outstanding'],
  },
  // REQ-2024-0010 — Corporate travel management
  {
    requestId: 'REQ-2024-0010',
    determinedAt: '2024-11-05T11:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€210,000) exceeds €100K threshold and category is Services — Procurement-Led Sourcing with RFP required.',
    },
    sraCheck: {
      status: 'not-applicable',
      detail: 'No supplier selected at intake. SRA will be assessed during supplier evaluation.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'HR operations budget confirmed.' },
      { label: 'Competitive sourcing requirement', passed: true, detail: 'RFP required — minimum 3 TMC providers to be evaluated.' },
      { label: 'Scope definition', passed: false, detail: 'Geographic scope unclear — EU only or including APAC to be clarified.' },
      { label: 'Business justification', passed: true, detail: 'Current TMC contract ending — 15% cost reduction target documented.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate travel management requests.',
    },
    riskFlags: ['Scope clarification needed before sourcing can proceed'],
  },
  // REQ-2024-0011 — Cyber insurance policy renewal
  {
    requestId: 'REQ-2024-0011',
    determinedAt: '2024-11-20T08:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€125,000) exceeds €100K threshold and category is Services (Insurance) — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'not-applicable',
      detail: 'Insurance broker relationship — standard SRA not applicable for insurance policies.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Risk management budget confirmed.' },
      { label: 'Board mandate compliance', passed: true, detail: 'Board directive to increase cyber coverage from €5M to €10M documented.' },
      { label: 'Insurance broker review', passed: true, detail: 'Broker-led process with competitive market review.' },
      { label: 'Business justification', passed: true, detail: 'Board-mandated coverage increase following industry incidents.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate cyber insurance requests. Previous policy renewal archived.',
    },
    riskFlags: ['35% premium increase may require board-level approval'],
  },
  // REQ-2024-0012 — Warehouse racking system - Munich
  {
    requestId: 'REQ-2024-0012',
    determinedAt: '2024-12-01T09:20:00Z',
    buyingChannel: {
      channel: 'business-led',
      label: 'Business-Led Purchase',
      reasoning: 'Value (€88,000) is below €100K threshold — Business-Led Purchase channel applicable for goods procurement.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-10-31. Jungheinrich AG assessed and compliant.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Logistics capex budget confirmed.' },
      { label: 'Health & safety review', passed: false, detail: 'H&S safety specifications require revision per safety review team.' },
      { label: 'Technical specifications', passed: true, detail: 'Racking specifications documented by warehouse operations team.' },
      { label: 'Business justification', passed: true, detail: 'New warehouse space requires racking before operational launch.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate warehouse racking requests.',
    },
    riskFlags: ['H&S specs revision required before sourcing can proceed'],
  },
  // REQ-2024-0013 — Microsoft 365 E5 license upgrade
  {
    requestId: 'REQ-2024-0013',
    determinedAt: '2024-10-20T10:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€720,000) exceeds €100K threshold and category is Software — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-11-30. Microsoft fully assessed with low risk rating.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'IT budget allocation confirmed for license upgrade.' },
      { label: 'Delegated authority', passed: true, detail: 'Value within IT Director delegated authority (€1M).' },
      { label: 'License management review', passed: true, detail: 'License count validated against active directory — 2,000 users confirmed.' },
      { label: 'Compliance requirement', passed: true, detail: 'E5 security features required for new data protection regulations.' },
      { label: 'Business justification', passed: true, detail: 'Regulatory compliance driver — effective April 2025.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate Microsoft license requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0014 — Consulting - Org design transformation
  {
    requestId: 'REQ-2024-0014',
    determinedAt: '2024-11-15T14:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€1,850,000) exceeds €1M threshold — Procurement-Led Sourcing required with dual VP approval.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-12-31. McKinsey & Company fully assessed.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Strategy budget confirmed by CEO sponsor.' },
      { label: 'Delegated authority', passed: false, detail: 'Value exceeds €1M — requires dual VP procurement approval. Pending.' },
      { label: 'Consulting engagement policy', passed: true, detail: 'CEO-sponsored engagement with defined scope and deliverables.' },
      { label: 'Sole source justification', passed: true, detail: 'McKinsey selected based on prior transformation expertise — justification documented.' },
      { label: 'Business justification', passed: true, detail: 'CEO-sponsored — €20M cost reduction target documented.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate transformation consulting requests.',
    },
    riskFlags: ['High-value engagement: dual VP approval required', 'Urgent: CEO-sponsored with tight timeline'],
  },
  // REQ-2024-0015 — Catering services - Frankfurt campus
  {
    requestId: 'REQ-2024-0015',
    determinedAt: '2024-11-01T08:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€250,000) exceeds €100K threshold and category is Services — Procurement-Led Sourcing with RFP required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Incumbent supplier SRA valid until 2025-06-30. Sodexo assessed and compliant.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Facilities budget confirmed.' },
      { label: 'Competitive sourcing requirement', passed: true, detail: 'RFP issued to 4 catering providers per policy.' },
      { label: 'Food safety compliance', passed: true, detail: 'ISO 22000 certification required in RFP.' },
      { label: 'Business justification', passed: true, detail: 'Current contract ending — quality improvement and cost savings targeted.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate catering services requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0016 — Laptop refresh programme 2025
  {
    requestId: 'REQ-2024-0016',
    determinedAt: '2024-10-01T09:20:00Z',
    buyingChannel: {
      channel: 'catalogue',
      label: 'Catalogue Purchase',
      reasoning: 'Goods available on approved catalogue. Lenovo ThinkPad X1 Carbon on IT hardware catalogue with pre-negotiated pricing.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-06-30. Lenovo assessed and compliant.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'IT hardware refresh allocation confirmed.' },
      { label: 'Catalogue compliance', passed: true, detail: 'Items on approved product catalogue — pre-negotiated pricing applies.' },
      { label: 'Asset lifecycle policy', passed: true, detail: 'Devices over 3 years old qualify for scheduled refresh.' },
      { label: 'Delegated authority', passed: true, detail: 'IT Director authority for catalogue purchases up to €750K.' },
      { label: 'Business justification', passed: true, detail: 'Standard 3-year hardware refresh — 40% higher failure rate documented.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate laptop refresh requests for current cycle.',
    },
    riskFlags: [],
  },
  // REQ-2024-0017 — KPMG tax advisory services
  {
    requestId: 'REQ-2024-0017',
    determinedAt: '2024-07-15T10:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€180,000) exceeds €100K threshold and category is Consulting — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-06-30. KPMG fully assessed — Big Four provider.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Finance advisory budget confirmed.' },
      { label: 'Consulting engagement policy', passed: true, detail: 'Scope and deliverables documented per policy.' },
      { label: 'Delegated authority', passed: false, detail: 'VP approval required per consulting policy — not yet documented in system.' },
      { label: 'Incumbent justification', passed: true, detail: 'KPMG has deep knowledge of company structure — sole source justified.' },
      { label: 'Business justification', passed: true, detail: 'Mandatory transfer pricing documentation for 12 jurisdictions.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate tax advisory requests.',
    },
    riskFlags: ['VP approval for consulting engagement not yet documented'],
  },
  // REQ-2024-0018 — Records management - Iron Mountain
  {
    requestId: 'REQ-2024-0018',
    determinedAt: '2024-10-10T07:20:00Z',
    buyingChannel: {
      channel: 'direct-po',
      label: 'Direct PO',
      reasoning: 'Value (€35,000) is below €50K Direct PO threshold with existing contract in place.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-07-31. Iron Mountain assessed and compliant.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Legal operations budget confirmed.' },
      { label: 'Direct PO threshold', passed: true, detail: 'Value within €50K direct PO limit. No competitive sourcing required.' },
      { label: 'Contract coverage', passed: true, detail: 'Active SLA (CON-012) in place for records management.' },
      { label: 'Regulatory requirement', passed: true, detail: '7-year retention requirement documented.' },
      { label: 'Business justification', passed: true, detail: 'Regulatory compliance — physical records retention mandate.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate records management requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0019 — Supplier onboarding - TechBridge Solutions
  {
    requestId: 'REQ-2024-0019',
    determinedAt: '2024-12-10T11:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Supplier onboarding — all new supplier onboarding follows Procurement-Led process per policy.',
    },
    sraCheck: {
      status: 'fail',
      detail: 'New supplier — SRA not yet assessed. Risk assessment and screening in progress.',
    },
    policyChecks: [
      { label: 'Supplier screening', passed: false, detail: 'Sanctions and compliance screening pending.' },
      { label: 'Risk assessment', passed: false, detail: 'Coupa Risk Assess in progress — supplier profile being created.' },
      { label: 'CTO recommendation', passed: true, detail: 'CTO recommendation documented for cloud-native expertise.' },
      { label: 'Supplier diversity', passed: true, detail: 'Adds geographic diversity to IT consulting panel (India-based).' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No existing supplier with matching capabilities on panel.',
    },
    riskFlags: ['New supplier — high risk rating pending full assessment', 'Screening and SRA not yet complete'],
  },
  // REQ-2024-0020 — Cleaning services - all DE offices
  {
    requestId: 'REQ-2024-0020',
    determinedAt: '2024-11-15T09:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€180,000) exceeds €100K threshold — Procurement-Led Sourcing required for consolidation RFP.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Incumbent supplier SRA valid until 2025-06-30. Sodexo assessed and compliant.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Facilities budget confirmed across all German offices.' },
      { label: 'Competitive sourcing requirement', passed: true, detail: 'Consolidation RFP in progress per policy.' },
      { label: 'Sustainability criteria', passed: true, detail: 'Green cleaning products requirement included in RFP.' },
      { label: 'Business justification', passed: true, detail: 'Consolidation of 8 local contracts — 20% savings expected.' },
    ],
    duplicateCheck: {
      found: true,
      detail: 'Partial overlap with individual office cleaning contracts — consolidation replaces these.',
    },
    riskFlags: [],
  },
  // REQ-2024-0021 — Capgemini - DevOps transformation
  {
    requestId: 'REQ-2024-0021',
    determinedAt: '2024-10-05T10:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€450,000) exceeds €100K threshold and category is Consulting — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'warning',
      detail: 'Supplier SRA expiring on 2025-02-28. Renewal should be initiated before contract execution.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Engineering budget allocation confirmed.' },
      { label: 'Consulting engagement policy', passed: true, detail: 'DevOps assessment scope and deliverables documented.' },
      { label: 'IP ownership review', passed: false, detail: 'IP ownership terms to be negotiated — standard Capgemini terms may conflict with company policy.' },
      { label: 'Business justification', passed: true, detail: 'Engineering velocity improvement — release cycle time reduction.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate DevOps consulting engagements.',
    },
    riskFlags: ['Supplier SRA expiring soon — renewal needed', 'IP ownership negotiation required'],
  },
  // REQ-2024-0022 — Employee benefits platform
  {
    requestId: 'REQ-2024-0022',
    determinedAt: '2025-01-02T10:20:00Z',
    buyingChannel: {
      channel: 'business-led',
      label: 'Business-Led Purchase',
      reasoning: 'Value (€65,000) is below €100K threshold — Business-Led Purchase channel applicable for SaaS software.',
    },
    sraCheck: {
      status: 'not-applicable',
      detail: 'No supplier selected at intake. SRA will be assessed during supplier evaluation.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'HR operations budget confirmed.' },
      { label: 'Data protection assessment', passed: false, detail: 'DPIA required for employee PII processing — not yet initiated.' },
      { label: 'IT security review', passed: false, detail: 'SaaS platform security assessment pending.' },
      { label: 'Business justification', passed: true, detail: 'Spreadsheet-based process to be replaced — 60% admin time reduction.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No existing benefits administration platform.',
    },
    riskFlags: ['DPIA required for employee data processing'],
  },
  // REQ-2024-0023 — Siemens IoT sensors - factory floor
  {
    requestId: 'REQ-2024-0023',
    determinedAt: '2024-11-25T09:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€140,000) exceeds €100K threshold and category is Goods — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-10-31. Siemens AG assessed with low risk rating.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Manufacturing capex budget confirmed.' },
      { label: 'Technical specifications', passed: true, detail: 'IoT sensor specifications validated by engineering team.' },
      { label: 'Delegated authority', passed: true, detail: 'Value within Manufacturing Director authority.' },
      { label: 'Business justification', passed: true, detail: 'Predictive maintenance — €1.2M annual savings projected.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate IoT sensor procurement requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0024 — Hays - Finance temp staff Q1
  {
    requestId: 'REQ-2024-0024',
    determinedAt: '2024-12-05T08:20:00Z',
    buyingChannel: {
      channel: 'framework-call-off',
      label: 'Framework Call-Off',
      reasoning: 'Active framework agreement (CON-014) in place for contingent labour. Call-off permitted under existing terms.',
    },
    sraCheck: {
      status: 'warning',
      detail: 'Supplier SRA valid but expiring in 45 days (2025-02-25). Renewal should be initiated.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Finance temporary staffing budget confirmed.' },
      { label: 'Framework agreement validity', passed: true, detail: 'Framework CON-014 active — call-off terms apply.' },
      { label: 'Contingent labour policy', passed: true, detail: 'Justification documented — year-end close and audit support.' },
      { label: 'Urgency justification', passed: true, detail: 'Urgent request justified — year-end close timeline constraint.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate finance temp staff requests for Q1.',
    },
    riskFlags: ['Urgent request — SRA expiring soon', 'Year-end dependency — delay impacts audit timeline'],
  },
  // REQ-2024-0025 — Bosch automotive components
  {
    requestId: 'REQ-2024-0025',
    determinedAt: '2024-12-15T10:20:00Z',
    buyingChannel: {
      channel: 'direct-po',
      label: 'Direct PO',
      reasoning: 'Value (€28,000) is below €50K Direct PO threshold with existing supplier relationship.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-08-31. Robert Bosch GmbH assessed with low risk rating.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'R&D budget confirmed.' },
      { label: 'Direct PO threshold', passed: true, detail: 'Value within €50K direct PO limit.' },
      { label: 'Sole source justification', passed: false, detail: 'Sole source justification under review — Bosch unique specifications to be validated.' },
      { label: 'Business justification', passed: true, detail: 'R&D prototyping — next-gen product development.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate Bosch component requests.',
    },
    riskFlags: ['Sole source justification pending validation'],
  },
  // REQ-2024-0026 — Corporate event venue - annual summit
  {
    requestId: 'REQ-2024-0026',
    determinedAt: '2025-01-06T14:10:00Z',
    buyingChannel: {
      channel: 'business-led',
      label: 'Business-Led Purchase',
      reasoning: 'Value (€95,000) is below €100K threshold — Business-Led Purchase channel for event management.',
    },
    sraCheck: {
      status: 'not-applicable',
      detail: 'No supplier selected at draft stage.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Executive operations budget confirmed.' },
      { label: 'Event management policy', passed: true, detail: 'Annual summit — standard event procurement process applies.' },
      { label: 'Business justification', passed: true, detail: 'Annual leadership summit for 300 attendees.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate event venue requests for 2025 summit.',
    },
    riskFlags: ['Early booking needed for venue availability'],
  },
  // REQ-2024-0027 — Accenture - Cloud strategy advisory
  {
    requestId: 'REQ-2024-0027',
    determinedAt: '2025-01-03T09:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€350,000) exceeds €100K threshold and category is Consulting — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-09-30. Accenture fully assessed with low risk rating.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'IT strategy budget confirmed.' },
      { label: 'Consulting engagement policy', passed: true, detail: 'Board directive documented — multi-cloud strategy development.' },
      { label: 'Delegated authority', passed: true, detail: 'Value within IT Director authority.' },
      { label: 'Business justification', passed: true, detail: 'Board directive — multi-cloud architecture strategy.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate cloud strategy advisory requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0028 — Network switches - office refresh
  {
    requestId: 'REQ-2024-0028',
    determinedAt: '2024-11-20T10:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€160,000) exceeds €100K threshold and category is Goods — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'not-applicable',
      detail: 'Multiple vendors being evaluated (Cisco, Juniper, Arista). SRA to be confirmed for selected vendor.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'IT infrastructure budget confirmed.' },
      { label: 'Competitive sourcing requirement', passed: true, detail: 'RFQ issued to 3 network equipment vendors.' },
      { label: 'End-of-life assessment', passed: true, detail: 'Current switches reach end-of-support Q2 2025 — replacement justified.' },
      { label: 'Business justification', passed: true, detail: 'Security risk from unsupported equipment documented.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate network switch procurement requests.',
    },
    riskFlags: ['Security risk: current switches reaching end-of-support'],
  },
  // REQ-2024-0029 — Supplier onboarding - GreenEnergy GmbH
  {
    requestId: 'REQ-2024-0029',
    determinedAt: '2025-01-05T11:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Supplier onboarding — all new supplier onboarding follows Procurement-Led process per policy.',
    },
    sraCheck: {
      status: 'fail',
      detail: 'New supplier — SRA not yet assessed. Initial risk assessment required.',
    },
    policyChecks: [
      { label: 'Supplier screening', passed: false, detail: 'Sanctions and compliance screening pending.' },
      { label: 'Sustainability certification', passed: true, detail: 'ISO 14001 and Gold Standard VER certifications verified.' },
      { label: 'Sustainability team endorsement', passed: true, detail: 'Identified by sustainability team for carbon offset programme.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No existing renewable energy supplier on panel.',
    },
    riskFlags: ['New supplier — screening and SRA not yet started'],
  },
  // REQ-2024-0030 — Cushman & Wakefield - Facilities management
  {
    requestId: 'REQ-2024-0030',
    determinedAt: '2024-09-20T09:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€890,000) exceeds €100K threshold and category is Services — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'warning',
      detail: 'Supplier SRA valid until 2025-05-31. Expiring within 6 months — renewal flagged.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Facilities budget confirmed for London and Amsterdam.' },
      { label: 'Competitive sourcing requirement', passed: true, detail: 'Competitive tender completed — C&W selected.' },
      { label: 'Delegated authority', passed: true, detail: 'VP Procurement approval obtained.' },
      { label: 'SLA review', passed: true, detail: 'Service level agreement schedules reviewed and agreed.' },
      { label: 'Business justification', passed: true, detail: 'FM consolidation — 12% cost reduction documented.' },
    ],
    duplicateCheck: {
      found: true,
      detail: 'Replaces separate London and Amsterdam FM contracts — consolidation.',
    },
    riskFlags: ['Supplier SRA expiring in 6 months — renewal needed'],
  },
  // REQ-2024-0031 — CRM platform - Salesforce expansion
  {
    requestId: 'REQ-2024-0031',
    determinedAt: '2024-12-01T10:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€540,000) exceeds €100K threshold and category is Software — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-11-30. Salesforce fully assessed.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Sales operations budget confirmed.' },
      { label: 'License management review', passed: true, detail: '200 additional licenses validated against headcount plan.' },
      { label: 'Data protection assessment', passed: true, detail: 'Service Cloud DPIA completed for customer data processing.' },
      { label: 'Delegated authority', passed: true, detail: 'Value within Sales VP authority.' },
      { label: 'Business justification', passed: true, detail: 'Sales team growth and customer support workflow unification.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate Salesforce license requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0032 — Lab equipment - chemical analysers
  {
    requestId: 'REQ-2024-0032',
    determinedAt: '2025-01-07T15:10:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€420,000) exceeds €100K threshold and category is Goods — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'not-applicable',
      detail: 'No supplier selected at draft stage. SRA will be assessed during sourcing.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Quality control capex budget confirmed.' },
      { label: 'Technical specifications', passed: true, detail: 'Mass spectrometer specs validated by lab director.' },
      { label: 'Competitive sourcing requirement', passed: true, detail: 'Minimum 3 vendors to be evaluated.' },
      { label: 'Business justification', passed: true, detail: 'Lab capacity expansion — 2-week backlog on test requests.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate lab equipment requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0033 — Randstad - IT helpdesk staff
  {
    requestId: 'REQ-2024-0033',
    determinedAt: '2024-10-15T09:20:00Z',
    buyingChannel: {
      channel: 'framework-call-off',
      label: 'Framework Call-Off',
      reasoning: 'Active framework agreement (CON-013) for IT contingent labour. Call-off permitted under existing terms.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-09-30. Randstad NV assessed and compliant.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'IT operations budget confirmed.' },
      { label: 'Framework agreement validity', passed: true, detail: 'Framework CON-013 active — call-off terms apply.' },
      { label: 'Contingent labour policy', passed: true, detail: 'Headcount justification — 6 L1/L2 support technicians.' },
      { label: 'SLA performance review', passed: true, detail: 'Current helpdesk SLA at 72% vs 95% target — staff augmentation justified.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate IT helpdesk staffing requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0034 — Translation services - product docs
  {
    requestId: 'REQ-2024-0034',
    determinedAt: '2025-01-04T10:20:00Z',
    buyingChannel: {
      channel: 'business-led',
      label: 'Business-Led Purchase',
      reasoning: 'Value (€18,000) is below €50K threshold — Business-Led Purchase channel applicable.',
    },
    sraCheck: {
      status: 'not-applicable',
      detail: 'No supplier selected at intake. Translation agency to be identified.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Product operations budget confirmed.' },
      { label: 'Scope definition', passed: true, detail: '8 European languages identified with page estimates.' },
      { label: 'Regulatory requirement', passed: true, detail: 'Localised documentation required for EU market compliance.' },
      { label: 'Business justification', passed: true, detail: 'Market expansion — regulatory requirement for localised docs.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate translation service requests.',
    },
    riskFlags: [],
  },
  // REQ-2024-0035 — Deloitte - Internal audit co-source
  {
    requestId: 'REQ-2024-0035',
    determinedAt: '2024-09-15T09:20:00Z',
    buyingChannel: {
      channel: 'procurement-led',
      label: 'Procurement-Led Sourcing',
      reasoning: 'Value (€275,000) exceeds €100K threshold and category is Consulting — Procurement-Led Sourcing required.',
    },
    sraCheck: {
      status: 'pass',
      detail: 'Supplier SRA valid until 2025-07-31. Deloitte fully assessed — Big Four provider.',
    },
    policyChecks: [
      { label: 'Budget pre-approval', passed: true, detail: 'Audit function budget confirmed.' },
      { label: 'Consulting engagement policy', passed: true, detail: 'Co-sourcing model scope and deliverables documented.' },
      { label: 'Independence review', passed: true, detail: 'Audit independence requirements reviewed and cleared.' },
      { label: 'Business justification', passed: true, detail: 'Supplement internal audit team capacity for FY2025 audit plan.' },
    ],
    duplicateCheck: {
      found: false,
      detail: 'No duplicate internal audit co-sourcing requests.',
    },
    riskFlags: [],
  },
];

// Back-fill matchingRiskAssessmentIds from RiskAssessment.linkedRequestIds so seed records
// reflect the new entity without each being touched by hand.
for (const record of intakeComplianceRecords) {
  if (record.matchingRiskAssessmentIds && record.matchingRiskAssessmentIds.length > 0) continue;
  const matches = riskAssessments
    .filter((ra) => ra.reusable && ra.status === 'completed' && ra.linkedRequestIds.includes(record.requestId))
    .map((ra) => ra.id);
  if (matches.length > 0) {
    record.matchingRiskAssessmentIds = matches;
  }
}

export function getIntakeCompliance(requestId: string): IntakeComplianceRecord | undefined {
  return intakeComplianceRecords.find((r) => r.requestId === requestId);
}
