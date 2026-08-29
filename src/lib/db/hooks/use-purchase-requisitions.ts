// TanStack Query hooks for governed requisitions and their checkout audit trail.
import { useQuery } from '@tanstack/react-query';
import { getPurchaseRequisition, getPurchaseRequisitionByRequest } from '../purchase-requisitions';
import { listRequestLines } from '../request-lines';

export function usePurchaseRequisition(id: string | undefined) {
  return useQuery({ queryKey: ['purchase-requisition', id], queryFn: () => getPurchaseRequisition(id!), enabled: Boolean(id) });
}

export function usePurchaseRequisitionByRequest(requestId: string | undefined) {
  return useQuery({ queryKey: ['purchase-requisition', 'request', requestId], queryFn: () => getPurchaseRequisitionByRequest(requestId!), enabled: Boolean(requestId) });
}

export function useRequestLines(requestId: string | undefined) {
  return useQuery({ queryKey: ['request-lines', requestId], queryFn: () => listRequestLines(requestId!), enabled: Boolean(requestId) });
}
