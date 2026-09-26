// Reading suppliers with a given client — the browser's /api/db one or the
// server's in-process one — so the supplier port answers on either side with
// one query and one mapping. src/lib/db/suppliers.ts and the own-store
// connector both read through here. Relative '.js' specifiers only: api/
// imports this, and Vercel cannot resolve the '@/' alias at runtime.
import type { NeonCompatibleClient } from '../neon-compatible-client.js';
import type { Supplier } from '../../data/types.js';
import { mapDbToSupplier } from './mappers.js';

// The derived view, so active contracts and 12-month spend are live. Writes go
// to the base table (suppliers.ts).
export const SUPPLIER_READ_SOURCE = 'suppliers_with_derived';

export async function listSuppliersWith(client: NeonCompatibleClient): Promise<Supplier[]> {
  const { data, error } = await client.from(SUPPLIER_READ_SOURCE).select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(mapDbToSupplier);
}

export async function getSupplierWith(client: NeonCompatibleClient, id: string): Promise<Supplier | null> {
  const { data, error } = await client.from(SUPPLIER_READ_SOURCE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToSupplier(data) : null;
}
