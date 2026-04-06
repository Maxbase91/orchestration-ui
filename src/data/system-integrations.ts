export type ExternalSystem = 'ariba' | 'coupa-risk' | 'sirion' | 'sap';

export type IntegrationStatus =
  | 'pending-handover'
  | 'submitted'
  | 'awaiting-response'
  | 'processing'
  | 'completed'
  | 'error'
  | 'timeout';

export interface SystemIntegration {
  id: string;
  requestId: string;
  system: ExternalSystem;
  systemLabel: string;
  status: IntegrationStatus;
  submittedAt: string;
  respondedAt?: string;
  referenceId?: string;
  stage: string;
  detail: string;
}

export const systemLabels: Record<ExternalSystem, string> = {
  'ariba': 'SAP Ariba',
  'coupa-risk': 'Coupa Risk Assess',
  'sirion': 'Sirion CLM',
  'sap': 'SAP S/4HANA',
};

export const systemColors: Record<ExternalSystem, string> = {
  'ariba': 'bg-blue-100 text-blue-700 border-blue-200',
  'coupa-risk': 'bg-purple-100 text-purple-700 border-purple-200',
  'sirion': 'bg-teal-100 text-teal-700 border-teal-200',
  'sap': 'bg-amber-100 text-amber-700 border-amber-200',
};

export const systemIntegrations: SystemIntegration[] = [
  // REQ-2024-0001 (completed) — validation + sourcing + contracting + po
  {
    id: 'INT-001',
    requestId: 'REQ-2024-0001',
    system: 'coupa-risk',
    systemLabel: 'Coupa Risk Assess',
    status: 'completed',
    submittedAt: '2024-03-20T10:00:00Z',
    respondedAt: '2024-03-20T14:30:00Z',
    referenceId: 'CRA-2024-1102',
    stage: 'validation',
    detail: 'Supplier risk assessment for AWS cloud hosting engagement. Risk score: Low (12/100).',
  },
  {
    id: 'INT-002',
    requestId: 'REQ-2024-0001',
    system: 'sap',
    systemLabel: 'SAP S/4HANA',
    status: 'completed',
    submittedAt: '2024-05-15T09:00:00Z',
    respondedAt: '2024-05-15T09:12:00Z',
    referenceId: 'SAP-PO-4500012001',
    stage: 'po',
    detail: 'Purchase order created in SAP S/4HANA. PO number 4500012001.',
  },

  // REQ-2024-0002 (completed) — sourcing + contracting + po
  {
    id: 'INT-003',
    requestId: 'REQ-2024-0002',
    system: 'sirion',
    systemLabel: 'Sirion CLM',
    status: 'completed',
    submittedAt: '2024-08-10T11:00:00Z',
    respondedAt: '2024-08-14T16:00:00Z',
    referenceId: 'SIR-2024-0445',
    stage: 'contracting',
    detail: 'Contract renewal document generated and reviewed in Sirion CLM.',
  },
  {
    id: 'INT-004',
    requestId: 'REQ-2024-0002',
    system: 'sap',
    systemLabel: 'SAP S/4HANA',
    status: 'completed',
    submittedAt: '2024-09-01T08:30:00Z',
    respondedAt: '2024-09-01T08:45:00Z',
    referenceId: 'SAP-PO-4500012034',
    stage: 'po',
    detail: 'Purchase order created in SAP S/4HANA for SAP license renewal.',
  },

  // REQ-2024-0006 (sourcing, overdue)
  {
    id: 'INT-005',
    requestId: 'REQ-2024-0006',
    system: 'ariba',
    systemLabel: 'SAP Ariba',
    status: 'awaiting-response',
    submittedAt: '2024-11-28T14:00:00Z',
    stage: 'sourcing',
    detail: 'RFx event created in Ariba for ERP integration middleware. 3 suppliers invited, bid deadline passed.',
  },

  // REQ-2024-0013 (contracting)
  {
    id: 'INT-006',
    requestId: 'REQ-2024-0013',
    system: 'sirion',
    systemLabel: 'Sirion CLM',
    status: 'processing',
    submittedAt: '2024-12-20T10:00:00Z',
    stage: 'contracting',
    detail: 'Microsoft E5 license agreement under legal review in Sirion CLM.',
  },

  // REQ-2024-0015 (sourcing)
  {
    id: 'INT-007',
    requestId: 'REQ-2024-0015',
    system: 'ariba',
    systemLabel: 'SAP Ariba',
    status: 'completed',
    submittedAt: '2024-11-15T09:00:00Z',
    respondedAt: '2024-12-10T17:00:00Z',
    referenceId: 'ARIBA-2024-8834',
    stage: 'sourcing',
    detail: 'Catering services RFP completed. 5 bids received. Evaluation scorecard generated.',
  },

  // REQ-2024-0016 (po, laptop refresh)
  {
    id: 'INT-008',
    requestId: 'REQ-2024-0016',
    system: 'sap',
    systemLabel: 'SAP S/4HANA',
    status: 'completed',
    submittedAt: '2024-12-28T11:00:00Z',
    respondedAt: '2024-12-28T11:08:00Z',
    referenceId: 'SAP-PO-4500012089',
    stage: 'po',
    detail: 'Purchase order for 350 ThinkPad X1 Carbon laptops created in SAP.',
  },

  // REQ-2024-0021 (contracting)
  {
    id: 'INT-009',
    requestId: 'REQ-2024-0021',
    system: 'sirion',
    systemLabel: 'Sirion CLM',
    status: 'awaiting-response',
    submittedAt: '2024-12-18T14:30:00Z',
    stage: 'contracting',
    detail: 'DevOps transformation SOW submitted to Sirion for Capgemini contract review.',
  },

  // REQ-2024-0028 (sourcing)
  {
    id: 'INT-010',
    requestId: 'REQ-2024-0028',
    system: 'ariba',
    systemLabel: 'SAP Ariba',
    status: 'awaiting-response',
    submittedAt: '2024-12-15T10:00:00Z',
    stage: 'sourcing',
    detail: 'RFQ for network switches posted in Ariba. 4 suppliers invited, bids due 2025-01-15.',
  },

  // REQ-2024-0030 (contracting)
  {
    id: 'INT-011',
    requestId: 'REQ-2024-0030',
    system: 'sirion',
    systemLabel: 'Sirion CLM',
    status: 'completed',
    submittedAt: '2024-12-01T09:00:00Z',
    respondedAt: '2024-12-22T15:00:00Z',
    referenceId: 'SIR-2024-0612',
    stage: 'contracting',
    detail: 'Facilities management contract drafted and reviewed. Legal redlines incorporated.',
  },

  // REQ-2024-0008 (validation, overdue)
  {
    id: 'INT-012',
    requestId: 'REQ-2024-0008',
    system: 'coupa-risk',
    systemLabel: 'Coupa Risk Assess',
    status: 'error',
    submittedAt: '2024-12-02T11:00:00Z',
    stage: 'validation',
    detail: 'Supplier risk assessment failed — supplier profile not found in Coupa. Manual data entry required.',
  },

  // REQ-2024-0019 (validation)
  {
    id: 'INT-013',
    requestId: 'REQ-2024-0019',
    system: 'coupa-risk',
    systemLabel: 'Coupa Risk Assess',
    status: 'processing',
    submittedAt: '2024-12-20T14:00:00Z',
    stage: 'validation',
    detail: 'New supplier risk assessment in progress for TechBridge Solutions.',
  },

  // REQ-2024-0024 (po)
  {
    id: 'INT-014',
    requestId: 'REQ-2024-0024',
    system: 'sap',
    systemLabel: 'SAP S/4HANA',
    status: 'completed',
    submittedAt: '2024-12-10T08:00:00Z',
    respondedAt: '2024-12-10T08:06:00Z',
    referenceId: 'SAP-PO-4500012102',
    stage: 'po',
    detail: 'Purchase order for Hays finance temp staff created in SAP.',
  },

  // REQ-2024-0020 (sourcing)
  {
    id: 'INT-015',
    requestId: 'REQ-2024-0020',
    system: 'ariba',
    systemLabel: 'SAP Ariba',
    status: 'timeout',
    submittedAt: '2024-12-01T09:00:00Z',
    stage: 'sourcing',
    detail: 'RFP for cleaning services timed out — no response from Ariba after 30 days. Manual resubmission required.',
  },
];

export function getIntegrationsForRequest(requestId: string): SystemIntegration[] {
  return systemIntegrations.filter((i) => i.requestId === requestId);
}

export function getIntegrationsBySystem(system: ExternalSystem): SystemIntegration[] {
  return systemIntegrations.filter((i) => i.system === system);
}
