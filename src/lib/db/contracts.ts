import { db } from '@/lib/db-client';
import type { Contract } from '@/data/types';
import { mapDbToContract, mapContractToDb } from './mappers';

// Read side uses the derived view, so linked requests and the status (read
// from the end date) are live. Writes go to the base contracts table, and
// answer with the view's row, so what a caller gets back is what every screen
// then shows.
const READ_SOURCE = 'contracts_with_derived';
const TABLE = 'contracts';

export async function listContracts(): Promise<Contract[]> {
  const { data, error } = await db.from(READ_SOURCE).select('*').order('title');
  if (error) throw error;
  return (data ?? []).map(mapDbToContract);
}

export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await db.from(READ_SOURCE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToContract(data) : null;
}

export async function createContract(record: Contract): Promise<Contract> {
  const { data, error } = await db
    .from(TABLE)
    .insert(mapContractToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return (await getContract(record.id)) ?? mapDbToContract(data);
}

export async function updateContract(id: string, patch: Partial<Contract>): Promise<Contract> {
  const { data, error } = await db
    .from(TABLE)
    .update(mapContractToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return (await getContract(id)) ?? mapDbToContract(data);
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
