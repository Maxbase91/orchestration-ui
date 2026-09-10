// Reading the reference data approval derivation needs, and writing the entries
// it produces.
//
// Takes its client as a parameter for the same reason tickets-core.ts does: the
// browser holds the /api/db singleton and the serverless handlers hold the
// privileged in-process one, and src/lib/db/* imports the '@/'-aliased client
// that Vercel cannot resolve at runtime. Relative '.js' specifiers only.
import type { NeonCompatibleClient, DbRow } from '../neon-compatible-client.js';
import { selectApprovalChainForValue } from '../workflow/workflow-steps.js';
import {
  deriveApprovals,
  withContractOwnerStep,
  type ApprovalSources,
  type ChainStep,
  type DerivedApproval,
  type DirectoryUser,
} from '../procurement/approval-derivation.js';

export interface ApprovalRequestContext {
  requestId: string;
  /** 'contract-call-off' prepends the contract owner to the chain. */
  route?: string | null;
  /** The request's category, which decides who the category managers are. */
  category?: string | null;
  /** Set for a call-off, so the contract's owner can be asked. */
  contractId?: string | null;
  costCentre?: string | null;
}

/** Read everything derivation needs for one request. */
export async function loadApprovalSources(
  client: NeonCompatibleClient,
  context: ApprovalRequestContext,
): Promise<ApprovalSources> {
  const [userRows, managerRows, contractRows, centreRows] = await Promise.all([
    client.from('users').select('id, name, is_ooo, delegate_id'),
    context.category
      ? client.from('category_managers').select('user_id').eq('category_id', context.category)
      : Promise.resolve({ data: [], error: null }),
    context.contractId
      ? client.from('contracts').select('owner_id').eq('id', context.contractId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    context.costCentre
      ? client.from('cost_centres').select('owner').eq('id', context.costCentre).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const usersById = new Map<string, DirectoryUser>();
  for (const row of (userRows.data ?? []) as DbRow[]) {
    usersById.set(String(row.id), {
      id: String(row.id),
      name: String(row.name ?? row.id),
      isOoo: row.is_ooo === true,
      delegateId: row.delegate_id ? String(row.delegate_id) : null,
    });
  }

  return {
    usersById,
    categoryManagerIds: ((managerRows.data ?? []) as DbRow[]).map((row) => String(row.user_id)),
    contractOwnerId: (contractRows.data as DbRow | null)?.owner_id
      ? String((contractRows.data as DbRow).owner_id) : null,
    costCentreOwnerName: (centreRows.data as DbRow | null)?.owner
      ? String((centreRows.data as DbRow).owner) : null,
  };
}

/**
 * Which approval chain applies: the one the determination pinned, else the band
 * the value falls into, else the standard chain.
 *
 * The last fallback is deliberate. A request whose value matches no configured
 * band still has to be approved by somebody, and no entries at all is the
 * failure this whole change exists to remove.
 */
export async function resolveChainId(
  client: NeonCompatibleClient,
  explicitChain: string | null | undefined,
  value: number,
): Promise<string> {
  if (explicitChain) return explicitChain;
  const { data } = await client.from('approval_chains').select('id, threshold');
  const chains = ((data ?? []) as DbRow[]).map((row) => ({ id: String(row.id), threshold: String(row.threshold ?? '') }));
  return selectApprovalChainForValue(chains, value)?.id ?? 'chain-1';
}

/** The chain a request's value falls into, by stored threshold band. */
export async function loadChainSteps(
  client: NeonCompatibleClient,
  chainId: string | null | undefined,
): Promise<ChainStep[]> {
  if (!chainId) return [];
  const { data } = await client.from('approval_chains').select('steps').eq('id', chainId).maybeSingle();
  const steps = (data as DbRow | null)?.steps;
  return Array.isArray(steps) ? (steps as ChainStep[]) : [];
}

/** The rows to insert for a request, ready for the caller's transaction. */
export function approvalRows(requestId: string, derived: DerivedApproval[], now: string): DbRow[] {
  return derived.map((entry) => ({
    id: `APR-${requestId}-${entry.stepOrder}`,
    request_id: requestId,
    step_order: entry.stepOrder,
    assignment_mode: entry.assignmentMode,
    approver_id: entry.approverId,
    approver_name: entry.approverName,
    approver_role: entry.role,
    delegated_to: entry.delegatedTo,
    status: 'pending',
    requested_at: now,
  }));
}

/** Derive a request's approvals without writing them, for a caller with its own transaction. */
export async function deriveApprovalsFor(
  client: NeonCompatibleClient,
  context: ApprovalRequestContext,
  chainId: string | null | undefined,
): Promise<DerivedApproval[]> {
  const steps = withContractOwnerStep(await loadChainSteps(client, chainId), context.route);
  if (steps.length === 0) return [];
  return deriveApprovals(steps, await loadApprovalSources(client, context));
}

/**
 * Derive and persist a request's approval entries.
 *
 * Returns what was written so the caller can report it. An existing set is left
 * alone — re-deriving would discard decisions people have already made.
 */
export async function createApprovalsFor(
  client: NeonCompatibleClient,
  context: ApprovalRequestContext,
  chainId: string | null | undefined,
  now = new Date().toISOString(),
): Promise<DerivedApproval[]> {
  const existing = await client.from('approval_entries').select('id').eq('request_id', context.requestId);
  if (((existing.data ?? []) as DbRow[]).length > 0) return [];

  const steps = withContractOwnerStep(await loadChainSteps(client, chainId), context.route);
  if (steps.length === 0) return [];

  const sources = await loadApprovalSources(client, context);
  const derived = deriveApprovals(steps, sources);
  if (derived.length === 0) return [];

  const { error } = await client.from('approval_entries').insert(approvalRows(context.requestId, derived, now));
  if (error) throw new Error(error.message);
  return derived;
}
