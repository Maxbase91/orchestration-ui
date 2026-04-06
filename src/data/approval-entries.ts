import type { ApprovalEntry } from './types';

export const approvalEntries: ApprovalEntry[] = [
  // REQ-2024-0001 (Cloud hosting - completed, approved)
  {
    id: 'APR-001',
    requestId: 'REQ-2024-0001',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-03-20T14:00:00Z',
    respondedAt: '2024-03-25T11:00:00Z',
    comments: 'Budget confirmed. Cloud migration aligns with IT strategy. Approved.',
  },

  // REQ-2024-0002 (SAP renewal - completed, approved)
  {
    id: 'APR-002',
    requestId: 'REQ-2024-0002',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-06-15T14:00:00Z',
    respondedAt: '2024-06-25T11:00:00Z',
    comments: 'Critical system. Renewal approved with negotiated discount noted.',
  },
  {
    id: 'APR-003',
    requestId: 'REQ-2024-0002',
    approverId: 'u11',
    approverName: 'Christine Dupont',
    approverRole: 'VP Procurement',
    status: 'approved',
    requestedAt: '2024-06-15T14:00:00Z',
    respondedAt: '2024-06-22T09:00:00Z',
    comments: 'Approved. Value exceeds €1M threshold.',
  },

  // REQ-2024-0003 (Office furniture - approved)
  {
    id: 'APR-004',
    requestId: 'REQ-2024-0003',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-07-30T14:00:00Z',
    respondedAt: '2024-08-05T11:00:00Z',
    comments: 'Berlin expansion budget approved. Proceed with framework agreement.',
  },

  // REQ-2024-0004 (Marketing retainer - approved)
  {
    id: 'APR-005',
    requestId: 'REQ-2024-0004',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-05-20T14:00:00Z',
    respondedAt: '2024-05-28T11:00:00Z',
    comments: 'Marketing budget allocated. Good performance track record with WPP.',
  },

  // REQ-2024-0005 (Security audit - approved)
  {
    id: 'APR-006',
    requestId: 'REQ-2024-0005',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-08-10T14:00:00Z',
    respondedAt: '2024-08-15T11:00:00Z',
    comments: 'Compliance requirement. Approved.',
  },

  // REQ-2024-0006 (ERP integration - approved)
  {
    id: 'APR-007',
    requestId: 'REQ-2024-0006',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-09-20T14:00:00Z',
    respondedAt: '2024-10-01T11:00:00Z',
    comments: 'Approved within original budget. Note: any cost overrun needs re-approval.',
  },

  // REQ-2024-0007 (Java developers - PENDING, overdue)
  {
    id: 'APR-008',
    requestId: 'REQ-2024-0007',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'pending',
    requestedAt: '2024-11-05T14:00:00Z',
    comments: 'Awaiting programme board confirmation of headcount budget.',
  },

  // REQ-2024-0011 (Cyber insurance - referred back from approval)
  {
    id: 'APR-009',
    requestId: 'REQ-2024-0011',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'rejected',
    requestedAt: '2024-12-05T14:00:00Z',
    respondedAt: '2025-01-06T12:00:00Z',
    comments: '35% premium increase exceeds my authority. Needs board-level approval. Referred back for board paper preparation.',
  },

  // REQ-2024-0013 (Microsoft 365 E5 - approved)
  {
    id: 'APR-010',
    requestId: 'REQ-2024-0013',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-11-05T14:00:00Z',
    respondedAt: '2024-11-15T11:00:00Z',
    comments: 'Compliance driver. 15% first-year discount is a good deal. Approved.',
  },
  {
    id: 'APR-011',
    requestId: 'REQ-2024-0013',
    approverId: 'u11',
    approverName: 'Christine Dupont',
    approverRole: 'VP Procurement',
    status: 'approved',
    requestedAt: '2024-11-05T14:00:00Z',
    respondedAt: '2024-11-12T15:00:00Z',
    comments: 'Strategic investment in security posture. Approved.',
  },

  // REQ-2024-0014 (McKinsey org design - PENDING, dual VP required)
  {
    id: 'APR-012',
    requestId: 'REQ-2024-0014',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-12-05T14:00:00Z',
    respondedAt: '2024-12-18T11:00:00Z',
    comments: 'Budget available under transformation programme. Finance approved.',
  },
  {
    id: 'APR-013',
    requestId: 'REQ-2024-0014',
    approverId: 'u11',
    approverName: 'Christine Dupont',
    approverRole: 'VP Procurement',
    status: 'pending',
    requestedAt: '2024-12-18T11:00:00Z',
    comments: 'Under review. Need to validate McKinsey scope vs internal capabilities.',
  },
  {
    id: 'APR-014',
    requestId: 'REQ-2024-0014',
    approverId: 'u12',
    approverName: 'Henrik Larsson',
    approverRole: 'VP Procurement',
    status: 'pending',
    requestedAt: '2024-12-18T11:00:00Z',
    comments: 'Dual VP required for >€1M. Awaiting Christine\'s decision first.',
  },

  // REQ-2024-0015 (Catering - approved)
  {
    id: 'APR-015',
    requestId: 'REQ-2024-0015',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-11-15T14:00:00Z',
    respondedAt: '2024-11-22T11:00:00Z',
    comments: 'Facilities budget confirmed. Competitive tender appropriate.',
  },

  // REQ-2024-0016 (Laptop refresh - approved)
  {
    id: 'APR-016',
    requestId: 'REQ-2024-0016',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-10-15T14:00:00Z',
    respondedAt: '2024-10-25T11:00:00Z',
    comments: 'Standard refresh cycle. Catalogue pricing confirmed. Approved.',
  },
  {
    id: 'APR-017',
    requestId: 'REQ-2024-0016',
    approverId: 'u11',
    approverName: 'Christine Dupont',
    approverRole: 'VP Procurement',
    status: 'approved',
    requestedAt: '2024-10-15T14:00:00Z',
    respondedAt: '2024-10-22T09:00:00Z',
    comments: 'Value exceeds €500K. VP approved.',
  },

  // REQ-2024-0017 (KPMG tax - approved)
  {
    id: 'APR-018',
    requestId: 'REQ-2024-0017',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-07-28T14:00:00Z',
    respondedAt: '2024-08-05T11:00:00Z',
    comments: 'Mandatory compliance engagement. KPMG is incumbent. Approved.',
  },

  // REQ-2024-0020 (Cleaning - approved)
  {
    id: 'APR-019',
    requestId: 'REQ-2024-0020',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-11-28T14:00:00Z',
    respondedAt: '2024-12-05T11:00:00Z',
    comments: 'Consolidation expected to save 20%. Good initiative. Approved.',
  },

  // REQ-2024-0021 (Capgemini DevOps - approved)
  {
    id: 'APR-020',
    requestId: 'REQ-2024-0021',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-10-20T14:00:00Z',
    respondedAt: '2024-10-30T11:00:00Z',
    comments: 'Engineering efficiency programme. Budget allocated. Approved.',
  },

  // REQ-2024-0023 (Siemens IoT - PENDING)
  {
    id: 'APR-021',
    requestId: 'REQ-2024-0023',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'pending',
    requestedAt: '2024-12-10T14:00:00Z',
    comments: 'Reviewing ROI projections for predictive maintenance programme.',
  },

  // REQ-2024-0024 (Hays finance - approved, delegated)
  {
    id: 'APR-022',
    requestId: 'REQ-2024-0024',
    approverId: 'u8',
    approverName: 'Robert Fischer',
    approverRole: 'Finance Approver',
    status: 'delegated',
    requestedAt: '2024-12-10T14:00:00Z',
    respondedAt: '2024-12-10T14:30:00Z',
    comments: 'Delegated to Dr. Katrin Bauer (OOO until Jan 15).',
    delegatedTo: 'u7',
  },
  {
    id: 'APR-023',
    requestId: 'REQ-2024-0024',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-12-10T14:30:00Z',
    respondedAt: '2024-12-12T11:00:00Z',
    comments: 'Year-end close requirement. Urgent. Approved via delegation from Robert Fischer.',
  },

  // REQ-2024-0028 (Network switches - approved)
  {
    id: 'APR-024',
    requestId: 'REQ-2024-0028',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-12-05T14:00:00Z',
    respondedAt: '2024-12-12T11:00:00Z',
    comments: 'End-of-support risk. Security priority. Approved.',
  },

  // REQ-2024-0030 (C&W Facilities - approved)
  {
    id: 'APR-025',
    requestId: 'REQ-2024-0030',
    approverId: 'u11',
    approverName: 'Christine Dupont',
    approverRole: 'VP Procurement',
    status: 'approved',
    requestedAt: '2024-10-05T14:00:00Z',
    respondedAt: '2024-10-15T11:00:00Z',
    comments: 'FM consolidation will improve service quality. 12% savings projection validated. Approved.',
  },
  {
    id: 'APR-026',
    requestId: 'REQ-2024-0030',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-10-05T14:00:00Z',
    respondedAt: '2024-10-12T09:00:00Z',
    comments: 'Budget allocated for FM consolidation. Approved.',
  },

  // REQ-2024-0031 (Salesforce expansion - PENDING)
  {
    id: 'APR-027',
    requestId: 'REQ-2024-0031',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'pending',
    requestedAt: '2024-12-15T14:00:00Z',
    comments: 'Reviewing license cost increase from €420K to €960K annually. Significant commitment.',
  },
  {
    id: 'APR-028',
    requestId: 'REQ-2024-0031',
    approverId: 'u11',
    approverName: 'Christine Dupont',
    approverRole: 'VP Procurement',
    status: 'pending',
    requestedAt: '2024-12-15T14:00:00Z',
    comments: 'Awaiting finance approval before VP review.',
  },

  // REQ-2024-0033 (Randstad IT helpdesk - approved)
  {
    id: 'APR-029',
    requestId: 'REQ-2024-0033',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-10-25T14:00:00Z',
    respondedAt: '2024-10-30T11:00:00Z',
    comments: 'SLA performance gap is clear. Framework rates apply. Approved.',
  },

  // REQ-2024-0035 (Deloitte audit - approved before cancellation)
  {
    id: 'APR-030',
    requestId: 'REQ-2024-0035',
    approverId: 'u7',
    approverName: 'Dr. Katrin Bauer',
    approverRole: 'Finance Approver',
    status: 'approved',
    requestedAt: '2024-09-30T14:00:00Z',
    respondedAt: '2024-10-10T11:00:00Z',
    comments: 'Approved. Note: request was subsequently cancelled.',
  },
];

export function getApprovalsByRequestId(requestId: string): ApprovalEntry[] {
  return approvalEntries.filter((a) => a.requestId === requestId);
}

export function getPendingApprovals(): ApprovalEntry[] {
  return approvalEntries.filter((a) => a.status === 'pending');
}

export function getApprovalsByApprover(approverId: string): ApprovalEntry[] {
  return approvalEntries.filter((a) => a.approverId === approverId);
}
