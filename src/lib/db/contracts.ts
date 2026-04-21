import { supabase } from '@/lib/supabase-client';
import type { Contract } from '@/data/types';
import { mapDbToContract, mapContractToDb } from './mappers';

const TABLE = 'contracts';

export async function listContracts(): Promise<Contract[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('title');
  if (error) throw error;
  return (data ?? []).map(mapDbToContract);
}

export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToContract(data) : null;
}

export async function createContract(record: Contract): Promise<Contract> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapContractToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToContract(data);
}

export async function updateContract(id: string, patch: Partial<Contract>): Promise<Contract> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapContractToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToContract(data);
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
