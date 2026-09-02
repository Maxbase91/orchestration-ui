// CRUD for the `purchase_orders` table. Components read through the
// use-purchase-orders hooks; row mapping is shared via ./mappers. Lists
// newest-first.
import { db } from '@/lib/db-client';
import type { PurchaseOrder } from '@/data/types';
import { mapDbToPurchaseOrder, mapPurchaseOrderToDb } from './mappers';

const TABLE = 'purchase_orders';

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToPurchaseOrder);
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToPurchaseOrder(data) : null;
}

export async function createPurchaseOrder(record: PurchaseOrder): Promise<PurchaseOrder> {
  const { data, error } = await db
    .from(TABLE)
    .insert(mapPurchaseOrderToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToPurchaseOrder(data);
}

export async function updatePurchaseOrder(
  id: string,
  patch: Partial<PurchaseOrder>,
): Promise<PurchaseOrder> {
  const { data, error } = await db
    .from(TABLE)
    .update(mapPurchaseOrderToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToPurchaseOrder(data);
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
