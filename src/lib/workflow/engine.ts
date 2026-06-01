import { supabase } from '@/lib/supabase-client';
import { getWorkflowTemplate } from '@/lib/db/workflow-templates';
import { updateRequest } from '@/lib/db/requests';
import {
  createWorkflowInstance,
  getWorkflowInstanceForRequest,
  updateWorkflowInstance,
  type WorkflowInstance,
} from '@/lib/db/workflow-instances';
import type { WorkflowTemplate } from '@/data/types';
import { getStagesForChannel } from './buying-channel-stages';

// ── Label → RequestStatus normalisation ──────────────────────────────────────

const LABEL_TO_STATUS: Record<string, string> = {
  'intake': 'intake',
  'validation': 'validation',
  'approval': 'approval',
  'sourcing': 'sourcing',
  'contracting': 'contracting',
  'po creation': 'po',
  'po created': 'po',
  'auto-po': 'po',
  'manager approval': 'approval',
  'auto-validate': 'validation',
  'initial review': 'validation',
  'due diligence': 'validation',
  'receipt': 'receipt',
  'invoice': 'invoice',
  'payment': 'payment',
  'completed': 'completed',
  'complete': 'completed',
  'referred back': 'referred-back',
};

function nodeToStatus(label: string): string {
  const key = label.toLowerCase().trim();
  return LABEL_TO_STATUS[key] ?? key.replace(/\s+/g, '-');
}

// ── Chain step role → system role mapping ────────────────────────────────────

export const CHAIN_ROLE_TO_SYSTEM_ROLE: Record<string, string> = {
  'Budget Owner': 'service-owner',
  'Category Manager': 'procurement-manager',
  'Finance': 'procurement-manager',
  'VP Procurement': 'procurement-manager',
  'CFO': 'admin',
  'Board': 'admin',
  'Approver': 'procurement-manager',
  'Supplier Manager': 'vendor-manager',
  'Operations Lead': 'operations-lead',
  'New Approver': 'procurement-manager',
};

// ── Node traversal helpers ────────────────────────────────────────────────────

interface TemplateNode { id: string; type: string; label: string }
interface TemplateEdge { source: string; target: string; label?: string }

function getNextNodeIds(
  nodeId: string,
  edges: TemplateEdge[],
  outcome?: string,
): string[] {
  const outgoing = edges.filter((e) => e.source === nodeId);
  if (outgoing.length === 0) return [];

  // For decision nodes with an outcome hint, try to match edge label
  if (outcome) {
    const matched = outgoing.find(
      (e) => e.label?.toLowerCase().includes(outcome.toLowerCase()),
    );
    if (matched) return [matched.target];
  }

  // Phase 1: take ALL edges (supports parallel) — for decision nodes this means happy path
  // For stage nodes there's typically 1 outgoing edge
  return outgoing.map((e) => e.target);
}

// ── Generate approval entries from chain ──────────────────────────────────────

async function generateApprovalEntries(
  requestId: string,
  approvalChainName: string,
): Promise<void> {
  // Resolve the chain from approval_chains table
  const { data: chainRows } = await supabase
    .from('approval_chains')
    .select('*')
    .eq('id', approvalChainName)
    .maybeSingle();

  // Fallback: try matching by name
  const { data: chainByName } = !chainRows
    ? await supabase.from('approval_chains').select('*').ilike('name', `%${approvalChainName}%`).limit(1).maybeSingle()
    : { data: null };

  const chain = chainRows ?? chainByName;
  if (!chain) {
    console.warn(`[engine] approval chain not found: ${approvalChainName}`);
    // Fall through — create one default entry for procurement-manager
    await createDefaultApprovalEntry(requestId);
    return;
  }

  const steps = (chain.steps as { id: string; role: string }[]) ?? [];

  for (const step of steps) {
    const systemRole = CHAIN_ROLE_TO_SYSTEM_ROLE[step.role] ?? 'procurement-manager';

    // Find all users with this system role
    const { data: usersWithRole } = await supabase
      .from('users')
      .select('id, name, is_ooo, delegate_id')
      .eq('role', systemRole);

    const candidates = usersWithRole ?? [];
    const targets = candidates.length > 0 ? candidates : [{ id: 'u2', name: 'James Chen', is_ooo: false, delegate_id: null }];

    for (const user of targets) {
      const assigneeId = user.is_ooo && user.delegate_id ? user.delegate_id : user.id;

      await supabase.from('approval_entries').insert({
        request_id: requestId,
        approver_id: assigneeId,
        stage: step.role,
        status: 'pending',
        chain_id: chain.id,
        step_order: steps.indexOf(step),
      });
    }
  }
}

async function createDefaultApprovalEntry(requestId: string): Promise<void> {
  await supabase.from('approval_entries').insert({
    request_id: requestId,
    approver_id: 'u2', // procurement-manager default
    stage: 'Approval',
    status: 'pending',
    chain_id: null,
    step_order: 0,
  });
}

// ── Core engine functions ─────────────────────────────────────────────────────

/**
 * Creates a workflow instance for a request and immediately runs the start node.
 * If no templateId is provided, uses stage-list fallback.
 */
export async function initWorkflow(
  requestId: string,
  templateId: string | null | undefined,
  buyingChannel: string,
): Promise<void> {
  try {
    if (!templateId) {
      await initFallbackWorkflow(requestId, buyingChannel);
      return;
    }

    const template = await getWorkflowTemplate(templateId);
    if (!template) {
      await initFallbackWorkflow(requestId, buyingChannel);
      return;
    }

    const startNode = template.nodes.find((n) => n.type === 'start');
    if (!startNode) {
      await initFallbackWorkflow(requestId, buyingChannel);
      return;
    }

    const instance = await createWorkflowInstance(requestId, templateId, [startNode.id]);
    await advanceInstance(instance, template, undefined);
  } catch (e) {
    console.error('[engine] initWorkflow error:', e);
  }
}

/** Advance the workflow for a request (call after user action / approval). */
export async function advanceWorkflow(requestId: string, outcome?: string): Promise<void> {
  try {
    const instance = await getWorkflowInstanceForRequest(requestId);
    if (!instance) {
      console.warn('[engine] no workflow instance for', requestId);
      return;
    }
    if (instance.status === 'completed') return;

    const template = await getWorkflowTemplate(instance.templateId);
    if (!template) return;

    // Resume if suspended
    if (instance.status === 'suspended') {
      await updateWorkflowInstance(instance.id, { status: 'running' });
    }

    const fresh = { ...instance, status: 'running' as const };
    await advanceInstance(fresh, template, outcome);
  } catch (e) {
    console.error('[engine] advanceWorkflow error:', e);
  }
}

async function advanceInstance(
  instance: WorkflowInstance,
  template: WorkflowTemplate,
  outcome: string | undefined,
): Promise<void> {
  const nodeMap = new Map(template.nodes.map((n) => [n.id, n]));

  let currentNodeIds = [...instance.currentNodeIds];
  let instanceId = instance.id;

  // Process each current node
  for (const nodeId of currentNodeIds) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const result = await executeNode(node, instance.requestId, template, outcome);

    if (result === 'suspend') {
      // Engine waits for external trigger (approvals)
      await updateWorkflowInstance(instanceId, {
        currentNodeIds: [nodeId],
        status: 'suspended',
      });
      return;
    }

    if (result === 'complete') {
      await updateWorkflowInstance(instanceId, { currentNodeIds: [], status: 'completed' });
      return;
    }

    // Advance to next nodes
    const nextIds = getNextNodeIds(nodeId, template.edges, outcome);
    if (nextIds.length === 0) {
      await updateWorkflowInstance(instanceId, { currentNodeIds: [], status: 'completed' });
      return;
    }

    currentNodeIds = nextIds;
    await updateWorkflowInstance(instanceId, { currentNodeIds });

    // Immediately execute next node(s) if they're non-blocking
    for (const nextId of nextIds) {
      const nextNode = nodeMap.get(nextId);
      if (!nextNode) continue;

      if (nextNode.type === 'start' || nextNode.type === 'decision') {
        // Auto-advance through start and decision nodes
        continue; // handled in next loop iteration
      }

      const nextResult = await executeNode(nextNode, instance.requestId, template, undefined);
      if (nextResult === 'suspend') {
        await updateWorkflowInstance(instanceId, { currentNodeIds: [nextId], status: 'suspended' });
        return;
      }
      if (nextResult === 'complete') {
        await updateWorkflowInstance(instanceId, { currentNodeIds: [], status: 'completed' });
        return;
      }
      // For other types, advance further
      const afterIds = getNextNodeIds(nextId, template.edges, undefined);
      if (afterIds.length > 0) {
        await updateWorkflowInstance(instanceId, { currentNodeIds: afterIds });
      }
    }
    return; // only process the first current node per advance call
  }
}

type NodeResult = 'continue' | 'suspend' | 'complete';

async function executeNode(
  node: TemplateNode,
  requestId: string,
  template: WorkflowTemplate,
  outcome: string | undefined,
): Promise<NodeResult> {
  switch (node.type) {
    case 'start':
      return 'continue';

    case 'end':
      await updateRequest(requestId, { status: 'completed' });
      return 'complete';

    case 'error':
      await updateRequest(requestId, { status: 'referred-back' });
      return 'suspend';

    case 'stage': {
      const newStatus = nodeToStatus(node.label);
      await updateRequest(requestId, { status: newStatus as never });

      // Approval stage → generate entries + suspend
      if (newStatus === 'approval') {
        const { data: req } = await supabase
          .from('requests')
          .select('buying_channel, approval_chain')
          .eq('id', requestId)
          .maybeSingle();

        const chainName = (req as Record<string, unknown>)?.approval_chain as string | undefined
          ?? (req as Record<string, unknown>)?.buying_channel as string | undefined
          ?? 'chain-1';

        await generateApprovalEntries(requestId, chainName);
        return 'suspend';
      }

      return 'continue';
    }

    case 'decision':
      // Phase 1: always continue (first edge is taken by getNextNodeIds)
      return 'continue';

    case 'parallel':
      // Parallel split: all outgoing edges execute (handled in advanceInstance)
      return 'continue';

    case 'integration':
      // Stub: log and continue
      console.info(`[engine] integration node "${node.label}" for request ${requestId}`);
      return 'continue';

    default:
      return 'continue';
  }
}

// ── Fallback engine (no template) ────────────────────────────────────────────

async function initFallbackWorkflow(requestId: string, buyingChannel: string): Promise<void> {
  const stages = getStagesForChannel(buyingChannel);
  const firstStage = stages[0] ?? 'intake';

  // Create a synthetic instance using stage index as node id
  await createWorkflowInstance(requestId, `fallback:${buyingChannel}`, [`stage_0`], {
    stages,
    stageIndex: 0,
  });

  // Advance to first stage (usually 'intake', already set by createRequest)
  await updateRequest(requestId, { status: firstStage as never });
}

/** Check whether all approval entries for a request are approved. */
export async function areAllApprovalsComplete(requestId: string): Promise<boolean> {
  const { data: entries } = await supabase
    .from('approval_entries')
    .select('status')
    .eq('request_id', requestId)
    .eq('status', 'pending');

  return !entries || entries.length === 0;
}
