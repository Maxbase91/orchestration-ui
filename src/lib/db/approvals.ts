import { supabase } from '@/lib/supabase-client';
import type { ApprovalEntry } from '@/data/types';
import { mapDbToApproval, mapApprovalToDb } from './mappers';

const TABLE = 'approval_entries';

export async function listApprovals(): Promise<ApprovalEntry[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('requested_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToApproval);
}

export async function getApproval(id: string): Promise<ApprovalEntry | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToApproval(data) : null;
}

export async function createApproval(record: ApprovalEntry): Promise<ApprovalEntry> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapApprovalToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToApproval(data);
}

export async function updateApproval(id: string, patch: Partial<ApprovalEntry>): Promise<ApprovalEntry> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapApprovalToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToApproval(data);
}

export async function deleteApproval(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
