// Data access for the `approval_chains` table (admin-configured approval
// sequences and their value thresholds). Components read through the
// use-approval-chains hooks. The read and its row mapping are in
// approval-chains-core.ts, shared with submit's second decision; the write
// mapping is here.
import { db } from '@/lib/db-client';
import { listApprovalChainsWith, mapDbToChain, type ApprovalChain } from './approval-chains-core';

export type { ApprovalChain, ApprovalChainStep } from './approval-chains-core';

const TABLE = 'approval_chains';

function mapChainToDb(chain: ApprovalChain): Record<string, unknown> {
  return {
    id: chain.id,
    name: chain.name,
    description: chain.description,
    threshold: chain.threshold,
    min_value: chain.minValue ?? null,
    max_value: chain.maxValue ?? null,
    steps: chain.steps,
    // Stamped client-side — there is no DB trigger maintaining updated_at.
    updated_at: new Date().toISOString(),
  };
}

export async function listApprovalChains(): Promise<ApprovalChain[]> {
  return listApprovalChainsWith(db);
}

export async function upsertApprovalChain(chain: ApprovalChain): Promise<ApprovalChain> {
  const { data, error } = await db
    .from(TABLE)
    .upsert(mapChainToDb(chain), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToChain(data);
}

export async function deleteApprovalChain(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
