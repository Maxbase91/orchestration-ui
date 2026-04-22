import { useEffect } from 'react';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { usePurchaseOrders } from '@/lib/db/hooks/use-purchase-orders';
import { useInvoices } from '@/lib/db/hooks/use-invoices';
import { useApprovals } from '@/lib/db/hooks/use-approvals';
import { useDatabaseAdminStore } from '@/stores/database-admin-store';

/**
 * Mirrors React Query data for Supabase-backed entities into the Zustand admin
 * store so the existing table-view / edit-sheet code can keep reading from the
 * store as its single source of truth. As new entities migrate to Supabase,
 * add their hooks here and extend `LIVE_ENTITIES` in the store.
 */
export function useSyncAdminStore() {
  const { data: suppliers, isSuccess: suppliersLoaded } = useSuppliers();
  const { data: contracts, isSuccess: contractsLoaded } = useContracts();
  const { data: riskAssessments, isSuccess: riskAssessmentsLoaded } = useRiskAssessments();
  const { data: purchaseOrders, isSuccess: purchaseOrdersLoaded } = usePurchaseOrders();
  const { data: invoices, isSuccess: invoicesLoaded } = useInvoices();
  const { data: approvals, isSuccess: approvalsLoaded } = useApprovals();
  const syncList = useDatabaseAdminStore((s) => s.syncList);

  useEffect(() => {
    if (suppliersLoaded && suppliers) {
      syncList('supplier', suppliers);
    }
  }, [suppliersLoaded, suppliers, syncList]);

  useEffect(() => {
    if (contractsLoaded && contracts) {
      syncList('contract', contracts);
    }
  }, [contractsLoaded, contracts, syncList]);

  useEffect(() => {
    if (riskAssessmentsLoaded && riskAssessments) {
      syncList('riskAssessment', riskAssessments);
    }
  }, [riskAssessmentsLoaded, riskAssessments, syncList]);

  useEffect(() => {
    if (purchaseOrdersLoaded && purchaseOrders) {
      syncList('purchaseOrder', purchaseOrders);
    }
  }, [purchaseOrdersLoaded, purchaseOrders, syncList]);

  useEffect(() => {
    if (invoicesLoaded && invoices) {
      syncList('invoice', invoices);
    }
  }, [invoicesLoaded, invoices, syncList]);

  useEffect(() => {
    if (approvalsLoaded && approvals) {
      syncList('approval', approvals);
    }
  }, [approvalsLoaded, approvals, syncList]);
}
