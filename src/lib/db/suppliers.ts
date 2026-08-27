import { supabase } from '@/lib/supabase-client';
import type { Supplier } from '@/data/types';
import { mapDbToSupplier, mapSupplierToDb } from './mappers';

// Read side uses the derived view so active_contracts / total_spend_12m
// are recomputed on every fetch. Writes still target the base table.
const READ_SOURCE = 'suppliers_with_derived';
const TABLE = 'suppliers';

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from(READ_SOURCE).select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(mapDbToSupplier);
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase.from(READ_SOURCE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToSupplier(data) : null;
}

export async function createSupplier(record: Supplier): Promise<Supplier> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapSupplierToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToSupplier(data);
}

export async function updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapSupplierToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToSupplier(data);
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
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
