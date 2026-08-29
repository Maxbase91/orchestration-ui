// Persistence for governed purchase requisitions. A requisition is the durable
// internal order record between intake and PO creation; it never writes upstream.
import { supabase } from '@/lib/supabase-client';
import type { PurchaseRequisition } from '@/data/types';
import { mapDbToPurchaseRequisition, mapPurchaseRequisitionToDb } from './mappers';

const TABLE = 'purchase_requisitions';

export async function getPurchaseRequisition(id: string): Promise<PurchaseRequisition | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToPurchaseRequisition(data) : null;
}

export async function getPurchaseRequisitionByRequest(requestId: string): Promise<PurchaseRequisition | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('request_id', requestId).maybeSingle();
  if (error) throw error;
  return data ? mapDbToPurchaseRequisition(data) : null;
}

export async function createPurchaseRequisition(record: PurchaseRequisition): Promise<PurchaseRequisition> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapPurchaseRequisitionToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToPurchaseRequisition(data);
}

export async function updatePurchaseRequisition(id: string, patch: Partial<PurchaseRequisition>): Promise<PurchaseRequisition> {
  const { data, error } = await supabase.from(TABLE).update(mapPurchaseRequisitionToDb(patch)).eq('id', id).select('*').single();
  if (error) throw error;
  return mapDbToPurchaseRequisition(data);
}
