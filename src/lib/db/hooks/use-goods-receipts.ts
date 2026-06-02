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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
