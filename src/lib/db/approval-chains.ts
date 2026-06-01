import { supabase } from '@/lib/supabase-client';

export interface ApprovalChainStep {
  id: string;
  role: string;
}

export interface ApprovalChain {
  id: string;
  name: string;
  description: string;
  threshold: string;
  steps: ApprovalChainStep[];
  referencedBy: string[];
  createdAt?: string;
  updatedAt?: string;
}

const TABLE = 'approval_chains';

function mapDbToChain(row: Record<string, unknown>): ApprovalChain {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    threshold: (row.threshold as string) ?? '',
    steps: (row.steps as ApprovalChainStep[]) ?? [],
    referencedBy: (row.referenced_by as string[]) ?? [],
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}

function mapChainToDb(chain: ApprovalChain): Record<string, unknown> {
  return {
    id: chain.id,
    name: chain.name,
    description: chain.description,
    threshold: chain.threshold,
    steps: chain.steps,
    referenced_by: chain.referencedBy,
    updated_at: new Date().toISOString(),
  };
}

export async function listApprovalChains(): Promise<ApprovalChain[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('id');
  if (error) throw error;
  return (data ?? []).map(mapDbToChain);
}

export async function upsertApprovalChain(chain: ApprovalChain): Promise<ApprovalChain> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(mapChainToDb(chain), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToChain(data);
}

export async function deleteApprovalChain(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
