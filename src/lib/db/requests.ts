// CRUD for the `requests` table — the central procurement-request entity.
// Components read through the use-requests hooks; row mapping is shared via
// ./mappers. Lists newest-first.
import { db } from '@/lib/db-client';
import type { ProcurementRequest } from '@/data/types';
import { mapDbToRequest, mapRequestToDb } from './mappers';

const TABLE = 'requests';

export async function listRequests(): Promise<ProcurementRequest[]> {
  const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToRequest);
}

export async function getRequest(id: string): Promise<ProcurementRequest | null> {
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToRequest(data) : null;
}

export async function createRequest(record: Partial<ProcurementRequest>): Promise<ProcurementRequest> {
  const { data, error } = await db
    .from(TABLE)
    .insert(mapRequestToDb(record))
    .select('*')
    .single();
  if (error) {
    // Surface the database's details/hint alongside the message — intake submits
    // fail here most often (constraint violations) and the bare message alone
    // is rarely enough to diagnose.
    const detail = (error as { message?: string; details?: string; hint?: string });
    const msg = [detail.message, detail.details, detail.hint].filter(Boolean).join(' — ');
    throw new Error(msg || String(error));
  }
  return mapDbToRequest(data);
}

export async function updateRequest(
  id: string,
  patch: Partial<ProcurementRequest>,
): Promise<ProcurementRequest> {
  const { data, error } = await db
    .from(TABLE)
    .update(mapRequestToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToRequest(data);
}

export async function deleteRequest(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
