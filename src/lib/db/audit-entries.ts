import { supabase } from '@/lib/supabase-client';
import type { AuditEntry } from '@/data/types';
import { mapDbToAuditEntry, mapAuditEntryToDb } from './mappers';

const TABLE = 'audit_entries';

export async function listAuditEntries(limit = 200): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapDbToAuditEntry);
}

export async function createAuditEntry(
  record: Omit<AuditEntry, 'id'> & { id?: string },
): Promise<AuditEntry> {
  // Let Supabase generate the UUID PK; the mapper omits id when it's unset.
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapAuditEntryToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToAuditEntry(data);
}
