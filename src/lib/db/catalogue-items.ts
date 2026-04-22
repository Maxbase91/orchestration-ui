import { supabase } from '@/lib/supabase-client';
import type { CatalogueItem } from '@/data/catalogue-items';
import { mapDbToCatalogueItem, mapCatalogueItemToDb } from './mappers';

const TABLE = 'catalogue_items';

export async function listCatalogueItems(): Promise<CatalogueItem[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('id');
  if (error) throw error;
  return (data ?? []).map(mapDbToCatalogueItem);
}

export async function getCatalogueItem(id: string): Promise<CatalogueItem | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToCatalogueItem(data) : null;
}

export async function saveCatalogueItem(record: CatalogueItem): Promise<CatalogueItem> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(mapCatalogueItemToDb(record), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToCatalogueItem(data);
}

export async function deleteCatalogueItem(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
