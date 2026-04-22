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
import { useAuthStore } from '@/stores/auth-store';
import { queryClient } from '@/lib/query-client';
import {
  createSupplier as dbCreateSupplier,
  updateSupplier as dbUpdateSupplier,
  deleteSupplier as dbDeleteSupplier,
} from '@/lib/db/suppliers';
import {
  createContract as dbCreateContract,
  updateContract as dbUpdateContract,
  deleteContract as dbDeleteContract,
} from '@/lib/db/contracts';
import {
  createRiskAssessment as dbCreateRiskAssessment,
  updateRiskAssessment as dbUpdateRiskAssessment,
  deleteRiskAssessment as dbDeleteRiskAssessment,
} from '@/lib/db/risk-assessments';
import {
  createPurchaseOrder as dbCreatePurchaseOrder,
  updatePurchaseOrder as dbUpdatePurchaseOrder,
  deletePurchaseOrder as dbDeletePurchaseOrder,
} from '@/lib/db/purchase-orders';
import {
  createInvoice as dbCreateInvoice,
  updateInvoice as dbUpdateInvoice,
  deleteInvoice as dbDeleteInvoice,
} from '@/lib/db/invoices';
import {
  createApproval as dbCreateApproval,
  updateApproval as dbUpdateApproval,
  deleteApproval as dbDeleteApproval,
} from '@/lib/db/approvals';
import {
  createRequest as dbCreateRequest,
  updateRequest as dbUpdateRequest,
  deleteRequest as dbDeleteRequest,
} from '@/lib/db/requests';

/**
 * Which entities are backed by Supabase (edits persist across sessions and
 * propagate to every feature page) vs. still session-only local clones of
 * mock data. As each entity is migrated in Wave 1/2/3 it moves into LIVE_ENTITIES.
 */
const LIVE_ENTITIES = new Set<string>([
  'supplier',
  'contract',
  'riskAssessment',
  'purchaseOrder',
  'invoice',
  'approval',
  'request',
  'workflow',
]);

export function isLiveEntity(key: string): boolean {
  return LIVE_ENTITIES.has(key);
}

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
  /** Replace an entity's cached list — used by the sync hook to mirror Supabase data into the store. */
  syncList: <K extends EntityKey>(key: K, list: EntityRecordMap[K][]) => void;
  update: <K extends EntityKey>(key: K, id: string, patch: Partial<EntityRecordMap[K]>) => Promise<void>;
  create: <K extends EntityKey>(key: K, record: EntityRecordMap[K]) => Promise<void>;
  remove: <K extends EntityKey>(key: K, id: string) => Promise<void>;
  reset: () => void;
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

function localUpdate<K extends EntityKey>(
  state: DatabaseAdminState,
  key: K,
  id: string,
  patch: Partial<EntityRecordMap[K]>,
  auditDetail: string,
): DatabaseAdminState {
  const list = state[key] as EntityRecordMap[K][];
  const idx = list.findIndex((r) => (r as { id: string }).id === id);
  if (idx === -1) return state;
  const next = [...list];
  next[idx] = { ...list[idx], ...patch } as EntityRecordMap[K];
  const audit = makeAuditEntry('record.update', key, id, auditDetail);
  return { ...state, [key]: next, audit: [audit, ...state.audit] } as DatabaseAdminState;
}

export const useDatabaseAdminStore = create<DatabaseAdminState>((set, get) => ({
  // Live entities initialise empty; the sync hook populates them from Supabase.
  supplier: [],
  contract: [],
  riskAssessment: [],
  purchaseOrder: [],
  invoice: [],
  request: [],
  approval: [],
  workflow: [],
  audit: [],
  syncList: (key, list) =>
    set((state) => ({ ...state, [key]: list } as DatabaseAdminState)),
  update: async (key, id, patch) => {
    const changedKeys = Object.keys(patch as Record<string, unknown>).join(', ');
    const detail = `Updated fields: ${changedKeys || '(none)'} via Admin → Database`;
    if (key === 'supplier') {
      const saved = await dbUpdateSupplier(id, patch as Partial<Supplier>);
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      set((state) => {
        const list = state.supplier;
        const idx = list.findIndex((s) => s.id === id);
        const next = idx >= 0 ? [...list.slice(0, idx), saved, ...list.slice(idx + 1)] : [saved, ...list];
        const audit = makeAuditEntry('record.update', 'supplier', id, detail);
        return { ...state, supplier: next, audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'contract') {
      const saved = await dbUpdateContract(id, patch as Partial<Contract>);
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      set((state) => {
        const list = state.contract;
        const idx = list.findIndex((c) => c.id === id);
        const next = idx >= 0 ? [...list.slice(0, idx), saved, ...list.slice(idx + 1)] : [saved, ...list];
        const audit = makeAuditEntry('record.update', 'contract', id, detail);
        return { ...state, contract: next, audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'riskAssessment') {
      const saved = await dbUpdateRiskAssessment(id, patch as Partial<RiskAssessment>);
      await queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
      set((state) => {
        const list = state.riskAssessment;
        const idx = list.findIndex((r) => r.id === id);
        const next = idx >= 0 ? [...list.slice(0, idx), saved, ...list.slice(idx + 1)] : [saved, ...list];
        const audit = makeAuditEntry('record.update', 'riskAssessment', id, detail);
        return { ...state, riskAssessment: next, audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'purchaseOrder') {
      const saved = await dbUpdatePurchaseOrder(id, patch as Partial<PurchaseOrder>);
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      set((state) => {
        const list = state.purchaseOrder;
        const idx = list.findIndex((p) => p.id === id);
        const next = idx >= 0 ? [...list.slice(0, idx), saved, ...list.slice(idx + 1)] : [saved, ...list];
        const audit = makeAuditEntry('record.update', 'purchaseOrder', id, detail);
        return { ...state, purchaseOrder: next, audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'invoice') {
      const saved = await dbUpdateInvoice(id, patch as Partial<Invoice>);
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      set((state) => {
        const list = state.invoice;
        const idx = list.findIndex((i) => i.id === id);
        const next = idx >= 0 ? [...list.slice(0, idx), saved, ...list.slice(idx + 1)] : [saved, ...list];
        const audit = makeAuditEntry('record.update', 'invoice', id, detail);
        return { ...state, invoice: next, audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'approval') {
      const saved = await dbUpdateApproval(id, patch as Partial<ApprovalEntry>);
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      set((state) => {
        const list = state.approval;
        const idx = list.findIndex((a) => a.id === id);
        const next = idx >= 0 ? [...list.slice(0, idx), saved, ...list.slice(idx + 1)] : [saved, ...list];
        const audit = makeAuditEntry('record.update', 'approval', id, detail);
        return { ...state, approval: next, audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'request') {
      const saved = await dbUpdateRequest(id, patch as Partial<ProcurementRequest>);
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      set((state) => {
        const list = state.request;
        const idx = list.findIndex((r) => r.id === id);
        const next = idx >= 0 ? [...list.slice(0, idx), saved, ...list.slice(idx + 1)] : [saved, ...list];
        const audit = makeAuditEntry('record.update', 'request', id, detail);
        return { ...state, request: next, audit: [audit, ...state.audit] };
      });
      return;
    }
    set((state) => localUpdate(state, key, id, patch, detail));
  },
  create: async (key, record) => {
    const id = (record as { id: string }).id;
    const detail = `Created new ${key} record via Admin → Database`;
    if (key === 'supplier') {
      const saved = await dbCreateSupplier(record as Supplier);
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      set((state) => {
        const audit = makeAuditEntry('record.create', 'supplier', saved.id, detail);
        return { ...state, supplier: [saved, ...state.supplier], audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'contract') {
      const saved = await dbCreateContract(record as Contract);
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      set((state) => {
        const audit = makeAuditEntry('record.create', 'contract', saved.id, detail);
        return { ...state, contract: [saved, ...state.contract], audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'riskAssessment') {
      const saved = await dbCreateRiskAssessment(record as RiskAssessment);
      await queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
      set((state) => {
        const audit = makeAuditEntry('record.create', 'riskAssessment', saved.id, detail);
        return { ...state, riskAssessment: [saved, ...state.riskAssessment], audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'purchaseOrder') {
      const saved = await dbCreatePurchaseOrder(record as PurchaseOrder);
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      set((state) => {
        const audit = makeAuditEntry('record.create', 'purchaseOrder', saved.id, detail);
        return { ...state, purchaseOrder: [saved, ...state.purchaseOrder], audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'invoice') {
      const saved = await dbCreateInvoice(record as Invoice);
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      set((state) => {
        const audit = makeAuditEntry('record.create', 'invoice', saved.id, detail);
        return { ...state, invoice: [saved, ...state.invoice], audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'approval') {
      const saved = await dbCreateApproval(record as ApprovalEntry);
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      set((state) => {
        const audit = makeAuditEntry('record.create', 'approval', saved.id, detail);
        return { ...state, approval: [saved, ...state.approval], audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'request') {
      const saved = await dbCreateRequest(record as ProcurementRequest);
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      set((state) => {
        const audit = makeAuditEntry('record.create', 'request', saved.id, detail);
        return { ...state, request: [saved, ...state.request], audit: [audit, ...state.audit] };
      });
      return;
    }
    set((state) => {
      const list = state[key] as EntityRecordMap[typeof key][];
      const audit = makeAuditEntry('record.create', key, id, detail);
      return {
        ...state,
        [key]: [record, ...list],
        audit: [audit, ...state.audit],
      } as DatabaseAdminState;
    });
  },
  remove: async (key, id) => {
    const detail = `Deleted ${key} record via Admin → Database`;
    if (key === 'supplier') {
      await dbDeleteSupplier(id);
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      set((state) => {
        const audit = makeAuditEntry('record.delete', 'supplier', id, detail);
        return { ...state, supplier: state.supplier.filter((s) => s.id !== id), audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'contract') {
      await dbDeleteContract(id);
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      set((state) => {
        const audit = makeAuditEntry('record.delete', 'contract', id, detail);
        return { ...state, contract: state.contract.filter((c) => c.id !== id), audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'riskAssessment') {
      await dbDeleteRiskAssessment(id);
      await queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
      set((state) => {
        const audit = makeAuditEntry('record.delete', 'riskAssessment', id, detail);
        return { ...state, riskAssessment: state.riskAssessment.filter((r) => r.id !== id), audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'purchaseOrder') {
      await dbDeletePurchaseOrder(id);
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      set((state) => {
        const audit = makeAuditEntry('record.delete', 'purchaseOrder', id, detail);
        return { ...state, purchaseOrder: state.purchaseOrder.filter((p) => p.id !== id), audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'invoice') {
      await dbDeleteInvoice(id);
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      set((state) => {
        const audit = makeAuditEntry('record.delete', 'invoice', id, detail);
        return { ...state, invoice: state.invoice.filter((i) => i.id !== id), audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'approval') {
      await dbDeleteApproval(id);
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      set((state) => {
        const audit = makeAuditEntry('record.delete', 'approval', id, detail);
        return { ...state, approval: state.approval.filter((a) => a.id !== id), audit: [audit, ...state.audit] };
      });
      return;
    }
    if (key === 'request') {
      await dbDeleteRequest(id);
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      set((state) => {
        const audit = makeAuditEntry('record.delete', 'request', id, detail);
        return { ...state, request: state.request.filter((r) => r.id !== id), audit: [audit, ...state.audit] };
      });
      return;
    }
    set((state) => {
      const list = state[key] as EntityRecordMap[typeof key][];
      const next = list.filter((r) => (r as { id: string }).id !== id);
      const audit = makeAuditEntry('record.delete', key, id, detail);
      return { ...state, [key]: next, audit: [audit, ...state.audit] } as DatabaseAdminState;
    });
  },
  reset: () => {
    // Only resets session-only entities; Supabase-backed entities are
    // re-synced by the sync hook on next fetch.
    set({
      ...get(),
      workflow: [],
      audit: [],
    });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
    queryClient.invalidateQueries({ queryKey: ['requests'] });
  },
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
