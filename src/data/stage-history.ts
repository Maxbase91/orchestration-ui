import type { StageHistoryEntry } from './types';

export const stageHistory: StageHistoryEntry[] = [
  // REQ-2024-0001 (Cloud hosting - completed)
  { requestId: 'REQ-2024-0001', stage: 'draft', enteredAt: '2024-03-15T09:00:00Z', completedAt: '2024-03-15T09:05:00Z', ownerId: 'u5', action: 'submitted', notes: 'Request submitted by Elena Petrova' },
  { requestId: 'REQ-2024-0001', stage: 'intake', enteredAt: '2024-03-15T09:05:00Z', completedAt: '2024-03-16T10:30:00Z', ownerId: 'u3', action: 'accepted', notes: 'Assigned to IT Procurement' },
  { requestId: 'REQ-2024-0001', stage: 'validation', enteredAt: '2024-03-16T10:30:00Z', completedAt: '2024-03-20T14:00:00Z', ownerId: 'u3', action: 'validated', notes: 'Validated against AWS EA' },
  { requestId: 'REQ-2024-0001', stage: 'approval', enteredAt: '2024-03-20T14:00:00Z', completedAt: '2024-03-25T11:00:00Z', ownerId: 'u7', action: 'approved', notes: 'Finance approved' },
  { requestId: 'REQ-2024-0001', stage: 'sourcing', enteredAt: '2024-03-25T11:00:00Z', completedAt: '2024-04-15T16:00:00Z', ownerId: 'u3', action: 'sourced', notes: 'AWS selected via framework' },
  { requestId: 'REQ-2024-0001', stage: 'contracting', enteredAt: '2024-04-15T16:00:00Z', completedAt: '2024-06-01T09:00:00Z', ownerId: 'u3', action: 'contracted', notes: 'Enterprise agreement amendment signed' },
  { requestId: 'REQ-2024-0001', stage: 'po', enteredAt: '2024-06-01T09:00:00Z', completedAt: '2024-06-15T10:00:00Z', ownerId: 'u3', action: 'po-created', notes: 'PO-001 created' },
  { requestId: 'REQ-2024-0001', stage: 'receipt', enteredAt: '2024-06-15T10:00:00Z', completedAt: '2024-09-30T17:00:00Z', ownerId: 'u5', action: 'received', notes: 'Migration completed' },
  { requestId: 'REQ-2024-0001', stage: 'invoice', enteredAt: '2024-09-30T17:00:00Z', completedAt: '2024-10-02T10:00:00Z', ownerId: 'u1', action: 'invoiced' },
  { requestId: 'REQ-2024-0001', stage: 'payment', enteredAt: '2024-10-02T10:00:00Z', completedAt: '2024-10-02T14:00:00Z', ownerId: 'u7', action: 'paid' },
  { requestId: 'REQ-2024-0001', stage: 'completed', enteredAt: '2024-10-02T14:00:00Z', completedAt: '2024-10-02T14:30:00Z', ownerId: 'u3', action: 'closed' },

  // REQ-2024-0002 (SAP renewal - completed)
  { requestId: 'REQ-2024-0002', stage: 'draft', enteredAt: '2024-06-01T10:00:00Z', completedAt: '2024-06-01T10:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0002', stage: 'intake', enteredAt: '2024-06-01T10:15:00Z', completedAt: '2024-06-05T09:00:00Z', ownerId: 'u3', action: 'accepted' },
  { requestId: 'REQ-2024-0002', stage: 'validation', enteredAt: '2024-06-05T09:00:00Z', completedAt: '2024-06-15T14:00:00Z', ownerId: 'u3', action: 'validated' },
  { requestId: 'REQ-2024-0002', stage: 'approval', enteredAt: '2024-06-15T14:00:00Z', completedAt: '2024-06-25T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0002', stage: 'sourcing', enteredAt: '2024-06-25T11:00:00Z', completedAt: '2024-07-15T11:00:00Z', ownerId: 'u3', action: 'negotiated', notes: '5% volume discount achieved' },
  { requestId: 'REQ-2024-0002', stage: 'contracting', enteredAt: '2024-07-15T11:00:00Z', completedAt: '2024-08-01T09:00:00Z', ownerId: 'u3', action: 'contracted' },
  { requestId: 'REQ-2024-0002', stage: 'po', enteredAt: '2024-08-01T09:00:00Z', completedAt: '2024-08-01T09:30:00Z', ownerId: 'u3', action: 'po-created' },
  { requestId: 'REQ-2024-0002', stage: 'receipt', enteredAt: '2024-08-01T09:30:00Z', completedAt: '2024-09-01T09:00:00Z', ownerId: 'u5', action: 'received' },
  { requestId: 'REQ-2024-0002', stage: 'invoice', enteredAt: '2024-09-01T09:00:00Z', completedAt: '2024-09-28T14:00:00Z', ownerId: 'u7', action: 'invoiced' },
  { requestId: 'REQ-2024-0002', stage: 'payment', enteredAt: '2024-09-28T14:00:00Z', completedAt: '2024-12-20T15:00:00Z', ownerId: 'u7', action: 'paid' },
  { requestId: 'REQ-2024-0002', stage: 'completed', enteredAt: '2024-12-20T15:00:00Z', completedAt: '2024-12-20T16:00:00Z', ownerId: 'u3', action: 'closed' },

  // REQ-2024-0003 (Office furniture - payment)
  { requestId: 'REQ-2024-0003', stage: 'draft', enteredAt: '2024-07-20T08:30:00Z', completedAt: '2024-07-20T09:00:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0003', stage: 'intake', enteredAt: '2024-07-20T09:00:00Z', completedAt: '2024-07-22T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0003', stage: 'validation', enteredAt: '2024-07-22T10:00:00Z', completedAt: '2024-07-30T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0003', stage: 'approval', enteredAt: '2024-07-30T14:00:00Z', completedAt: '2024-08-05T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0003', stage: 'sourcing', enteredAt: '2024-08-05T11:00:00Z', completedAt: '2024-08-20T16:00:00Z', ownerId: 'u1', action: 'framework-call-off' },
  { requestId: 'REQ-2024-0003', stage: 'contracting', enteredAt: '2024-08-20T16:00:00Z', completedAt: '2024-09-10T09:00:00Z', ownerId: 'u1', action: 'contracted' },
  { requestId: 'REQ-2024-0003', stage: 'po', enteredAt: '2024-09-10T09:00:00Z', completedAt: '2024-09-20T08:00:00Z', ownerId: 'u1', action: 'po-created' },
  { requestId: 'REQ-2024-0003', stage: 'receipt', enteredAt: '2024-09-20T08:00:00Z', completedAt: '2024-11-18T10:00:00Z', ownerId: 'u6', action: 'received' },
  { requestId: 'REQ-2024-0003', stage: 'invoice', enteredAt: '2024-11-18T10:00:00Z', completedAt: '2024-12-05T14:00:00Z', ownerId: 'u1', action: 'invoiced' },
  { requestId: 'REQ-2024-0003', stage: 'payment', enteredAt: '2024-12-05T14:00:00Z', ownerId: 'u7' },

  // REQ-2024-0004 (Marketing retainer - completed)
  { requestId: 'REQ-2024-0004', stage: 'draft', enteredAt: '2024-05-10T14:00:00Z', completedAt: '2024-05-10T14:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0004', stage: 'intake', enteredAt: '2024-05-10T14:15:00Z', completedAt: '2024-05-12T10:00:00Z', ownerId: 'u4', action: 'accepted' },
  { requestId: 'REQ-2024-0004', stage: 'validation', enteredAt: '2024-05-12T10:00:00Z', completedAt: '2024-05-20T14:00:00Z', ownerId: 'u4', action: 'validated' },
  { requestId: 'REQ-2024-0004', stage: 'approval', enteredAt: '2024-05-20T14:00:00Z', completedAt: '2024-05-28T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0004', stage: 'contracting', enteredAt: '2024-05-28T11:00:00Z', completedAt: '2024-06-01T14:00:00Z', ownerId: 'u4', action: 'contracted' },
  { requestId: 'REQ-2024-0004', stage: 'po', enteredAt: '2024-06-01T14:00:00Z', completedAt: '2024-06-01T14:30:00Z', ownerId: 'u4', action: 'po-created' },
  { requestId: 'REQ-2024-0004', stage: 'receipt', enteredAt: '2024-06-01T14:30:00Z', completedAt: '2024-12-20T10:00:00Z', ownerId: 'u6', action: 'received' },
  { requestId: 'REQ-2024-0004', stage: 'invoice', enteredAt: '2024-12-20T10:00:00Z', completedAt: '2024-12-25T14:00:00Z', ownerId: 'u4', action: 'invoiced' },
  { requestId: 'REQ-2024-0004', stage: 'payment', enteredAt: '2024-12-25T14:00:00Z', completedAt: '2024-12-28T09:00:00Z', ownerId: 'u7', action: 'paid' },
  { requestId: 'REQ-2024-0004', stage: 'completed', enteredAt: '2024-12-28T09:00:00Z', ownerId: 'u4', action: 'closed' },

  // REQ-2024-0005 (Security audit - completed)
  { requestId: 'REQ-2024-0005', stage: 'draft', enteredAt: '2024-08-01T07:00:00Z', completedAt: '2024-08-01T07:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0005', stage: 'intake', enteredAt: '2024-08-01T07:15:00Z', completedAt: '2024-08-03T10:00:00Z', ownerId: 'u4', action: 'accepted' },
  { requestId: 'REQ-2024-0005', stage: 'validation', enteredAt: '2024-08-03T10:00:00Z', completedAt: '2024-08-10T14:00:00Z', ownerId: 'u4', action: 'validated' },
  { requestId: 'REQ-2024-0005', stage: 'approval', enteredAt: '2024-08-10T14:00:00Z', completedAt: '2024-08-15T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0005', stage: 'contracting', enteredAt: '2024-08-15T11:00:00Z', completedAt: '2024-09-01T07:00:00Z', ownerId: 'u4', action: 'contracted' },
  { requestId: 'REQ-2024-0005', stage: 'po', enteredAt: '2024-09-01T07:00:00Z', completedAt: '2024-09-01T07:30:00Z', ownerId: 'u4', action: 'po-created' },
  { requestId: 'REQ-2024-0005', stage: 'receipt', enteredAt: '2024-09-01T07:30:00Z', completedAt: '2024-11-28T16:00:00Z', ownerId: 'u5', action: 'received' },
  { requestId: 'REQ-2024-0005', stage: 'invoice', enteredAt: '2024-11-28T16:00:00Z', completedAt: '2024-12-05T14:00:00Z', ownerId: 'u4', action: 'invoiced' },
  { requestId: 'REQ-2024-0005', stage: 'payment', enteredAt: '2024-12-05T14:00:00Z', completedAt: '2024-12-05T15:00:00Z', ownerId: 'u7', action: 'paid' },
  { requestId: 'REQ-2024-0005', stage: 'completed', enteredAt: '2024-12-05T15:00:00Z', ownerId: 'u4', action: 'closed' },

  // REQ-2024-0006 (ERP integration - overdue/sourcing)
  { requestId: 'REQ-2024-0006', stage: 'draft', enteredAt: '2024-09-10T11:00:00Z', completedAt: '2024-09-10T11:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0006', stage: 'intake', enteredAt: '2024-09-10T11:15:00Z', completedAt: '2024-09-12T10:00:00Z', ownerId: 'u3', action: 'accepted' },
  { requestId: 'REQ-2024-0006', stage: 'validation', enteredAt: '2024-09-12T10:00:00Z', completedAt: '2024-09-20T14:00:00Z', ownerId: 'u3', action: 'validated' },
  { requestId: 'REQ-2024-0006', stage: 'approval', enteredAt: '2024-09-20T14:00:00Z', completedAt: '2024-10-01T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0006', stage: 'sourcing', enteredAt: '2024-10-01T11:00:00Z', ownerId: 'u3', notes: 'RFP in progress - MuleSoft negotiation ongoing' },
  { requestId: 'REQ-2024-0006', stage: 'referred-back', enteredAt: '2024-11-15T10:00:00Z', completedAt: '2024-11-20T14:00:00Z', ownerId: 'u3', action: 'referred-back', notes: 'Budget revision needed for MuleSoft pricing' },
  { requestId: 'REQ-2024-0006', stage: 'sourcing', enteredAt: '2024-11-20T14:00:00Z', ownerId: 'u3', notes: 'Resumed sourcing after budget revision' },

  // REQ-2024-0007 (Java developers - overdue/approval)
  { requestId: 'REQ-2024-0007', stage: 'draft', enteredAt: '2024-10-25T13:00:00Z', completedAt: '2024-10-25T13:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0007', stage: 'intake', enteredAt: '2024-10-25T13:15:00Z', completedAt: '2024-10-28T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0007', stage: 'validation', enteredAt: '2024-10-28T10:00:00Z', completedAt: '2024-11-05T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0007', stage: 'approval', enteredAt: '2024-11-05T14:00:00Z', ownerId: 'u7', notes: 'Awaiting budget confirmation from programme board' },

  // REQ-2024-0008 (Managed print - overdue/validation)
  { requestId: 'REQ-2024-0008', stage: 'draft', enteredAt: '2024-11-01T09:00:00Z', completedAt: '2024-11-01T09:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0008', stage: 'intake', enteredAt: '2024-11-01T09:15:00Z', completedAt: '2024-11-05T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0008', stage: 'validation', enteredAt: '2024-11-05T10:00:00Z', ownerId: 'u1', notes: 'Stalled - awaiting usage data from IT' },

  // REQ-2024-0009 (Databricks - referred-back)
  { requestId: 'REQ-2024-0009', stage: 'draft', enteredAt: '2024-10-15T10:00:00Z', completedAt: '2024-10-15T10:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0009', stage: 'intake', enteredAt: '2024-10-15T10:15:00Z', completedAt: '2024-10-18T10:00:00Z', ownerId: 'u3', action: 'accepted' },
  { requestId: 'REQ-2024-0009', stage: 'validation', enteredAt: '2024-10-18T10:00:00Z', completedAt: '2024-10-30T14:00:00Z', ownerId: 'u3', action: 'validated' },
  { requestId: 'REQ-2024-0009', stage: 'sourcing', enteredAt: '2024-10-30T14:00:00Z', completedAt: '2024-11-20T10:00:00Z', ownerId: 'u3', action: 'sourced' },
  { requestId: 'REQ-2024-0009', stage: 'referred-back', enteredAt: '2024-11-20T10:00:00Z', completedAt: '2024-12-01T14:00:00Z', ownerId: 'u3', action: 'referred-back', notes: 'Need ROI analysis vs Azure ML' },
  { requestId: 'REQ-2024-0009', stage: 'sourcing', enteredAt: '2024-12-01T14:00:00Z', completedAt: '2024-12-15T10:00:00Z', ownerId: 'u3', action: 'resubmitted' },
  { requestId: 'REQ-2024-0009', stage: 'referred-back', enteredAt: '2024-12-15T10:00:00Z', ownerId: 'u3', action: 'referred-back', notes: 'Additional cost comparison required' },

  // REQ-2024-0010 (Corporate travel - referred-back)
  { requestId: 'REQ-2024-0010', stage: 'draft', enteredAt: '2024-11-05T11:00:00Z', completedAt: '2024-11-05T11:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0010', stage: 'intake', enteredAt: '2024-11-05T11:15:00Z', completedAt: '2024-11-08T10:00:00Z', ownerId: 'u4', action: 'accepted' },
  { requestId: 'REQ-2024-0010', stage: 'validation', enteredAt: '2024-11-08T10:00:00Z', completedAt: '2024-11-20T14:00:00Z', ownerId: 'u4', action: 'validated' },
  { requestId: 'REQ-2024-0010', stage: 'sourcing', enteredAt: '2024-11-20T14:00:00Z', completedAt: '2024-12-15T10:00:00Z', ownerId: 'u4' },
  { requestId: 'REQ-2024-0010', stage: 'referred-back', enteredAt: '2024-12-15T10:00:00Z', ownerId: 'u4', action: 'referred-back', notes: 'Scope clarification needed - EU only or including APAC?' },

  // REQ-2024-0011 (Cyber insurance - referred-back)
  { requestId: 'REQ-2024-0011', stage: 'draft', enteredAt: '2024-11-20T08:00:00Z', completedAt: '2024-11-20T08:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0011', stage: 'intake', enteredAt: '2024-11-20T08:15:00Z', completedAt: '2024-11-22T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0011', stage: 'validation', enteredAt: '2024-11-22T10:00:00Z', completedAt: '2024-12-05T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0011', stage: 'approval', enteredAt: '2024-12-05T14:00:00Z', completedAt: '2025-01-06T12:00:00Z', ownerId: 'u7' },
  { requestId: 'REQ-2024-0011', stage: 'referred-back', enteredAt: '2025-01-06T12:00:00Z', ownerId: 'u7', action: 'referred-back', notes: '35% premium increase needs board approval' },

  // REQ-2024-0012 (Warehouse racking - referred-back)
  { requestId: 'REQ-2024-0012', stage: 'draft', enteredAt: '2024-12-01T09:00:00Z', completedAt: '2024-12-01T09:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0012', stage: 'intake', enteredAt: '2024-12-01T09:15:00Z', completedAt: '2024-12-03T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0012', stage: 'validation', enteredAt: '2024-12-03T10:00:00Z', completedAt: '2024-12-20T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0012', stage: 'sourcing', enteredAt: '2024-12-20T14:00:00Z', completedAt: '2025-01-08T10:00:00Z', ownerId: 'u1' },
  { requestId: 'REQ-2024-0012', stage: 'referred-back', enteredAt: '2025-01-08T10:00:00Z', ownerId: 'u1', action: 'referred-back', notes: 'H&S safety specs revision required' },

  // REQ-2024-0013 (Microsoft 365 E5 - contracting)
  { requestId: 'REQ-2024-0013', stage: 'draft', enteredAt: '2024-10-20T10:00:00Z', completedAt: '2024-10-20T10:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0013', stage: 'intake', enteredAt: '2024-10-20T10:15:00Z', completedAt: '2024-10-23T10:00:00Z', ownerId: 'u3', action: 'accepted' },
  { requestId: 'REQ-2024-0013', stage: 'validation', enteredAt: '2024-10-23T10:00:00Z', completedAt: '2024-11-05T14:00:00Z', ownerId: 'u3', action: 'validated' },
  { requestId: 'REQ-2024-0013', stage: 'approval', enteredAt: '2024-11-05T14:00:00Z', completedAt: '2024-11-15T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0013', stage: 'sourcing', enteredAt: '2024-11-15T11:00:00Z', completedAt: '2024-12-10T16:00:00Z', ownerId: 'u3', action: 'negotiated' },
  { requestId: 'REQ-2024-0013', stage: 'contracting', enteredAt: '2024-12-10T16:00:00Z', ownerId: 'u3', notes: 'Contract amendment with legal' },

  // REQ-2024-0014 (McKinsey - approval)
  { requestId: 'REQ-2024-0014', stage: 'draft', enteredAt: '2024-11-15T14:00:00Z', completedAt: '2024-11-15T14:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0014', stage: 'intake', enteredAt: '2024-11-15T14:15:00Z', completedAt: '2024-11-18T10:00:00Z', ownerId: 'u4', action: 'accepted' },
  { requestId: 'REQ-2024-0014', stage: 'validation', enteredAt: '2024-11-18T10:00:00Z', completedAt: '2024-12-05T14:00:00Z', ownerId: 'u4', action: 'validated' },
  { requestId: 'REQ-2024-0014', stage: 'approval', enteredAt: '2024-12-05T14:00:00Z', ownerId: 'u11', notes: 'Dual VP approval required - >€1M' },

  // REQ-2024-0015 (Catering - sourcing)
  { requestId: 'REQ-2024-0015', stage: 'draft', enteredAt: '2024-11-01T08:00:00Z', completedAt: '2024-11-01T08:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0015', stage: 'intake', enteredAt: '2024-11-01T08:15:00Z', completedAt: '2024-11-05T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0015', stage: 'validation', enteredAt: '2024-11-05T10:00:00Z', completedAt: '2024-11-15T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0015', stage: 'approval', enteredAt: '2024-11-15T14:00:00Z', completedAt: '2024-11-22T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0015', stage: 'sourcing', enteredAt: '2024-11-22T11:00:00Z', ownerId: 'u1', notes: 'RFP issued to 4 caterers' },

  // REQ-2024-0016 (Laptop refresh - PO)
  { requestId: 'REQ-2024-0016', stage: 'draft', enteredAt: '2024-10-01T09:00:00Z', completedAt: '2024-10-01T09:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0016', stage: 'intake', enteredAt: '2024-10-01T09:15:00Z', completedAt: '2024-10-03T10:00:00Z', ownerId: 'u3', action: 'accepted' },
  { requestId: 'REQ-2024-0016', stage: 'validation', enteredAt: '2024-10-03T10:00:00Z', completedAt: '2024-10-15T14:00:00Z', ownerId: 'u3', action: 'validated' },
  { requestId: 'REQ-2024-0016', stage: 'approval', enteredAt: '2024-10-15T14:00:00Z', completedAt: '2024-10-25T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0016', stage: 'sourcing', enteredAt: '2024-10-25T11:00:00Z', completedAt: '2024-11-10T16:00:00Z', ownerId: 'u3', action: 'catalogue-order' },
  { requestId: 'REQ-2024-0016', stage: 'contracting', enteredAt: '2024-11-10T16:00:00Z', completedAt: '2024-12-01T09:00:00Z', ownerId: 'u3', action: 'contracted' },
  { requestId: 'REQ-2024-0016', stage: 'po', enteredAt: '2024-12-01T09:00:00Z', ownerId: 'u3', notes: 'PO-006 submitted to Lenovo' },

  // REQ-2024-0017 (KPMG tax - invoice)
  { requestId: 'REQ-2024-0017', stage: 'draft', enteredAt: '2024-07-15T10:00:00Z', completedAt: '2024-07-15T10:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0017', stage: 'intake', enteredAt: '2024-07-15T10:15:00Z', completedAt: '2024-07-18T10:00:00Z', ownerId: 'u4', action: 'accepted' },
  { requestId: 'REQ-2024-0017', stage: 'validation', enteredAt: '2024-07-18T10:00:00Z', completedAt: '2024-07-28T14:00:00Z', ownerId: 'u4', action: 'validated' },
  { requestId: 'REQ-2024-0017', stage: 'approval', enteredAt: '2024-07-28T14:00:00Z', completedAt: '2024-08-05T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0017', stage: 'contracting', enteredAt: '2024-08-05T11:00:00Z', completedAt: '2024-08-15T09:00:00Z', ownerId: 'u4', action: 'contracted' },
  { requestId: 'REQ-2024-0017', stage: 'po', enteredAt: '2024-08-15T09:00:00Z', completedAt: '2024-08-15T09:30:00Z', ownerId: 'u4', action: 'po-created' },
  { requestId: 'REQ-2024-0017', stage: 'receipt', enteredAt: '2024-08-15T09:30:00Z', completedAt: '2024-12-20T14:00:00Z', ownerId: 'u6', action: 'received' },
  { requestId: 'REQ-2024-0017', stage: 'invoice', enteredAt: '2024-12-20T14:00:00Z', ownerId: 'u4', notes: 'Invoice under processing' },

  // REQ-2024-0018 (Records management - receipt)
  { requestId: 'REQ-2024-0018', stage: 'draft', enteredAt: '2024-10-10T07:00:00Z', completedAt: '2024-10-10T07:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0018', stage: 'intake', enteredAt: '2024-10-10T07:15:00Z', completedAt: '2024-10-12T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0018', stage: 'validation', enteredAt: '2024-10-12T10:00:00Z', completedAt: '2024-10-18T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0018', stage: 'po', enteredAt: '2024-10-18T14:00:00Z', completedAt: '2024-11-15T08:00:00Z', ownerId: 'u1', action: 'po-created', notes: 'Direct PO - existing contract' },
  { requestId: 'REQ-2024-0018', stage: 'receipt', enteredAt: '2024-11-15T08:00:00Z', ownerId: 'u6', notes: 'Partial receipt - phase 1 scanning in progress' },

  // REQ-2024-0019 (TechBridge onboarding - validation)
  { requestId: 'REQ-2024-0019', stage: 'draft', enteredAt: '2024-12-10T11:00:00Z', completedAt: '2024-12-10T11:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0019', stage: 'intake', enteredAt: '2024-12-10T11:15:00Z', completedAt: '2024-12-13T10:00:00Z', ownerId: 'u9', action: 'accepted' },
  { requestId: 'REQ-2024-0019', stage: 'validation', enteredAt: '2024-12-13T10:00:00Z', ownerId: 'u9', notes: 'Screening and SRA in progress' },

  // REQ-2024-0020 (Cleaning services - sourcing)
  { requestId: 'REQ-2024-0020', stage: 'draft', enteredAt: '2024-11-15T09:00:00Z', completedAt: '2024-11-15T09:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0020', stage: 'intake', enteredAt: '2024-11-15T09:15:00Z', completedAt: '2024-11-18T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0020', stage: 'validation', enteredAt: '2024-11-18T10:00:00Z', completedAt: '2024-11-28T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0020', stage: 'approval', enteredAt: '2024-11-28T14:00:00Z', completedAt: '2024-12-05T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0020', stage: 'sourcing', enteredAt: '2024-12-05T11:00:00Z', ownerId: 'u1', notes: 'Consolidation RFP in progress' },

  // REQ-2024-0021 (Capgemini DevOps - contracting)
  { requestId: 'REQ-2024-0021', stage: 'draft', enteredAt: '2024-10-05T10:00:00Z', completedAt: '2024-10-05T10:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0021', stage: 'intake', enteredAt: '2024-10-05T10:15:00Z', completedAt: '2024-10-08T10:00:00Z', ownerId: 'u4', action: 'accepted' },
  { requestId: 'REQ-2024-0021', stage: 'validation', enteredAt: '2024-10-08T10:00:00Z', completedAt: '2024-10-20T14:00:00Z', ownerId: 'u4', action: 'validated' },
  { requestId: 'REQ-2024-0021', stage: 'approval', enteredAt: '2024-10-20T14:00:00Z', completedAt: '2024-10-30T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0021', stage: 'sourcing', enteredAt: '2024-10-30T11:00:00Z', completedAt: '2024-11-20T16:00:00Z', ownerId: 'u4', action: 'sourced' },
  { requestId: 'REQ-2024-0021', stage: 'contracting', enteredAt: '2024-11-20T16:00:00Z', ownerId: 'u4', notes: 'IP ownership negotiation with legal' },

  // REQ-2024-0022 (Employee benefits - intake)
  { requestId: 'REQ-2024-0022', stage: 'draft', enteredAt: '2025-01-02T10:00:00Z', completedAt: '2025-01-02T10:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0022', stage: 'intake', enteredAt: '2025-01-02T10:15:00Z', ownerId: 'u3', notes: 'Under initial review' },

  // REQ-2024-0023 (Siemens IoT - approval)
  { requestId: 'REQ-2024-0023', stage: 'draft', enteredAt: '2024-11-25T09:00:00Z', completedAt: '2024-11-25T09:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0023', stage: 'intake', enteredAt: '2024-11-25T09:15:00Z', completedAt: '2024-11-28T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0023', stage: 'validation', enteredAt: '2024-11-28T10:00:00Z', completedAt: '2024-12-10T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0023', stage: 'approval', enteredAt: '2024-12-10T14:00:00Z', ownerId: 'u7', notes: 'Pending finance approval' },

  // REQ-2024-0024 (Hays finance - PO)
  { requestId: 'REQ-2024-0024', stage: 'draft', enteredAt: '2024-12-05T08:00:00Z', completedAt: '2024-12-05T08:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0024', stage: 'intake', enteredAt: '2024-12-05T08:15:00Z', completedAt: '2024-12-06T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0024', stage: 'validation', enteredAt: '2024-12-06T10:00:00Z', completedAt: '2024-12-10T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0024', stage: 'approval', enteredAt: '2024-12-10T14:00:00Z', completedAt: '2024-12-12T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0024', stage: 'po', enteredAt: '2024-12-12T11:00:00Z', ownerId: 'u1', notes: 'PO-009 acknowledged by Hays' },

  // REQ-2024-0025 (Bosch components - validation)
  { requestId: 'REQ-2024-0025', stage: 'draft', enteredAt: '2024-12-15T10:00:00Z', completedAt: '2024-12-15T10:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0025', stage: 'intake', enteredAt: '2024-12-15T10:15:00Z', completedAt: '2024-12-18T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0025', stage: 'validation', enteredAt: '2024-12-18T10:00:00Z', ownerId: 'u1', notes: 'Sole source justification under review' },

  // REQ-2024-0026 (Corporate event - draft)
  { requestId: 'REQ-2024-0026', stage: 'draft', enteredAt: '2025-01-06T14:00:00Z', ownerId: 'u6', notes: 'Draft in progress' },

  // REQ-2024-0027 (Accenture cloud strategy - intake)
  { requestId: 'REQ-2024-0027', stage: 'draft', enteredAt: '2025-01-03T09:00:00Z', completedAt: '2025-01-03T09:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0027', stage: 'intake', enteredAt: '2025-01-03T09:15:00Z', ownerId: 'u4', notes: 'Reviewing Accenture proposal' },

  // REQ-2024-0028 (Network switches - sourcing)
  { requestId: 'REQ-2024-0028', stage: 'draft', enteredAt: '2024-11-20T10:00:00Z', completedAt: '2024-11-20T10:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0028', stage: 'intake', enteredAt: '2024-11-20T10:15:00Z', completedAt: '2024-11-22T10:00:00Z', ownerId: 'u3', action: 'accepted' },
  { requestId: 'REQ-2024-0028', stage: 'validation', enteredAt: '2024-11-22T10:00:00Z', completedAt: '2024-12-05T14:00:00Z', ownerId: 'u3', action: 'validated' },
  { requestId: 'REQ-2024-0028', stage: 'approval', enteredAt: '2024-12-05T14:00:00Z', completedAt: '2024-12-12T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0028', stage: 'sourcing', enteredAt: '2024-12-12T11:00:00Z', ownerId: 'u3', notes: 'Evaluating Cisco vs Juniper vs Arista' },

  // REQ-2024-0029 (GreenEnergy onboarding - intake)
  { requestId: 'REQ-2024-0029', stage: 'draft', enteredAt: '2025-01-05T11:00:00Z', completedAt: '2025-01-05T11:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0029', stage: 'intake', enteredAt: '2025-01-05T11:15:00Z', ownerId: 'u9', notes: 'Initial assessment' },

  // REQ-2024-0030 (C&W Facilities - contracting)
  { requestId: 'REQ-2024-0030', stage: 'draft', enteredAt: '2024-09-20T09:00:00Z', completedAt: '2024-09-20T09:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0030', stage: 'intake', enteredAt: '2024-09-20T09:15:00Z', completedAt: '2024-09-23T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0030', stage: 'validation', enteredAt: '2024-09-23T10:00:00Z', completedAt: '2024-10-05T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0030', stage: 'approval', enteredAt: '2024-10-05T14:00:00Z', completedAt: '2024-10-15T11:00:00Z', ownerId: 'u11', action: 'approved' },
  { requestId: 'REQ-2024-0030', stage: 'sourcing', enteredAt: '2024-10-15T11:00:00Z', completedAt: '2024-11-20T16:00:00Z', ownerId: 'u1', action: 'competitive-tender' },
  { requestId: 'REQ-2024-0030', stage: 'contracting', enteredAt: '2024-11-20T16:00:00Z', ownerId: 'u1', notes: 'SLA schedules agreed, legal review pending' },

  // REQ-2024-0031 (Salesforce expansion - approval)
  { requestId: 'REQ-2024-0031', stage: 'draft', enteredAt: '2024-12-01T10:00:00Z', completedAt: '2024-12-01T10:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0031', stage: 'intake', enteredAt: '2024-12-01T10:15:00Z', completedAt: '2024-12-03T10:00:00Z', ownerId: 'u3', action: 'accepted' },
  { requestId: 'REQ-2024-0031', stage: 'validation', enteredAt: '2024-12-03T10:00:00Z', completedAt: '2024-12-15T14:00:00Z', ownerId: 'u3', action: 'validated' },
  { requestId: 'REQ-2024-0031', stage: 'approval', enteredAt: '2024-12-15T14:00:00Z', ownerId: 'u7', notes: 'Pending finance approval' },

  // REQ-2024-0032 (Lab equipment - draft)
  { requestId: 'REQ-2024-0032', stage: 'draft', enteredAt: '2025-01-07T15:00:00Z', ownerId: 'u5', notes: 'Draft in progress' },

  // REQ-2024-0033 (Randstad IT helpdesk - receipt)
  { requestId: 'REQ-2024-0033', stage: 'draft', enteredAt: '2024-10-15T09:00:00Z', completedAt: '2024-10-15T09:15:00Z', ownerId: 'u5', action: 'submitted' },
  { requestId: 'REQ-2024-0033', stage: 'intake', enteredAt: '2024-10-15T09:15:00Z', completedAt: '2024-10-17T10:00:00Z', ownerId: 'u1', action: 'accepted' },
  { requestId: 'REQ-2024-0033', stage: 'validation', enteredAt: '2024-10-17T10:00:00Z', completedAt: '2024-10-25T14:00:00Z', ownerId: 'u1', action: 'validated' },
  { requestId: 'REQ-2024-0033', stage: 'approval', enteredAt: '2024-10-25T14:00:00Z', completedAt: '2024-10-30T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0033', stage: 'po', enteredAt: '2024-10-30T11:00:00Z', completedAt: '2024-11-01T09:00:00Z', ownerId: 'u1', action: 'po-created' },
  { requestId: 'REQ-2024-0033', stage: 'receipt', enteredAt: '2024-11-01T09:00:00Z', ownerId: 'u5', notes: 'L1 staff onboarded, L2 pending' },

  // REQ-2024-0034 (Translation services - intake)
  { requestId: 'REQ-2024-0034', stage: 'draft', enteredAt: '2025-01-04T10:00:00Z', completedAt: '2025-01-04T10:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0034', stage: 'intake', enteredAt: '2025-01-04T10:15:00Z', ownerId: 'u4', notes: 'Assessing scope and requirements' },

  // REQ-2024-0035 (Deloitte audit - cancelled)
  { requestId: 'REQ-2024-0035', stage: 'draft', enteredAt: '2024-09-15T09:00:00Z', completedAt: '2024-09-15T09:15:00Z', ownerId: 'u6', action: 'submitted' },
  { requestId: 'REQ-2024-0035', stage: 'intake', enteredAt: '2024-09-15T09:15:00Z', completedAt: '2024-09-18T10:00:00Z', ownerId: 'u4', action: 'accepted' },
  { requestId: 'REQ-2024-0035', stage: 'validation', enteredAt: '2024-09-18T10:00:00Z', completedAt: '2024-09-30T14:00:00Z', ownerId: 'u4', action: 'validated' },
  { requestId: 'REQ-2024-0035', stage: 'approval', enteredAt: '2024-09-30T14:00:00Z', completedAt: '2024-10-10T11:00:00Z', ownerId: 'u7', action: 'approved' },
  { requestId: 'REQ-2024-0035', stage: 'sourcing', enteredAt: '2024-10-10T11:00:00Z', completedAt: '2024-12-20T11:00:00Z', ownerId: 'u4' },
  { requestId: 'REQ-2024-0035', stage: 'cancelled', enteredAt: '2024-12-20T11:00:00Z', ownerId: 'u4', action: 'cancelled', notes: 'Decision to build in-house audit capability' },
];

export function getStageHistoryByRequestId(requestId: string): StageHistoryEntry[] {
  return stageHistory.filter((e) => e.requestId === requestId);
}
