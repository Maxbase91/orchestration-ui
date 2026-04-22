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
import { purchaseOrders as seedPOs } from '@/data/purchase-orders';
import { invoices as seedInvoices } from '@/data/invoices';
import { requests as seedRequests } from '@/data/requests';
import { approvalEntries as seedApprovals } from '@/data/approval-entries';
import { workflowTemplates as seedWorkflows } from '@/data/workflows';
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

/**
 * Which entities are backed by Supabase (edits persist across sessions and
 * propagate to every feature page) vs. still session-only local clones of
 * mock data. As each entity is migrated in Wave 1/2/3 it moves into LIVE_ENTITIES.
 */
const LIVE_ENTITIES = new Set<string>(['supplier', 'contract', 'riskAssessment']);

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
  purchaseOrder: cloneRecords(seedPOs),
  invoice: cloneRecords(seedInvoices),
  request: cloneRecords(seedRequests),
  approval: cloneRecords(seedApprovals),
  workflow: cloneRecords(seedWorkflows),
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
    set((state) => {
      const list = state[key] as EntityRecordMap[typeof key][];
      const next = list.filter((r) => (r as { id: string }).id !== id);
      const audit = makeAuditEntry('record.delete', key, id, detail);
      return { ...state, [key]: next, audit: [audit, ...state.audit] } as DatabaseAdminState;
    });
  },
  reset: () => {
    // Only resets session-only entities; Supabase-backed entities (suppliers,
    // contracts, risk-assessments, …) are re-synced by the sync hook on next
    // fetch.
    set({
      ...get(),
      purchaseOrder: cloneRecords(seedPOs),
      invoice: cloneRecords(seedInvoices),
      request: cloneRecords(seedRequests),
      approval: cloneRecords(seedApprovals),
      workflow: cloneRecords(seedWorkflows),
      audit: [],
    });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
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
