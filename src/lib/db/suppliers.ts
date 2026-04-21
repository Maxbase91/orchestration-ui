import { supabase } from '@/lib/supabase-client';
import type { Supplier } from '@/data/types';
import { mapDbToSupplier, mapSupplierToDb } from './mappers';

const TABLE = 'suppliers';

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(mapDbToSupplier);
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
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
