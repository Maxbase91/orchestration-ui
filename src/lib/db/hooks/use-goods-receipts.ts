import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listGoodsReceiptsForPO, createGoodsReceipt, type GoodsReceipt } from '@/lib/db/goods-receipts';

const KEYS = {
  all: ['goods-receipts'] as const,
  byPO: (poId: string) => ['goods-receipts', 'po', poId] as const,
};

export function useGoodsReceiptsForPO(poId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byPO(poId ?? ''),
    queryFn: () => listGoodsReceiptsForPO(poId!),
    enabled: Boolean(poId),
  });
}

export function useCreateGoodsReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (receipt: Omit<GoodsReceipt, 'id' | 'createdAt'>) => createGoodsReceipt(receipt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      // The receipt changes the PO status and line quantities, so the queue
      // must refresh immediately instead of waiting for a full page reload.
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      // A full receipt now moves the request out of `po` and writes a stage
      // history row, so the request screens have to refetch as well — without
      // this the lifecycle stepper still shows the old stage until a reload.
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['stage-history'] });
      qc.invalidateQueries({ queryKey: ['workflow-instances'] });
    },
  });
}
