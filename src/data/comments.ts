// Seed data only — not read by the runtime app.
// Comments moved to Supabase in Wave 1.

import type { Comment } from './types';

export const comments: Comment[] = [
  // REQ-2024-0001 (Cloud hosting migration - AWS) - completed
  { id: 'CMT-001', requestId: 'REQ-2024-0001', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Submitting request for AWS cloud migration. We have completed the technical assessment and AWS Well-Architected Review. Attached is the migration plan.', timestamp: '2024-03-15T09:05:00Z', isInternal: false, attachments: ['migration-plan-v2.pdf'] },
  { id: 'CMT-002', requestId: 'REQ-2024-0001', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Reviewed the migration plan. Looks solid. Moving to validation. Will check against existing cloud contracts.', timestamp: '2024-03-16T10:30:00Z', isInternal: true },
  { id: 'CMT-003', requestId: 'REQ-2024-0001', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Validated against AWS Enterprise Agreement. Reserved Instance pricing confirmed. Routing to finance approval.', timestamp: '2024-03-20T14:00:00Z', isInternal: true },
  { id: 'CMT-004', requestId: 'REQ-2024-0001', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Final migration report attached. All workloads running stable for 30 days. Request can be closed.', timestamp: '2024-10-02T14:30:00Z', isInternal: false, attachments: ['migration-completion-report.pdf'] },

  // REQ-2024-0002 (SAP license renewal) - completed
  { id: 'CMT-005', requestId: 'REQ-2024-0002', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Annual SAP renewal due. Current contract terms attached. Requesting same user count with maintenance.', timestamp: '2024-06-01T10:15:00Z', isInternal: false },
  { id: 'CMT-006', requestId: 'REQ-2024-0002', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Negotiated 5% volume discount on maintenance. Total savings of €60K vs. list price. Proceeding to approval.', timestamp: '2024-07-15T11:00:00Z', isInternal: true },

  // REQ-2024-0003 (Office furniture) - payment
  { id: 'CMT-007', requestId: 'REQ-2024-0003', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Berlin HQ expansion requires 120 workstations. Preferred ergonomic specs attached.', timestamp: '2024-07-20T09:00:00Z', isInternal: false, attachments: ['furniture-specs.xlsx'] },
  { id: 'CMT-008', requestId: 'REQ-2024-0003', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'Using existing framework agreement. Pricing confirmed with supplier. All items delivered and inspected.', timestamp: '2024-11-18T10:00:00Z', isInternal: true },

  // REQ-2024-0004 (Marketing agency retainer) - completed
  { id: 'CMT-009', requestId: 'REQ-2024-0004', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Need to extend WPP retainer for Q3 and Q4. They delivered strong results last quarter with 3.2x ROAS on digital campaigns.', timestamp: '2024-05-10T14:15:00Z', isInternal: false },
  { id: 'CMT-010', requestId: 'REQ-2024-0004', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Reviewed WPP performance metrics. Recommend proceeding. Their team knows our brand well and switching cost would be significant.', timestamp: '2024-05-15T09:30:00Z', isInternal: true },

  // REQ-2024-0005 (Data centre security audit) - completed
  { id: 'CMT-011', requestId: 'REQ-2024-0005', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Annual security audit required for ISO 27001 recertification. Deloitte performed last 3 years — prefer continuity for comparative analysis.', timestamp: '2024-08-01T07:15:00Z', isInternal: false },
  { id: 'CMT-012', requestId: 'REQ-2024-0005', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Audit completed. No critical findings. 3 medium and 7 low-risk items identified. Remediation plan in progress.', timestamp: '2024-11-28T16:00:00Z', isInternal: false, attachments: ['audit-findings-summary.pdf'] },

  // REQ-2024-0006 (ERP integration middleware) - overdue/sourcing
  { id: 'CMT-013', requestId: 'REQ-2024-0006', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Current manual integration causing significant rework. Need middleware urgently to connect SAP, Salesforce, and microservices.', timestamp: '2024-09-10T11:15:00Z', isInternal: false },
  { id: 'CMT-014', requestId: 'REQ-2024-0006', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Shortlisted MuleSoft, Dell Boomi, and Microsoft Azure Integration Services. RFP sent to all three.', timestamp: '2024-10-20T14:00:00Z', isInternal: true },
  { id: 'CMT-015', requestId: 'REQ-2024-0006', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'RFP responses received. MuleSoft strongest on features but 30% over budget. Negotiating. This is causing the delay.', timestamp: '2024-12-15T10:00:00Z', isInternal: true },
  { id: 'CMT-016', requestId: 'REQ-2024-0006', authorId: 'u11', authorName: 'Christine Dupont', authorInitials: 'CD', content: 'This request is now overdue. Sarah, please provide an updated timeline and escalation path by end of week.', timestamp: '2025-01-05T09:00:00Z', isInternal: true },

  // REQ-2024-0007 (Java developers) - overdue/approval
  { id: 'CMT-017', requestId: 'REQ-2024-0007', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Digital transformation programme critically understaffed. We need 8 senior Java developers starting January at the latest.', timestamp: '2024-10-25T13:15:00Z', isInternal: false },
  { id: 'CMT-018', requestId: 'REQ-2024-0007', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'Randstad can provide candidates within 2 weeks of approval. Using existing framework rates. Waiting on finance approval — flagged as urgent.', timestamp: '2024-11-15T11:00:00Z', isInternal: true },
  { id: 'CMT-019', requestId: 'REQ-2024-0007', authorId: 'u7', authorName: 'Dr. Katrin Bauer', authorInitials: 'KB', content: 'Budget allocation needs confirmation from the programme board. I cannot approve until headcount is formally sanctioned.', timestamp: '2024-12-10T15:00:00Z', isInternal: true },

  // REQ-2024-0009 (Databricks) - referred-back
  { id: 'CMT-020', requestId: 'REQ-2024-0009', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Data science team needs Databricks for unified ML pipeline. Current tool fragmentation adds 40% to development time.', timestamp: '2024-10-15T10:15:00Z', isInternal: false },
  { id: 'CMT-021', requestId: 'REQ-2024-0009', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Referred back: need clearer ROI analysis and comparison with existing Azure ML capabilities before we can proceed with sourcing.', timestamp: '2024-12-20T14:00:00Z', isInternal: false },
  { id: 'CMT-022', requestId: 'REQ-2024-0009', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Updated business case attached with detailed ROI analysis. Databricks outperforms Azure ML by 3x on our specific workloads.', timestamp: '2025-01-03T14:00:00Z', isInternal: false, attachments: ['databricks-roi-analysis-v2.xlsx'] },

  // REQ-2024-0010 (Corporate travel) - referred-back
  { id: 'CMT-023', requestId: 'REQ-2024-0010', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Current TMC contract ending. Need new provider with better booking platform and expense integration.', timestamp: '2024-11-05T11:15:00Z', isInternal: false },
  { id: 'CMT-024', requestId: 'REQ-2024-0010', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Referred back: please clarify scope — are we including APAC offices or EU only? This significantly impacts the value and supplier selection.', timestamp: '2024-12-15T10:00:00Z', isInternal: false },
  { id: 'CMT-025', requestId: 'REQ-2024-0010', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Shortlisted 3 TMCs. Scheduling demos for next week. Will update after evaluation.', timestamp: '2025-01-06T09:15:00Z', isInternal: true },

  // REQ-2024-0011 (Cyber insurance) - referred-back
  { id: 'CMT-026', requestId: 'REQ-2024-0011', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Board mandate to increase cyber coverage from €5M to €10M. Need to start renewal process with broker.', timestamp: '2024-11-20T08:15:00Z', isInternal: false },
  { id: 'CMT-027', requestId: 'REQ-2024-0011', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'Broker provided updated quotes. Premium increase of 35% for doubled coverage. Need finance sign-off on increased premium before proceeding.', timestamp: '2025-01-03T11:00:00Z', isInternal: false },
  { id: 'CMT-028', requestId: 'REQ-2024-0011', authorId: 'u7', authorName: 'Dr. Katrin Bauer', authorInitials: 'KB', content: 'Referred back: 35% premium increase needs board-level approval per financial authority matrix. Please prepare board paper.', timestamp: '2025-01-06T12:00:00Z', isInternal: true },

  // REQ-2024-0012 (Warehouse racking) - referred-back
  { id: 'CMT-029', requestId: 'REQ-2024-0012', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'New Munich warehouse needs racking system installed before April operational launch.', timestamp: '2024-12-01T09:15:00Z', isInternal: false },
  { id: 'CMT-030', requestId: 'REQ-2024-0012', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'Referred back: H&S team flagged specifications. Load capacity needs recalculation for heavy goods. Please revise specs with warehouse manager.', timestamp: '2025-01-08T10:00:00Z', isInternal: false },

  // REQ-2024-0013 (Microsoft 365 E5) - contracting
  { id: 'CMT-031', requestId: 'REQ-2024-0013', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'E5 upgrade needed for advanced security features. New data protection regulations effective April 2025.', timestamp: '2024-10-20T10:15:00Z', isInternal: false },
  { id: 'CMT-032', requestId: 'REQ-2024-0013', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Microsoft agreed to transition pricing: E3 to E5 at 15% discount for first year. Contract amendment in review with legal.', timestamp: '2025-01-04T11:00:00Z', isInternal: true },

  // REQ-2024-0014 (McKinsey org design) - approval
  { id: 'CMT-033', requestId: 'REQ-2024-0014', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'CEO-sponsored transformation. McKinsey has been selected based on their proprietary OrgSolutions methodology and prior successful engagements.', timestamp: '2024-11-15T14:15:00Z', isInternal: false },
  { id: 'CMT-034', requestId: 'REQ-2024-0014', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Scope validated. This exceeds €1M threshold — requires dual VP approval per delegation of authority matrix.', timestamp: '2024-12-20T16:00:00Z', isInternal: true },

  // REQ-2024-0015 (Catering services) - sourcing
  { id: 'CMT-035', requestId: 'REQ-2024-0015', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Current caterer contract ending March 2025. Employee satisfaction survey showed 62% dissatisfied with food quality.', timestamp: '2024-11-01T08:15:00Z', isInternal: false },
  { id: 'CMT-036', requestId: 'REQ-2024-0015', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'RFP issued to 4 caterers: Sodexo, Compass Group, Aramark, and a local provider. Response deadline 15 Jan.', timestamp: '2024-12-10T14:00:00Z', isInternal: true },

  // REQ-2024-0016 (Laptop refresh) - PO stage
  { id: 'CMT-037', requestId: 'REQ-2024-0016', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Standard 3-year refresh cycle. IT asset register identifies 350 devices over 3 years old with increasing failure rates.', timestamp: '2024-10-01T09:15:00Z', isInternal: false },
  { id: 'CMT-038', requestId: 'REQ-2024-0016', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'PO submitted to Lenovo via catalogue. Expected delivery in batches: 200 units Feb, 150 units March.', timestamp: '2024-12-20T10:30:00Z', isInternal: true },

  // REQ-2024-0017 (KPMG tax advisory) - invoice
  { id: 'CMT-039', requestId: 'REQ-2024-0017', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Transfer pricing documentation needed for 12 jurisdictions ahead of tax year-end filing deadlines.', timestamp: '2024-07-15T10:15:00Z', isInternal: false },
  { id: 'CMT-040', requestId: 'REQ-2024-0017', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'All deliverables received from KPMG. Quality reviewed by internal tax team. Invoice submitted for processing.', timestamp: '2025-01-02T14:00:00Z', isInternal: true },

  // REQ-2024-0019 (TechBridge onboarding) - validation
  { id: 'CMT-041', requestId: 'REQ-2024-0019', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'TechBridge recommended by CTO for cloud-native expertise. They have strong Kubernetes and microservices capabilities.', timestamp: '2024-12-10T11:15:00Z', isInternal: false },
  { id: 'CMT-042', requestId: 'REQ-2024-0019', authorId: 'u9', authorName: 'Lisa Nakamura', authorInitials: 'LN', content: 'Onboarding documentation received. Screening submitted — awaiting results from compliance team. SRA assessment scheduled for next week.', timestamp: '2025-01-07T10:00:00Z', isInternal: true },

  // REQ-2024-0021 (Capgemini DevOps) - contracting
  { id: 'CMT-043', requestId: 'REQ-2024-0021', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Engineering velocity bottlenecked by manual processes. Capgemini proposed a phased approach: assess, design, implement.', timestamp: '2024-10-05T10:15:00Z', isInternal: false },
  { id: 'CMT-044', requestId: 'REQ-2024-0021', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Contract negotiation in progress. Key sticking point is IP ownership of custom toolchain components. Legal reviewing.', timestamp: '2025-01-06T11:00:00Z', isInternal: true },

  // REQ-2024-0022 (Employee benefits platform) - intake
  { id: 'CMT-045', requestId: 'REQ-2024-0022', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'HR team needs a modern benefits platform. Current spreadsheet-based system is error-prone and employees complain about lack of visibility.', timestamp: '2025-01-02T10:15:00Z', isInternal: false },

  // REQ-2024-0023 (Siemens IoT sensors) - approval
  { id: 'CMT-046', requestId: 'REQ-2024-0023', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Predictive maintenance programme will install 200 sensors across factory floor equipment. Expected ROI within 18 months.', timestamp: '2024-11-25T09:15:00Z', isInternal: false },
  { id: 'CMT-047', requestId: 'REQ-2024-0023', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'Siemens confirmed as sole source for required industrial-grade specifications. Single-source justification attached.', timestamp: '2024-12-15T14:00:00Z', isInternal: true, attachments: ['sole-source-justification.pdf'] },

  // REQ-2024-0024 (Hays finance temp staff) - PO
  { id: 'CMT-048', requestId: 'REQ-2024-0024', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Year-end close requires additional finance analysts. Hays can provide candidates from their existing bench within 1 week.', timestamp: '2024-12-05T08:15:00Z', isInternal: false },

  // REQ-2024-0027 (Accenture cloud strategy) - intake
  { id: 'CMT-049', requestId: 'REQ-2024-0027', authorId: 'u5', authorName: 'Elena Petrova', authorInitials: 'EP', content: 'Board directive to develop multi-cloud strategy. Accenture proposed a 12-week engagement with clear deliverables.', timestamp: '2025-01-03T09:15:00Z', isInternal: false, attachments: ['accenture-proposal.pdf'] },
  { id: 'CMT-050', requestId: 'REQ-2024-0027', authorId: 'u4', authorName: 'Marcus Johnson', authorInitials: 'MJ', content: 'Reviewing proposal. Need to validate against our existing AWS and Azure commitments before proceeding.', timestamp: '2025-01-08T08:00:00Z', isInternal: true },

  // REQ-2024-0030 (C&W Facilities) - contracting
  { id: 'CMT-051', requestId: 'REQ-2024-0030', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Consolidating London and Amsterdam FM contracts under single provider. C&W won competitive tender.', timestamp: '2024-09-20T09:15:00Z', isInternal: false },
  { id: 'CMT-052', requestId: 'REQ-2024-0030', authorId: 'u1', authorName: 'Anna Müller', authorInitials: 'AM', content: 'Contract in final review. SLA schedules and KPI framework agreed. Awaiting legal sign-off on liability clauses.', timestamp: '2025-01-07T13:00:00Z', isInternal: true },

  // REQ-2024-0031 (Salesforce expansion) - approval
  { id: 'CMT-053', requestId: 'REQ-2024-0031', authorId: 'u6', authorName: "James O'Brien", authorInitials: 'JO', content: 'Sales team growing from 150 to 350 reps. Need 200 additional CRM licenses plus Service Cloud for unified customer support.', timestamp: '2024-12-01T10:15:00Z', isInternal: false },
  { id: 'CMT-054', requestId: 'REQ-2024-0031', authorId: 'u3', authorName: 'Sarah Chen', authorInitials: 'SC', content: 'Salesforce offered volume discount: 200 licenses at €1,800/user/year vs standard €2,400. Service Cloud add-on at €600/user. Good deal.', timestamp: '2024-12-20T11:00:00Z', isInternal: true },

  // AI-generated comments (system)
  { id: 'CMT-055', requestId: 'REQ-2024-0006', authorId: 'u3', authorName: 'AI Assistant', authorInitials: 'AI', content: 'Risk assessment: This request has been in sourcing for 42 days (SLA: 30 days). Recommend escalation to category lead. Similar middleware implementations in this industry typically take 20-25 days to source.', timestamp: '2025-01-05T08:00:00Z', isInternal: true },
  { id: 'CMT-056', requestId: 'REQ-2024-0009', authorId: 'u3', authorName: 'AI Assistant', authorInitials: 'AI', content: 'Category suggestion: Based on the description and commodity code, this request is classified as "Data Analytics Platform" with 96% confidence. Recommended buying channel: Procurement-led due to value exceeding €100K threshold.', timestamp: '2024-10-15T10:30:00Z', isInternal: true },
  { id: 'CMT-057', requestId: 'REQ-2024-0022', authorId: 'u3', authorName: 'AI Assistant', authorInitials: 'AI', content: 'Duplicate detection: This request has 78% similarity with REQ-2023-0089 (Employee Benefits System - archived). Key differences: updated SaaS requirement and mobile-first approach. Recommend reviewing archived request for learnings.', timestamp: '2025-01-02T10:30:00Z', isInternal: true },
  { id: 'CMT-058', requestId: 'REQ-2024-0014', authorId: 'u4', authorName: 'AI Assistant', authorInitials: 'AI', content: 'Approval routing: Value exceeds €1M threshold. Dual VP approval required per Delegation of Authority v4.2. Routing to Christine Dupont and Henrik Larsson.', timestamp: '2024-12-20T16:05:00Z', isInternal: true },
  { id: 'CMT-059', requestId: 'REQ-2024-0025', authorId: 'u1', authorName: 'AI Assistant', authorInitials: 'AI', content: 'Commodity code verified: 25172500 (Automotive sensor components) matches description. Bosch is a registered supplier for this commodity. No framework agreement found — direct PO channel recommended.', timestamp: '2024-12-15T10:30:00Z', isInternal: true },
  { id: 'CMT-060', requestId: 'REQ-2024-0031', authorId: 'u3', authorName: 'AI Assistant', authorInitials: 'AI', content: 'Spend analysis: Current Salesforce spend is €420K/year. This expansion would increase to €960K/year. Recommend negotiating multi-year agreement for additional 8-12% discount based on market benchmarks.', timestamp: '2024-12-01T10:30:00Z', isInternal: true },
];

export function getCommentsByRequestId(requestId: string): Comment[] {
  return comments.filter((c) => c.requestId === requestId);
}

export function getInternalComments(requestId: string): Comment[] {
  return comments.filter((c) => c.requestId === requestId && c.isInternal);
}
