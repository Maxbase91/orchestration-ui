import { supabase } from '@/lib/supabase-client';

export interface GoodsReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  received: number;
}

export interface GoodsReceipt {
  id: string;
  poId: string;
  requestId?: string;
  receivedBy: string;
  receivedAt: string;
  notes: string;
  lineItems: GoodsReceiptLineItem[];
  status: 'complete' | 'partial';
  createdAt: string;
}

const TABLE = 'goods_receipts';

function mapRow(row: Record<string, unknown>): GoodsReceipt {
  return {
    id: row.id as string,
    poId: row.po_id as string,
    requestId: row.request_id as string | undefined,
    receivedBy: row.received_by as string,
    receivedAt: row.received_at as string,
    notes: (row.notes as string) ?? '',
    lineItems: (row.line_items as GoodsReceiptLineItem[]) ?? [],
    status: (row.status as GoodsReceipt['status']) ?? 'complete',
    createdAt: row.created_at as string,
  };
}

export async function listGoodsReceiptsForPO(poId: string): Promise<GoodsReceipt[]> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('po_id', poId).order('received_at');
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createGoodsReceipt(receipt: Omit<GoodsReceipt, 'id' | 'createdAt'>): Promise<GoodsReceipt> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      po_id: receipt.poId,
      request_id: receipt.requestId ?? null,
      received_by: receipt.receivedBy,
      received_at: receipt.receivedAt,
      notes: receipt.notes,
      line_items: receipt.lineItems,
      status: receipt.status,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}
