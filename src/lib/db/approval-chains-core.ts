// Reading the approval chains with a given client, so the browser and submit's
// second decision band a demand against the same chains in the same order.
// approval-chains.ts reads through here and re-exports the types. Relative
// '.js' specifiers only: api/ imports this.
import type { NeonCompatibleClient } from '../neon-compatible-client.js';

export interface ApprovalChainStep {
  id: string;
  role: string;
}

export interface ApprovalChain {
  id: string;
  name: string;
  description: string;
  /**
   * Rendered display label for the band, written from the bounds on save.
   * Never parsed — it was, by regex, and a string with no number in it read as
   * [0, Infinity) and shadowed every banded chain.
   */
  threshold: string;
  /** Inclusive lower bound: a literal, a `policy:` token, or null for open. */
  minValue?: string | null;
  /** Exclusive upper bound: a literal, a `policy:` token, or null for open. */
  maxValue?: string | null;
  steps: ApprovalChainStep[];
  createdAt?: string;
  updatedAt?: string;
}

const TABLE = 'approval_chains';

export function mapDbToChain(row: Record<string, unknown>): ApprovalChain {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    threshold: (row.threshold as string) ?? '',
    minValue: (row.min_value as string | null) ?? null,
    maxValue: (row.max_value as string | null) ?? null,
    steps: (row.steps as ApprovalChainStep[]) ?? [],
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}

// By id: the value band takes the first chain it falls into, so the order is
// part of the decision.
export async function listApprovalChainsWith(client: NeonCompatibleClient): Promise<ApprovalChain[]> {
  const { data, error } = await client.from(TABLE).select('*').order('id');
  if (error) throw error;
  return (data ?? []).map(mapDbToChain);
}
