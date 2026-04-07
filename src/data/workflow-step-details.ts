export interface WorkflowStepDetail {
  requestId: string;
  stage: string;
  handler: {
    userId: string;
    name: string;
    role: string;
    department: string;
  };
  action: string;
  decision?: {
    outcome: 'approved' | 'rejected' | 'referred-back' | 'escalated' | 'completed';
    reason?: string;
    conditions?: string[];
  };
  systemInvolvement?: {
    system: string;
    systemLabel: string;
    referenceId?: string;
    status: string;
    detail: string;
  };
  formsCompleted?: {
    formName: string;
    completedAt: string;
    fields: { label: string; value: string }[];
  }[];
  documentsAdded?: {
    name: string;
    type: string;
    addedBy: string;
    addedAt: string;
  }[];
  comments?: {
    author: string;
    content: string;
    timestamp: string;
    isInternal: boolean;
  }[];
  duration: {
    enteredAt: string;
    completedAt?: string;
    daysInStep: number;
  };
  slaStatus: 'on-track' | 'at-risk' | 'breached';
}

export const workflowStepDetails: WorkflowStepDetail[] = [
  // =====================================================
  // REQ-2024-0001 — Cloud hosting migration - AWS (completed)
  // =====================================================
  {
    requestId: 'REQ-2024-0001',
    stage: 'intake',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Accepted and assigned to IT Procurement category team',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-03-16T10:00:00Z',
      fields: [
        { label: 'Category', value: 'Software — Cloud Computing Services' },
        { label: 'Estimated Value', value: '€480,000' },
        { label: 'Buying Channel', value: 'Procurement-Led Sourcing' },
        { label: 'Assigned Category Team', value: 'IT Procurement' },
        { label: 'Urgency Assessment', value: 'Non-urgent — standard timeline' },
      ],
    }],
    comments: [
      { author: 'Sarah Chen', content: 'Request received. Assigning to IT Procurement team — existing AWS framework agreement in place.', timestamp: '2024-03-15T11:30:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-03-15T09:05:00Z', completedAt: '2024-03-16T10:30:00Z', daysInStep: 1 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0001',
    stage: 'validation',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Validated buying channel, commodity code, and supplier eligibility',
    systemInvolvement: {
      system: 'coupa-risk',
      systemLabel: 'Coupa Risk Assess',
      referenceId: 'CRA-2024-1102',
      status: 'completed',
      detail: 'Supplier risk assessment completed. Risk score: Low (12/100).',
    },
    comments: [
      { author: 'Sarah Chen', content: 'Validated against AWS Enterprise Agreement. Commodity code 81112200 confirmed. SRA valid.', timestamp: '2024-03-18T14:00:00Z', isInternal: true },
      { author: 'AI Pre-Validator', content: 'Auto-validation: Buying channel confirmed as Procurement-Led. Budget allocation verified. No policy conflicts detected.', timestamp: '2024-03-16T11:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-03-16T10:30:00Z', completedAt: '2024-03-20T14:00:00Z', daysInStep: 4 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0001',
    stage: 'approval',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Approved',
    decision: {
      outcome: 'approved',
      reason: 'Budget confirmed within IT capex envelope. TCO analysis supports cloud migration business case.',
      conditions: ['Subject to final contract amendment review by legal'],
    },
    comments: [
      { author: 'Dr. Katrin Bauer', content: 'Approved. Budget allocation confirmed. TCO reduction of 35% is well-supported.', timestamp: '2024-03-25T11:00:00Z', isInternal: false },
    ],
    duration: { enteredAt: '2024-03-20T14:00:00Z', completedAt: '2024-03-25T11:00:00Z', daysInStep: 5 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0001',
    stage: 'sourcing',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'AWS selected via existing framework agreement',
    comments: [
      { author: 'Sarah Chen', content: 'AWS selected under existing Enterprise Agreement. No competitive sourcing required — framework call-off applicable.', timestamp: '2024-04-01T10:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-03-25T11:00:00Z', completedAt: '2024-04-15T16:00:00Z', daysInStep: 21 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0001',
    stage: 'contracting',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Enterprise agreement amendment signed',
    documentsAdded: [
      { name: 'AWS Enterprise Agreement Amendment v2.1', type: 'Contract', addedBy: 'Sarah Chen', addedAt: '2024-05-20T14:00:00Z' },
      { name: 'Statement of Work - Cloud Migration', type: 'SOW', addedBy: 'Sarah Chen', addedAt: '2024-05-25T10:00:00Z' },
      { name: 'Data Processing Agreement', type: 'DPA', addedBy: 'Legal Team', addedAt: '2024-05-28T16:00:00Z' },
    ],
    comments: [
      { author: 'Sarah Chen', content: 'EA amendment finalised. SOW covers EC2, RDS, and S3 services. DPA executed.', timestamp: '2024-06-01T09:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-04-15T16:00:00Z', completedAt: '2024-06-01T09:00:00Z', daysInStep: 47 },
    slaStatus: 'at-risk',
  },
  {
    requestId: 'REQ-2024-0001',
    stage: 'po',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Purchase order PO-001 created in SAP',
    systemInvolvement: {
      system: 'sap',
      systemLabel: 'SAP S/4HANA',
      referenceId: 'SAP-PO-4500012001',
      status: 'completed',
      detail: 'Purchase order created in SAP S/4HANA. PO number 4500012001.',
    },
    duration: { enteredAt: '2024-06-01T09:00:00Z', completedAt: '2024-06-15T10:00:00Z', daysInStep: 14 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0001',
    stage: 'receipt',
    handler: { userId: 'u5', name: 'Elena Petrova', role: 'Business Requestor', department: 'Engineering' },
    action: 'Cloud migration completed and services received',
    comments: [
      { author: 'Elena Petrova', content: 'Migration completed successfully. All workloads transferred to AWS. Performance validated.', timestamp: '2024-09-30T17:00:00Z', isInternal: false },
    ],
    duration: { enteredAt: '2024-06-15T10:00:00Z', completedAt: '2024-09-30T17:00:00Z', daysInStep: 107 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0001',
    stage: 'invoice',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Invoice processed — three-way match successful',
    comments: [
      { author: 'Anna Müller', content: 'Invoice matched against PO and goods receipt. No variance. Approved for payment.', timestamp: '2024-10-02T10:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-09-30T17:00:00Z', completedAt: '2024-10-02T10:00:00Z', daysInStep: 2 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0001',
    stage: 'payment',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Payment processed via bank transfer',
    duration: { enteredAt: '2024-10-02T10:00:00Z', completedAt: '2024-10-02T14:00:00Z', daysInStep: 0 },
    slaStatus: 'on-track',
  },

  // =====================================================
  // REQ-2024-0002 — SAP S/4HANA license renewal (completed)
  // =====================================================
  {
    requestId: 'REQ-2024-0002',
    stage: 'intake',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Accepted and assigned to IT Procurement',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-06-03T09:00:00Z',
      fields: [
        { label: 'Category', value: 'Contract Renewal — Enterprise Software' },
        { label: 'Estimated Value', value: '€1,200,000' },
        { label: 'Buying Channel', value: 'Procurement-Led Sourcing' },
        { label: 'Renewal Type', value: 'Annual license renewal' },
        { label: 'Users', value: '500 named users' },
      ],
    }],
    duration: { enteredAt: '2024-06-01T10:15:00Z', completedAt: '2024-06-05T09:00:00Z', daysInStep: 4 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0002',
    stage: 'validation',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Validated renewal terms and license count',
    comments: [
      { author: 'Sarah Chen', content: 'License count validated against active directory. 500 users confirmed. Renewal under existing master agreement.', timestamp: '2024-06-10T14:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-06-05T09:00:00Z', completedAt: '2024-06-15T14:00:00Z', daysInStep: 10 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0002',
    stage: 'approval',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Approved with CFO sign-off',
    decision: {
      outcome: 'approved',
      reason: 'Mission-critical ERP system. CFO approval obtained for >€1M threshold.',
      conditions: ['Negotiate minimum 3% volume discount'],
    },
    comments: [
      { author: 'Dr. Katrin Bauer', content: 'CFO approval obtained. Proceed with negotiation targeting volume discount.', timestamp: '2024-06-25T11:00:00Z', isInternal: false },
    ],
    duration: { enteredAt: '2024-06-15T14:00:00Z', completedAt: '2024-06-25T11:00:00Z', daysInStep: 10 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0002',
    stage: 'sourcing',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Negotiated 5% volume discount with SAP',
    comments: [
      { author: 'Sarah Chen', content: 'Achieved 5% volume discount through negotiation — exceeding the 3% target set by Finance.', timestamp: '2024-07-15T11:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-06-25T11:00:00Z', completedAt: '2024-07-15T11:00:00Z', daysInStep: 20 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0002',
    stage: 'contracting',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Renewal contract executed under master agreement',
    systemInvolvement: {
      system: 'sirion',
      systemLabel: 'Sirion CLM',
      referenceId: 'SIR-2024-0445',
      status: 'completed',
      detail: 'Contract renewal document generated and reviewed in Sirion CLM.',
    },
    documentsAdded: [
      { name: 'SAP License Renewal Agreement FY2025', type: 'Contract', addedBy: 'Sarah Chen', addedAt: '2024-07-28T14:00:00Z' },
      { name: 'Volume Discount Schedule', type: 'Schedule', addedBy: 'Sarah Chen', addedAt: '2024-07-30T10:00:00Z' },
    ],
    duration: { enteredAt: '2024-07-15T11:00:00Z', completedAt: '2024-08-01T09:00:00Z', daysInStep: 17 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0002',
    stage: 'po',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Purchase order created in SAP',
    systemInvolvement: {
      system: 'sap',
      systemLabel: 'SAP S/4HANA',
      referenceId: 'SAP-PO-4500012034',
      status: 'completed',
      detail: 'Purchase order created for SAP license renewal.',
    },
    duration: { enteredAt: '2024-08-01T09:00:00Z', completedAt: '2024-08-01T09:30:00Z', daysInStep: 0 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0002',
    stage: 'receipt',
    handler: { userId: 'u5', name: 'Elena Petrova', role: 'Business Requestor', department: 'Engineering' },
    action: 'License activation confirmed',
    duration: { enteredAt: '2024-08-01T09:30:00Z', completedAt: '2024-09-01T09:00:00Z', daysInStep: 31 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0002',
    stage: 'invoice',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Invoice processed — three-way match successful',
    duration: { enteredAt: '2024-09-01T09:00:00Z', completedAt: '2024-09-28T14:00:00Z', daysInStep: 27 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0002',
    stage: 'payment',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Payment processed via bank transfer',
    duration: { enteredAt: '2024-09-28T14:00:00Z', completedAt: '2024-12-20T15:00:00Z', daysInStep: 83 },
    slaStatus: 'on-track',
  },

  // =====================================================
  // REQ-2024-0003 — Office furniture - Berlin HQ (payment)
  // =====================================================
  {
    requestId: 'REQ-2024-0003',
    stage: 'intake',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Accepted and assigned to Facilities category',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-07-21T14:00:00Z',
      fields: [
        { label: 'Category', value: 'Goods — Office Furniture' },
        { label: 'Estimated Value', value: '€175,000' },
        { label: 'Buying Channel', value: 'Framework Call-Off' },
        { label: 'Framework Reference', value: 'CON-015' },
        { label: 'Delivery Location', value: 'Berlin HQ — 120 workstations' },
      ],
    }],
    duration: { enteredAt: '2024-07-20T09:00:00Z', completedAt: '2024-07-22T10:00:00Z', daysInStep: 2 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0003',
    stage: 'validation',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Validated framework call-off eligibility',
    comments: [
      { author: 'Anna Müller', content: 'Framework CON-015 confirmed active. Call-off within permitted limits. Ergonomic specifications meet company standards.', timestamp: '2024-07-28T10:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-07-22T10:00:00Z', completedAt: '2024-07-30T14:00:00Z', daysInStep: 8 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0003',
    stage: 'approval',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Approved',
    decision: {
      outcome: 'approved',
      reason: 'Framework call-off within budget. Berlin HQ expansion approved.',
    },
    duration: { enteredAt: '2024-07-30T14:00:00Z', completedAt: '2024-08-05T11:00:00Z', daysInStep: 6 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0003',
    stage: 'sourcing',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Framework call-off order placed',
    duration: { enteredAt: '2024-08-05T11:00:00Z', completedAt: '2024-08-20T16:00:00Z', daysInStep: 15 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0003',
    stage: 'contracting',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Call-off contract executed under framework',
    documentsAdded: [
      { name: 'Framework Call-Off Order Form', type: 'Order', addedBy: 'Anna Müller', addedAt: '2024-09-05T10:00:00Z' },
      { name: 'Delivery Schedule', type: 'Schedule', addedBy: 'Anna Müller', addedAt: '2024-09-08T14:00:00Z' },
    ],
    duration: { enteredAt: '2024-08-20T16:00:00Z', completedAt: '2024-09-10T09:00:00Z', daysInStep: 21 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0003',
    stage: 'po',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Purchase order PO-003 created',
    duration: { enteredAt: '2024-09-10T09:00:00Z', completedAt: '2024-09-20T08:00:00Z', daysInStep: 10 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0003',
    stage: 'receipt',
    handler: { userId: 'u6', name: "James O'Brien", role: 'Business Requestor', department: 'Marketing' },
    action: 'All furniture items received and installed',
    comments: [
      { author: "James O'Brien", content: 'All 120 workstations furnished. Installation quality confirmed by facilities team.', timestamp: '2024-11-18T10:00:00Z', isInternal: false },
    ],
    duration: { enteredAt: '2024-09-20T08:00:00Z', completedAt: '2024-11-18T10:00:00Z', daysInStep: 59 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0003',
    stage: 'invoice',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Invoice processed — three-way match successful',
    duration: { enteredAt: '2024-11-18T10:00:00Z', completedAt: '2024-12-05T14:00:00Z', daysInStep: 17 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0003',
    stage: 'payment',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Payment in progress',
    duration: { enteredAt: '2024-12-05T14:00:00Z', daysInStep: 5 },
    slaStatus: 'on-track',
  },

  // =====================================================
  // REQ-2024-0004 — Marketing agency retainer (completed)
  // =====================================================
  {
    requestId: 'REQ-2024-0004',
    stage: 'intake',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Accepted and assigned to Professional Services',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-05-11T10:00:00Z',
      fields: [
        { label: 'Category', value: 'Services — Marketing Campaign Management' },
        { label: 'Estimated Value', value: '€320,000' },
        { label: 'Buying Channel', value: 'Procurement-Led Sourcing' },
        { label: 'Engagement Period', value: 'Q3-Q4 2024' },
      ],
    }],
    duration: { enteredAt: '2024-05-10T14:15:00Z', completedAt: '2024-05-12T10:00:00Z', daysInStep: 2 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0004',
    stage: 'validation',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Validated agency engagement scope and rates',
    comments: [
      { author: 'Marcus Johnson', content: 'WPP rate card validated. Rates 15% above historical average but within acceptable range for full-service engagement.', timestamp: '2024-05-18T14:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-05-12T10:00:00Z', completedAt: '2024-05-20T14:00:00Z', daysInStep: 8 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0004',
    stage: 'approval',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Approved',
    decision: {
      outcome: 'approved',
      reason: 'Marketing budget confirmed. Product launch support justified.',
      conditions: ['Rate card review at next renewal cycle'],
    },
    duration: { enteredAt: '2024-05-20T14:00:00Z', completedAt: '2024-05-28T11:00:00Z', daysInStep: 8 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0004',
    stage: 'contracting',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Retainer agreement executed',
    documentsAdded: [
      { name: 'WPP Retainer Agreement Q3-Q4 2024', type: 'Contract', addedBy: 'Marcus Johnson', addedAt: '2024-05-30T14:00:00Z' },
      { name: 'Campaign Brief and Deliverables Schedule', type: 'SOW', addedBy: 'Marcus Johnson', addedAt: '2024-06-01T10:00:00Z' },
    ],
    duration: { enteredAt: '2024-05-28T11:00:00Z', completedAt: '2024-06-01T14:00:00Z', daysInStep: 4 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0004',
    stage: 'po',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Purchase order PO-004 created',
    duration: { enteredAt: '2024-06-01T14:00:00Z', completedAt: '2024-06-01T14:30:00Z', daysInStep: 0 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0004',
    stage: 'receipt',
    handler: { userId: 'u6', name: "James O'Brien", role: 'Business Requestor', department: 'Marketing' },
    action: 'All campaign deliverables received',
    comments: [
      { author: "James O'Brien", content: 'All campaign deliverables completed. Strong results: 3.2x ROAS achieved across digital channels.', timestamp: '2024-12-20T10:00:00Z', isInternal: false },
    ],
    duration: { enteredAt: '2024-06-01T14:30:00Z', completedAt: '2024-12-20T10:00:00Z', daysInStep: 201 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0004',
    stage: 'invoice',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Final invoice processed',
    duration: { enteredAt: '2024-12-20T10:00:00Z', completedAt: '2024-12-25T14:00:00Z', daysInStep: 5 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0004',
    stage: 'payment',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Payment processed',
    duration: { enteredAt: '2024-12-25T14:00:00Z', completedAt: '2024-12-28T09:00:00Z', daysInStep: 3 },
    slaStatus: 'on-track',
  },

  // =====================================================
  // REQ-2024-0005 — Data centre security audit (completed)
  // =====================================================
  {
    requestId: 'REQ-2024-0005',
    stage: 'intake',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Accepted — mandatory compliance engagement',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-08-02T10:00:00Z',
      fields: [
        { label: 'Category', value: 'Consulting — Information Security' },
        { label: 'Estimated Value', value: '€95,000' },
        { label: 'Buying Channel', value: 'Procurement-Led Sourcing' },
        { label: 'Compliance Driver', value: 'ISO 27001 certification renewal' },
      ],
    }],
    duration: { enteredAt: '2024-08-01T07:15:00Z', completedAt: '2024-08-03T10:00:00Z', daysInStep: 2 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0005',
    stage: 'validation',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Validated scope and Deloitte engagement eligibility',
    duration: { enteredAt: '2024-08-03T10:00:00Z', completedAt: '2024-08-10T14:00:00Z', daysInStep: 7 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0005',
    stage: 'approval',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Approved — mandatory compliance requirement',
    decision: {
      outcome: 'approved',
      reason: 'Mandatory compliance engagement for ISO 27001 certification renewal.',
    },
    duration: { enteredAt: '2024-08-10T14:00:00Z', completedAt: '2024-08-15T11:00:00Z', daysInStep: 5 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0005',
    stage: 'contracting',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Engagement letter executed under MSA',
    documentsAdded: [
      { name: 'Deloitte Engagement Letter — Security Audit 2024', type: 'Engagement Letter', addedBy: 'Marcus Johnson', addedAt: '2024-08-28T14:00:00Z' },
      { name: 'Penetration Testing Scope Document', type: 'SOW', addedBy: 'Marcus Johnson', addedAt: '2024-08-30T10:00:00Z' },
    ],
    duration: { enteredAt: '2024-08-15T11:00:00Z', completedAt: '2024-09-01T07:00:00Z', daysInStep: 17 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0005',
    stage: 'po',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Purchase order PO-005 created',
    duration: { enteredAt: '2024-09-01T07:00:00Z', completedAt: '2024-09-01T07:30:00Z', daysInStep: 0 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0005',
    stage: 'receipt',
    handler: { userId: 'u5', name: 'Elena Petrova', role: 'Business Requestor', department: 'Engineering' },
    action: 'Audit report and findings received',
    documentsAdded: [
      { name: 'Security Audit Report — Final', type: 'Report', addedBy: 'Deloitte', addedAt: '2024-11-25T16:00:00Z' },
      { name: 'Penetration Test Results', type: 'Report', addedBy: 'Deloitte', addedAt: '2024-11-25T16:00:00Z' },
      { name: 'Remediation Recommendations', type: 'Report', addedBy: 'Deloitte', addedAt: '2024-11-28T10:00:00Z' },
    ],
    comments: [
      { author: 'Elena Petrova', content: 'Audit completed. Report received with 3 critical findings, 12 medium, 8 low. Remediation plan in progress.', timestamp: '2024-11-28T16:00:00Z', isInternal: false },
    ],
    duration: { enteredAt: '2024-09-01T07:30:00Z', completedAt: '2024-11-28T16:00:00Z', daysInStep: 88 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0005',
    stage: 'invoice',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Invoice processed',
    duration: { enteredAt: '2024-11-28T16:00:00Z', completedAt: '2024-12-05T14:00:00Z', daysInStep: 7 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0005',
    stage: 'payment',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Payment processed',
    duration: { enteredAt: '2024-12-05T14:00:00Z', completedAt: '2024-12-05T15:00:00Z', daysInStep: 0 },
    slaStatus: 'on-track',
  },

  // =====================================================
  // REQ-2024-0006 — ERP integration middleware (sourcing, overdue)
  // =====================================================
  {
    requestId: 'REQ-2024-0006',
    stage: 'intake',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Accepted and assigned to IT Procurement',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-09-11T14:00:00Z',
      fields: [
        { label: 'Category', value: 'Software — Integration Middleware' },
        { label: 'Estimated Value', value: '€290,000' },
        { label: 'Buying Channel', value: 'Procurement-Led Sourcing' },
        { label: 'Integration Target', value: 'SAP ↔ Salesforce ↔ Internal microservices' },
      ],
    }],
    duration: { enteredAt: '2024-09-10T11:15:00Z', completedAt: '2024-09-12T10:00:00Z', daysInStep: 2 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0006',
    stage: 'validation',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Validated requirements and architecture review completed',
    comments: [
      { author: 'Sarah Chen', content: 'Enterprise architecture team approved integration approach. Multiple vendors to be evaluated via RFP.', timestamp: '2024-09-18T10:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-09-12T10:00:00Z', completedAt: '2024-09-20T14:00:00Z', daysInStep: 8 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0006',
    stage: 'approval',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Approved',
    decision: {
      outcome: 'approved',
      reason: 'Efficiency gains justified — 20+ hours/week manual rework elimination.',
    },
    duration: { enteredAt: '2024-09-20T14:00:00Z', completedAt: '2024-10-01T11:00:00Z', daysInStep: 11 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0006',
    stage: 'sourcing',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'RFP in progress — MuleSoft negotiation ongoing',
    systemInvolvement: {
      system: 'ariba',
      systemLabel: 'SAP Ariba',
      status: 'awaiting-response',
      detail: 'RFx event created. 3 suppliers invited, bid deadline passed. MuleSoft pricing requires budget revision.',
    },
    comments: [
      { author: 'Sarah Chen', content: 'MuleSoft pricing came in significantly above budget. Referred back for budget revision on 2024-11-15.', timestamp: '2024-11-15T10:00:00Z', isInternal: true },
      { author: 'Sarah Chen', content: 'Resumed sourcing after budget revision approved. Continuing negotiations with MuleSoft.', timestamp: '2024-11-20T14:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-10-01T11:00:00Z', daysInStep: 42 },
    slaStatus: 'breached',
  },

  // =====================================================
  // REQ-2024-0007 — Contingent workforce - Java developers (approval, overdue)
  // =====================================================
  {
    requestId: 'REQ-2024-0007',
    stage: 'intake',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Accepted and routed to Procurement Lead',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-10-26T10:00:00Z',
      fields: [
        { label: 'Category', value: 'Contingent Labour — IT Staffing' },
        { label: 'Estimated Value', value: '€960,000' },
        { label: 'Buying Channel', value: 'Procurement-Led Sourcing' },
        { label: 'Headcount', value: '8 Senior Java Developers' },
        { label: 'Engagement Period', value: '12 months' },
      ],
    }],
    duration: { enteredAt: '2024-10-25T13:15:00Z', completedAt: '2024-10-28T10:00:00Z', daysInStep: 3 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0007',
    stage: 'validation',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Validated contingent labour requirements',
    comments: [
      { author: 'Anna Müller', content: 'Randstad framework agreement confirmed. Day rates validated against market benchmarks. IR35 status determination pending.', timestamp: '2024-11-04T14:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-10-28T10:00:00Z', completedAt: '2024-11-05T14:00:00Z', daysInStep: 8 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0007',
    stage: 'approval',
    handler: { userId: 'u7', name: 'Dr. Katrin Bauer', role: 'Finance Approver', department: 'Finance' },
    action: 'Awaiting budget confirmation from programme board',
    comments: [
      { author: 'Dr. Katrin Bauer', content: 'Budget confirmation pending from programme board. High-value contingent labour engagement requires programme-level sign-off.', timestamp: '2024-11-20T09:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-11-05T14:00:00Z', daysInStep: 28 },
    slaStatus: 'breached',
  },

  // =====================================================
  // REQ-2024-0008 — Managed print services renewal (validation, overdue)
  // =====================================================
  {
    requestId: 'REQ-2024-0008',
    stage: 'intake',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Accepted and assigned to Facilities',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-11-03T10:00:00Z',
      fields: [
        { label: 'Category', value: 'Contract Renewal — Managed Print' },
        { label: 'Estimated Value', value: '€45,000' },
        { label: 'Buying Channel', value: 'Business-Led Purchase' },
        { label: 'Contract Expiry', value: 'January 2025' },
      ],
    }],
    duration: { enteredAt: '2024-11-01T09:15:00Z', completedAt: '2024-11-05T10:00:00Z', daysInStep: 4 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0008',
    stage: 'validation',
    handler: { userId: 'u1', name: 'Anna Müller', role: 'Procurement Lead', department: 'Global Procurement' },
    action: 'Stalled — awaiting usage data from IT',
    systemInvolvement: {
      system: 'coupa-risk',
      systemLabel: 'Coupa Risk Assess',
      status: 'error',
      detail: 'Supplier risk assessment failed — supplier profile not found in Coupa. Manual data entry required.',
    },
    comments: [
      { author: 'Anna Müller', content: 'Cannot proceed without print usage data across 12 offices. IT department has been requested but not yet responded.', timestamp: '2024-12-01T10:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-11-05T10:00:00Z', daysInStep: 35 },
    slaStatus: 'breached',
  },

  // =====================================================
  // REQ-2024-0009 — Databricks AI/ML (referred-back)
  // =====================================================
  {
    requestId: 'REQ-2024-0009',
    stage: 'intake',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Accepted — new supplier evaluation required',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-10-17T10:00:00Z',
      fields: [
        { label: 'Category', value: 'Software — Data Analytics Platforms' },
        { label: 'Estimated Value', value: '€380,000' },
        { label: 'Buying Channel', value: 'Procurement-Led Sourcing' },
        { label: 'New Supplier', value: 'Yes — Databricks (onboarding required)' },
      ],
    }],
    duration: { enteredAt: '2024-10-15T10:15:00Z', completedAt: '2024-10-18T10:00:00Z', daysInStep: 3 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0009',
    stage: 'validation',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Validated — new supplier onboarding initiated',
    duration: { enteredAt: '2024-10-18T10:00:00Z', completedAt: '2024-10-30T14:00:00Z', daysInStep: 12 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0009',
    stage: 'sourcing',
    handler: { userId: 'u3', name: 'Sarah Chen', role: 'Category Manager', department: 'IT Procurement' },
    action: 'Referred back twice — competitive evaluation outstanding',
    comments: [
      { author: 'Sarah Chen', content: 'First refer-back: ROI analysis vs Azure ML required by finance.', timestamp: '2024-11-20T10:00:00Z', isInternal: true },
      { author: 'Sarah Chen', content: 'Resubmitted after ROI analysis. Second refer-back: additional cost comparison required.', timestamp: '2024-12-15T10:00:00Z', isInternal: true },
    ],
    duration: { enteredAt: '2024-10-30T14:00:00Z', daysInStep: 8 },
    slaStatus: 'at-risk',
  },

  // =====================================================
  // REQ-2024-0010 — Corporate travel management (referred-back)
  // =====================================================
  {
    requestId: 'REQ-2024-0010',
    stage: 'intake',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Accepted and assigned to Professional Services',
    formsCompleted: [{
      formName: 'Intake Assessment Form',
      completedAt: '2024-11-07T10:00:00Z',
      fields: [
        { label: 'Category', value: 'Services — Travel Management' },
        { label: 'Estimated Value', value: '€210,000' },
        { label: 'Buying Channel', value: 'Procurement-Led Sourcing' },
        { label: 'Geographic Scope', value: 'To be confirmed — EU or EU + APAC' },
      ],
    }],
    duration: { enteredAt: '2024-11-05T11:15:00Z', completedAt: '2024-11-08T10:00:00Z', daysInStep: 3 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0010',
    stage: 'validation',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Validated requirements and RFP scope',
    duration: { enteredAt: '2024-11-08T10:00:00Z', completedAt: '2024-11-20T14:00:00Z', daysInStep: 12 },
    slaStatus: 'on-track',
  },
  {
    requestId: 'REQ-2024-0010',
    stage: 'sourcing',
    handler: { userId: 'u4', name: 'Marcus Johnson', role: 'Category Manager', department: 'Professional Services' },
    action: 'Referred back — scope clarification needed',
    comments: [
      { author: 'Marcus Johnson', content: 'Scope clarification needed from requestor: EU only or including APAC? This significantly impacts vendor selection and pricing.', timestamp: '2024-12-15T10:00:00Z', isInternal: false },
    ],
    duration: { enteredAt: '2024-11-20T14:00:00Z', daysInStep: 5 },
    slaStatus: 'at-risk',
  },
];

export function getStepDetailsForRequest(requestId: string): WorkflowStepDetail[] {
  return workflowStepDetails.filter((d) => d.requestId === requestId);
}

export function getStepDetail(requestId: string, stage: string): WorkflowStepDetail | undefined {
  return workflowStepDetails.find((d) => d.requestId === requestId && d.stage === stage);
}
