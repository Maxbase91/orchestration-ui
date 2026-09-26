import { db } from '@/lib/db-client';
import type { Supplier } from '@/data/types';
import { mapDbToSupplier, mapSupplierToDb } from './mappers';
import { getSupplierWith, listSuppliersWith } from './suppliers-core';

// Reads come from the derived view, through suppliers-core.ts — the same query
// the server's supplier port runs. Writes still target the base table.
const TABLE = 'suppliers';

export async function listSuppliers(): Promise<Supplier[]> {
  return listSuppliersWith(db);
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  return getSupplierWith(db, id);
}

export async function createSupplier(record: Supplier): Promise<Supplier> {
  const { data, error } = await db
    .from(TABLE)
    .insert(mapSupplierToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToSupplier(data);
}

export async function updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await db
    .from(TABLE)
    .update(mapSupplierToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToSupplier(data);
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/**
 * Create a supplier named on a demand but not in the directory.
 *
 * Everything unknown is left at a neutral zero or an explicit "not yet" rather
 * than a plausible-looking default: a brand-new vendor has no spend history, no
 * contracts and no performance score, and inventing a risk rating for one the
 * platform has never dealt with would feed a fabricated value straight into the
 * inherent-risk cascade and materiality. `screeningStatus: 'pending'` and
 * `riskRating: 'medium'` are the honest "unassessed" positions — and `pending`
 * is exactly what the light-onboarding gate blocks on.
 */
export async function createProspectiveSupplier(
  name: string,
  requestId?: string,
): Promise<Supplier> {
  const id = `SUP-P-${Date.now().toString(36).toUpperCase()}`;
  return createSupplier({
    id,
    name,
    country: '',
    countryCode: '',
    riskRating: 'medium',
    activeContracts: 0,
    totalSpend12m: 0,
    onboardingStatus: 'not-started',
    sraStatus: 'not-assessed',
    screeningStatus: 'pending',
    categories: [],
    tier: 3,
    prospective: true,
    ...(requestId ? { createdFromRequestId: requestId } : {}),
    duns: '',
    address: '',
    primaryContact: '',
    primaryContactEmail: '',
    certifications: [],
    spendHistory: [],
    performanceScore: 0,
  });
}
