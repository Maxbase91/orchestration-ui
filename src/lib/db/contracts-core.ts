// Reading contracts with a given client, so the contract port answers in the
// browser and on the server with one query and one mapping. contracts.ts and
// the own-store connector both read through here. Relative '.js' specifiers
// only: api/ imports this.
import type { NeonCompatibleClient } from '../neon-compatible-client.js';
import type { Contract } from '../../data/types.js';
import { mapDbToContract } from './mappers.js';

// The derived view, so linked requests and the status (read from the end date)
// are live. Writes go to the base table (contracts.ts).
export const CONTRACT_READ_SOURCE = 'contracts_with_derived';

export async function listContractsWith(client: NeonCompatibleClient): Promise<Contract[]> {
  const { data, error } = await client.from(CONTRACT_READ_SOURCE).select('*').order('title');
  if (error) throw error;
  return (data ?? []).map(mapDbToContract);
}

export async function getContractWith(client: NeonCompatibleClient, id: string): Promise<Contract | null> {
  const { data, error } = await client.from(CONTRACT_READ_SOURCE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToContract(data) : null;
}
