import { create } from 'zustand';
import type {
  Supplier,
  Contract,
  PurchaseOrder,
  Invoice,
  ProcurementRequest,
  ApprovalEntry,
  WorkflowTemplate,
  AuditEntry,
  RiskAssessment,
} from '@/data/types';
import { suppliers as seedSuppliers } from '@/data/suppliers';
import { contracts as seedContracts } from '@/data/contracts';
import { purchaseOrders as seedPOs } from '@/data/purchase-orders';
import { invoices as seedInvoices } from '@/data/invoices';
import { requests as seedRequests } from '@/data/requests';
import { approvalEntries as seedApprovals } from '@/data/approval-entries';
import { workflowTemplates as seedWorkflows } from '@/data/workflows';
import { riskAssessments as seedRiskAssessments } from '@/data/risk-assessments';
import { useAuthStore } from '@/stores/auth-store';

export type EntityKey =
  | 'supplier'
  | 'contract'
  | 'riskAssessment'
  | 'purchaseOrder'
  | 'invoice'
  | 'request'
  | 'approval'
  | 'workflow';

export interface EntityRecordMap {
  supplier: Supplier;
  contract: Contract;
  riskAssessment: RiskAssessment;
  purchaseOrder: PurchaseOrder;
  invoice: Invoice;
  request: ProcurementRequest;
  approval: ApprovalEntry;
  workflow: WorkflowTemplate;
}

interface DatabaseAdminState {
  supplier: Supplier[];
  contract: Contract[];
  riskAssessment: RiskAssessment[];
  purchaseOrder: PurchaseOrder[];
  invoice: Invoice[];
  request: ProcurementRequest[];
  approval: ApprovalEntry[];
  workflow: WorkflowTemplate[];
  audit: AuditEntry[];
  update: <K extends EntityKey>(key: K, id: string, patch: Partial<EntityRecordMap[K]>) => void;
  create: <K extends EntityKey>(key: K, record: EntityRecordMap[K]) => void;
  remove: <K extends EntityKey>(key: K, id: string) => void;
  reset: () => void;
}

function cloneRecords<T>(arr: T[]): T[] {
  return arr.map((item) => (typeof item === 'object' ? structuredClone(item) : item));
}

function makeAuditEntry(
  action: string,
  objectType: string,
  objectId: string,
  detail: string,
): AuditEntry {
  const user = useAuthStore.getState().currentUser;
  return {
    id: `AUD-DB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    action,
    objectType,
    objectId,
    detail,
    type: 'human',
  };
}

export const useDatabaseAdminStore = create<DatabaseAdminState>((set) => ({
  supplier: cloneRecords(seedSuppliers),
  contract: cloneRecords(seedContracts),
  riskAssessment: cloneRecords(seedRiskAssessments),
  purchaseOrder: cloneRecords(seedPOs),
  invoice: cloneRecords(seedInvoices),
  request: cloneRecords(seedRequests),
  approval: cloneRecords(seedApprovals),
  workflow: cloneRecords(seedWorkflows),
  audit: [],
  update: (key, id, patch) =>
    set((state) => {
      const list = state[key] as EntityRecordMap[typeof key][];
      const idx = list.findIndex((r) => (r as { id: string }).id === id);
      if (idx === -1) return state;
      const next = [...list];
      next[idx] = { ...list[idx], ...patch } as EntityRecordMap[typeof key];
      const changedKeys = Object.keys(patch as Record<string, unknown>).join(', ');
      const audit = makeAuditEntry(
        'record.update',
        key,
        id,
        `Updated fields: ${changedKeys || '(none)'} via Admin → Database`,
      );
      return { ...state, [key]: next, audit: [audit, ...state.audit] } as DatabaseAdminState;
    }),
  create: (key, record) =>
    set((state) => {
      const list = state[key] as EntityRecordMap[typeof key][];
      const id = (record as { id: string }).id;
      const audit = makeAuditEntry(
        'record.create',
        key,
        id,
        `Created new ${key} record via Admin → Database`,
      );
      return {
        ...state,
        [key]: [record, ...list],
        audit: [audit, ...state.audit],
      } as DatabaseAdminState;
    }),
  remove: (key, id) =>
    set((state) => {
      const list = state[key] as EntityRecordMap[typeof key][];
      const next = list.filter((r) => (r as { id: string }).id !== id);
      const audit = makeAuditEntry(
        'record.delete',
        key,
        id,
        `Deleted ${key} record via Admin → Database`,
      );
      return { ...state, [key]: next, audit: [audit, ...state.audit] } as DatabaseAdminState;
    }),
  reset: () =>
    set({
      supplier: cloneRecords(seedSuppliers),
      contract: cloneRecords(seedContracts),
      riskAssessment: cloneRecords(seedRiskAssessments),
      purchaseOrder: cloneRecords(seedPOs),
      invoice: cloneRecords(seedInvoices),
      request: cloneRecords(seedRequests),
      approval: cloneRecords(seedApprovals),
      workflow: cloneRecords(seedWorkflows),
      audit: [],
    }),
}));

export const entityLabels: Record<EntityKey, { singular: string; plural: string; route?: string }> = {
  supplier: { singular: 'Supplier', plural: 'Suppliers', route: '/suppliers' },
  contract: { singular: 'Contract', plural: 'Contracts', route: '/contracts' },
  riskAssessment: { singular: 'Risk Assessment', plural: 'Risk Assessments' },
  purchaseOrder: { singular: 'Purchase Order', plural: 'Purchase Orders', route: '/purchasing/orders' },
  invoice: { singular: 'Invoice', plural: 'Invoices', route: '/purchasing/invoices' },
  request: { singular: 'Request', plural: 'Requests', route: '/requests' },
  approval: { singular: 'Approval', plural: 'Approvals', route: '/approvals' },
  workflow: { singular: 'Workflow', plural: 'Workflows', route: '/admin/workflows' },
};
