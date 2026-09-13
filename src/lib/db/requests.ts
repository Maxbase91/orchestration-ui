// CRUD for the `requests` table — the central procurement-request entity.
// Components read through the use-requests hooks; row mapping is shared via
// ./mappers. Lists newest-first.
import { db } from '@/lib/db-client';
import type { ProcurementRequest } from '@/data/types';
import { mapDbToRequest, mapRequestToDb } from './mappers';

// Reads go through the derived view so days_in_stage is recomputed on every
// fetch — the stored column is written 0 and never incremented. Writes still
// target the base table. Same split as suppliers.ts and contracts.ts.
const READ_SOURCE = 'requests_with_derived';
const TABLE = 'requests';

/**
 * Next request id from the Postgres sequence, mirroring nextTicketId().
 *
 * Replaces a `REQ-2025-` + 4-random-digit generator: 9,000 ids across all
 * users, and a collision was not a duplicate-key error but a silent discard —
 * intake-submit found the existing row and replayed it back.
 *
 * The fallback is deliberately shaped NOT to match the sequence's high-water
 * pattern (^REQ-\d{4}-(\d+)$). One that did match would set the sequence to a
 * timestamp on the next schema apply and burn ten thousand ids.
 */
export async function nextRequestId(): Promise<string> {
  const { data, error } = await db.rpc('next_request_id');
  if (error || !data) return `REQ-${new Date().getFullYear()}-T${Date.now().toString(36)}`;
  return String(data);
}

export async function listRequests(): Promise<ProcurementRequest[]> {
  const { data, error } = await db.from(READ_SOURCE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToRequest);
}

export async function getRequest(id: string): Promise<ProcurementRequest | null> {
  const { data, error } = await db.from(READ_SOURCE).select('*').eq('id', id).maybeSingle();
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
