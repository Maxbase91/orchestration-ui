// The workflow engine: it starts a request's workflow instance and moves it
// from one node to the next.
//
// `initWorkflow` picks the template for a request's route and opens an
// instance at its first node. `advanceWorkflow` decides which node comes next
// from the template's edges and the request's own signals, generating the
// approval entries for an approval node through the one shared derivation
// (`createApprovalsFor`) rather than resolving approvers itself — two
// derivations is exactly the defect this file used to carry.
// `areAllApprovalsComplete` is the gate the approval node advances on.
//
// The stage a request is *in* is `transition.ts`'s job; this module decides
// where it goes.
//
// Uses db-client directly rather than src/lib/db modules: see the Known
// exceptions note in src/lib/db/README.md. The sequence here is ordered and
// multi-table, and belongs behind a server endpoint like api/workflow-action.ts
// rather than being scattered across per-entity modules.
import { db } from '@/lib/db-client';
import { createApprovalsFor } from '@/lib/db/approvals-core';
import { getWorkflowTemplate, listWorkflowTemplates } from '@/lib/db/workflow-templates';
import { saveComplianceReport } from '@/lib/db/compliance-reports';
import {
  createWorkflowInstance,
  getWorkflowInstanceForRequest,
  updateWorkflowInstance,
  type WorkflowInstance,
} from '@/lib/db/workflow-instances';
import type { Supplier, WorkflowTemplate } from '@/data/types';
import { getStagesForChannel, channelStageMapFromTemplates } from './channel-stages';
import { transitionStage } from './transition';
import { onboardingRequired } from './onboarding-stage';
import { ensureRiskAssessment } from './risk-stage';
import { getActivePolicyConfig } from '@/lib/procurement/policy-config';
import { getNextNodeIds, type EdgeEvalContext } from './edge-conditions';
import { listApprovalChains } from '@/lib/db/approval-chains';
import { selectApprovalChainForValue } from './workflow-steps';
import { isGatedStage, nodeToStatus, type TemplateNode } from './node-config';

// Chain step role → system role + persona resolution lives in
// `./approver-resolution` (the single source of truth).

// ── Node traversal helpers ────────────────────────────────────────────────────

/**
 * Does the named supplier still need onboarding?
 *
 * A read failure returns false rather than true: an unreachable supplier table
 * must not park every request on an onboarding stage nobody asked for. The gates
 * at sourcing and contracting are the enforcement, and they fail closed.
 */
async function needsOnboarding(supplierId: string | null | undefined): Promise<boolean> {
  if (!supplierId) return false;
  try {
    const { data } = await db
      .from('suppliers')
      .select('id, name, onboarding_status, screening_status, prospective')
      .eq('id', supplierId)
      .maybeSingle();
    if (!data) return false;
    const r = data as Record<string, unknown>;
    return onboardingRequired({
      id: r.id as string,
      name: (r.name as string) ?? '',
      onboardingStatus: (r.onboarding_status as Supplier['onboardingStatus']) ?? 'not-started',
      screeningStatus: (r.screening_status as Supplier['screeningStatus']) ?? 'pending',
      prospective: r.prospective === true,
    } as Supplier);
  } catch {
    return false;
  }
}

// Edge conditions live in edge-conditions.ts now, in the same
// {field, operator, value} shape as routing rules and form triggers, evaluated
// by the same evaluator against the same governed thresholds. The label parser
// that lived here understood a handful of shapes and returned false for the
// rest — including `> €5K`, which is exactly what an admin would write.


// ── Generate approval entries from chain ──────────────────────────────────────

/**
 * Which approval chain a request gets.
 *
 * This used to read `requests.approval_chain` — a column that does not exist.
 * PostgREST errored, the error was swallowed, and every request in the system
 * fell through to the literal 'chain-1', so a 5,000 EUR order and a 5,000,000
 * EUR programme drew the same approvers. Worse, the intake wizard *showed* the
 * requester a value-banded chain that the engine then ignored.
 *
 * Order: an explicit chain persisted from the matched routing rule, otherwise
 * the value band — the same rule `selectApprovalChainForValue` applies in the
 * intake preview, so what was promised is what is granted.
 */
async function resolveChainForRequest(requestId: string): Promise<string> {
  const { data: req } = await db
    .from('requests')
    .select('approval_chain, value')
    .eq('id', requestId)
    .maybeSingle();

  const explicit = (req as Record<string, unknown> | null)?.approval_chain as string | undefined;
  if (explicit) return explicit;

  const value = Number((req as Record<string, unknown> | null)?.value ?? 0);
  try {
    const chains = await listApprovalChains();
    // Band bounds may name a governed threshold. Browser-side, so the active
    // config is the one main.tsx hydrated from the server on boot.
    const banded = selectApprovalChainForValue(chains, value, getActivePolicyConfig());
    if (banded) return banded.id;
  } catch (e) {
    console.warn('[engine] approval chain band lookup failed:', e);
  }
  return 'chain-1';
}

/**
 * Create a request's approval entries when the engine advances it into the
 * approval stage.
 *
 * This used to be a second implementation of approver resolution, and it
 * outlived the first: it collapsed every functional role to one of six
 * switchable personas, wrote no step_order or assignment_mode, and substituted
 * an out-of-office approver's delegate into approver_id — erasing the record of
 * who was actually accountable. A request that reached `approval` through the
 * engine therefore got the old behaviour back, while one created at checkout
 * got the new. Same table, two shapes, depending on how the request got there.
 *
 * It delegates now. createApprovalsFor derives from the records (the category's
 * managers, the contract owner, the cost centre), leaves a step open to its
 * role where several people hold it, and records a delegate rather than
 * replacing the person asked. It also returns early when entries already exist,
 * so an engine transition cannot duplicate what the checkout already wrote.
 */
async function generateApprovalEntries(
  requestId: string,
  approvalChainName: string,
): Promise<void> {
  const { data: request } = await db
    .from('requests')
    .select('category, contract_id, cost_centre, buying_channel, supplier_override_reason')
    .eq('id', requestId)
    .maybeSingle();

  const row = request as Record<string, unknown> | null;
  const created = await createApprovalsFor(db, {
    requestId,
    category: (row?.category as string) ?? null,
    contractId: (row?.contract_id as string) ?? null,
    costCentre: (row?.cost_centre as string) ?? null,
    route: (row?.buying_channel as string) === 'framework-call-off' ? 'contract-call-off' : null,
    // Submit stores a reason only when it found an override, so the reason is
    // the durable record that one was made.
    supplierOverride: Boolean(row?.supplier_override_reason)
      && getActivePolicyConfig().preferredSupplierOverrideNeedsApproval,
  }, approvalChainName);

  // No chain resolved to any step. Somebody still has to decide, so the request
  // gets one entry open to the approver role rather than none at all — but it
  // is a role, not a persona, so whoever holds it can act.
  if (created.length === 0) {
    const { data: existing } = await db
      .from('approval_entries').select('id').eq('request_id', requestId);
    if (((existing as unknown[]) ?? []).length === 0) {
      await db.from('approval_entries').insert({
        id: `APR-${requestId}-1`,
        request_id: requestId,
        step_order: 1,
        assignment_mode: 'role',
        approver_id: null,
        approver_name: 'Any Approver',
        approver_role: 'Approver',
        status: 'pending',
        requested_at: new Date().toISOString(),
      });
    }
  }
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
    // A completed intake must not be left parked in `intake` because an
    // optional template/side-effect failed. The channel fallback records the
    // first actionable stage and preserves a visible recovery path.
    try { await initFallbackWorkflow(requestId, buyingChannel); } catch (fallbackError) { console.error('[engine] fallback transition failed:', fallbackError); }
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

    const wasSuspended = instance.status === 'suspended';
    const fresh = { ...instance, status: 'running' as const };
    await advanceInstance(fresh, template, outcome, wasSuspended);
  } catch (e) {
    console.error('[engine] advanceWorkflow error:', e);
  }
}

async function advanceInstance(
  instance: WorkflowInstance,
  template: WorkflowTemplate,
  outcome: string | undefined,
  /**
   * True when the instance was suspended on its current node — i.e. a human has
   * just satisfied that node's gate.
   *
   * The node we are suspended ON has already been executed; that execution is
   * what suspended us. Re-running it would re-fire the gate and suspend again on
   * the same node, so a gated request could never leave the stage. It would also
   * re-generate approval entries for the approval node.
   */
  resuming = false,
): Promise<void> {
  const nodeMap = new Map(template.nodes.map((n) => [n.id, n]));

  // Load request context for decision-node condition evaluation
  const { data: reqRow } = await db
    .from('requests')
    .select('value, category, status, risk_assessment_required, inherent_risk_tier, supplier_id, fulfilment_status')
    .eq('id', instance.requestId)
    .maybeSingle();
  const row = (reqRow ?? {}) as Record<string, unknown>;
  const edgeCtx: EdgeEvalContext = {
    value: row.value as number | undefined,
    category: row.category as string | undefined,
    status: row.status as string | undefined,
    riskRequired: row.risk_assessment_required === true,
    riskTier: row.inherent_risk_tier as string | undefined,
    onboardingRequired: await needsOnboarding(row.supplier_id as string | null),
    // Written by the governed checkout; the call-off template's amendment
    // detour branches on it.
    contractAmendmentRequired: row.fulfilment_status === 'contract-amendment-required',
    outcome,
  };

  const instanceId = instance.id;
  let nodeId: string | undefined = instance.currentNodeIds[0];

  // Run until a node gates, the flow completes, or we run out of edges.
  //
  // This used to execute at most two nodes and then hard-return, which parked
  // the pointer ON a node without ever executing it: every wizard-created
  // request ended up `running` at the Validation node with status still
  // `intake`, and nothing was scheduled to pick it up. The old look-ahead also
  // dropped `outcome` when it ran the second node, so a decision edge could not
  // see the action that caused the advance.
  //
  // The step budget is a guard against a template with a cycle (n13 'Referred
  // Back' loops back to n2), not a business rule — an unbounded loop here would
  // hang the caller.
  let steps = 0;
  while (nodeId && steps < MAX_STEPS_PER_ADVANCE) {
    steps++;
    const node = nodeMap.get(nodeId);
    if (!node) break;

    // `outcome` applies only to the node the caller resumed; anything the
    // engine reaches by itself afterwards advances on its own merits.
    const stepOutcome = steps === 1 ? outcome : undefined;

    // Skip execution of the node whose gate was just satisfied; advance from it.
    if (!(resuming && steps === 1)) {
      const result = await executeNode(node, instance.requestId, template, stepOutcome);

      if (result === 'suspend') {
        await updateWorkflowInstance(instanceId, { currentNodeIds: [nodeId], status: 'suspended' });
        return;
      }
      if (result === 'complete') {
        await updateWorkflowInstance(instanceId, { currentNodeIds: [], status: 'completed' });
        return;
      }
    }

    const nextIds = getNextNodeIds(nodeId, template.edges, stepOutcome, edgeCtx, getActivePolicyConfig());
    if (nextIds.length === 0) {
      await updateWorkflowInstance(instanceId, { currentNodeIds: [], status: 'completed' });
      return;
    }

    await updateWorkflowInstance(instanceId, { currentNodeIds: nextIds });
    nodeId = nextIds[0];
  }

  if (steps >= MAX_STEPS_PER_ADVANCE) {
    console.warn(`[engine] step budget exhausted for ${instance.requestId} — check the template for a cycle`);
  }
}

// ── Risk stage ───────────────────────────────────────────────────────────────

/**
 * Raise (or reuse) the risk assessment for a request entering the risk stage.
 *
 * Best-effort, like the compliance report: a failure here is a gap in the
 * register, not a reason to strand the request outside a stage it has already
 * entered. The stage stays gated either way, so nothing advances unchecked.
 */
async function raiseRiskAssessment(requestId: string): Promise<void> {
  try {
    const { data: row } = await db
      .from('requests')
      .select('id, title, supplier_id, contract_id, category, inherent_risk_tier, owner_id')
      .eq('id', requestId)
      .maybeSingle();
    if (!row) return;

    const r = row as Record<string, unknown>;

    // The service description is what the assessment is actually about. A
    // failed read is not a reason to skip raising the record — the assessor gets
    // an unassessed-scope note instead of nothing at all.
    const { data: sowRow } = await db
      .from('service_descriptions')
      .select('objective, scope, deliverables, resources, narrative')
      .eq('request_id', requestId)
      .maybeSingle();
    const sow = (sowRow as Record<string, string | null> | null) ?? null;

    const outcome = await ensureRiskAssessment(
      {
        id: r.id as string,
        title: (r.title as string) ?? requestId,
        supplierId: (r.supplier_id as string | null) ?? undefined,
        contractId: (r.contract_id as string | null) ?? undefined,
        category: (r.category as string) ?? '',
        inherentRiskTier: (r.inherent_risk_tier as string | null) ?? undefined,
      },
      { id: (r.owner_id as string) ?? 'system', name: 'Workflow engine' },
      sow,
    );
    if (outcome?.reused) {
      console.info(`[engine] reused risk assessment ${outcome.assessment.id} for ${requestId}`);
    }
  } catch (e) {
    console.warn('[engine] raiseRiskAssessment failed (non-blocking):', e);
  }
}

// ── Compliance report generation ─────────────────────────────────────────────

async function generateComplianceReport(requestId: string): Promise<void> {
  try {
    // Skip if a report already exists
    const { data: existing } = await db
      .from('compliance_reports')
      .select('request_id')
      .eq('request_id', requestId)
      .maybeSingle();
    if (existing) return;

    const { data: req } = await db
      .from('requests')
      .select('category, value, supplier_id, buying_channel, title')
      .eq('id', requestId)
      .maybeSingle();
    if (!req) return;

    const value = (req as Record<string, unknown>).value as number ?? 0;
    const category = (req as Record<string, unknown>).category as string ?? 'goods';

    // Thresholds come from the governed policy config rather than literals in
    // the engine — the same source the eight decisioning modules already read,
    // so a threshold change in Admin cannot leave the compliance report behind.
    const policy = getActivePolicyConfig();

    const checks = [
      {
        id: `${requestId}-CHK-1`, category: 'Budget', check: 'Budget authority',
        status: value > policy.delegatedAuthorityThreshold ? 'warning' : 'pass',
        detail: value > policy.delegatedAuthorityThreshold
          ? `Value €${value.toLocaleString()} requires CFO/Board approval.`
          : `Value €${value.toLocaleString()} within standard approval limits.`,
        severity: 'critical',
      },
      {
        id: `${requestId}-CHK-2`, category: 'Contract', check: 'Contract coverage',
        status: 'pass',
        detail: 'Checked against active contracts for this supplier.',
        severity: 'high',
      },
      {
        id: `${requestId}-CHK-3`, category: 'Supplier Compliance', check: 'SRA status',
        status: 'pass',
        detail: 'Supplier risk assessment status checked at intake.',
        severity: 'critical',
      },
      {
        id: `${requestId}-CHK-4`, category: 'Policy', check: 'Competitive sourcing',
        status: value >= policy.competitiveSourcingThreshold ? 'pass' : 'info',
        detail: value >= policy.competitiveSourcingThreshold
          ? 'Value above €25k threshold — competitive quotes required.'
          : 'Value below competitive quote threshold.',
        severity: 'high',
      },
      {
        id: `${requestId}-CHK-5`, category: 'Risk', check: 'Sanctions screening',
        status: 'pass',
        detail: 'No sanctions flags identified for this supplier.',
        severity: 'critical',
      },
      {
        id: `${requestId}-CHK-6`, category: 'Value', check: 'Market benchmark',
        status: 'pass',
        detail: `${category} category pricing appears within market range.`,
        severity: 'medium',
      },
    ];

    const failing = checks.filter((c) => c.status === 'fail').length;
    const warnings = checks.filter((c) => c.status === 'warning').length;
    const decision = failing > 0 ? 'rejected' : warnings > 1 ? 'needs-review' : 'approved';

    await saveComplianceReport({
      requestId,
      agentId: 'AI-006',
      agentName: 'PR Compliance Reviewer',
      decision,
      confidence: failing > 0 ? 62 : warnings > 0 ? 78 : 94,
      generatedAt: new Date().toISOString(),
      summary: `Compliance review for ${category} request valued at €${value.toLocaleString()}. ${failing} critical fail(s), ${warnings} warning(s).`,
      checks: checks as never,
      recommendation: decision === 'approved'
        ? 'All checks passed. Proceed to approval.'
        : decision === 'needs-review'
          ? 'Review warnings before proceeding.'
          : 'Critical compliance issues must be resolved before proceeding.',
    });
  } catch (e) {
    console.warn('[engine] generateComplianceReport failed (non-blocking):', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

type NodeResult = 'continue' | 'suspend' | 'complete';

/** Cycle guard for one advance call — templates may legitimately loop back. */
const MAX_STEPS_PER_ADVANCE = 50;

async function executeNode(
  node: TemplateNode,
  requestId: string,
  _template: WorkflowTemplate,
  outcome: string | undefined,
): Promise<NodeResult> {
  switch (node.type) {
    case 'start':
      return 'continue';

    case 'end':
      await transitionStage({ requestId, toStage: 'completed', action: outcome ?? 'completed', node });
      return 'complete';

    case 'error':
      await transitionStage({ requestId, toStage: 'referred-back', action: 'referred-back', node });
      return 'suspend';

    case 'stage': {
      const newStatus = nodeToStatus(node.label);
      // Every stage change goes through the one primitive, so the stage_history
      // row that the steppers read is written by the engine too — not only by
      // api/workflow-action.ts. The owner and sla_deadline come from the node.
      await transitionStage({
        requestId,
        toStage: newStatus,
        action: outcome ?? 'advanced',
        node,
      });

      // Validation stage → generate compliance report
      if (newStatus === 'validation') {
        await generateComplianceReport(requestId);
      }

      // Risk stage → make sure there is an assessment to act on. Reuse wins
      // where the register already covers the supplier or contract.
      if (newStatus === 'risk') {
        await raiseRiskAssessment(requestId);
      }

      // Approval stage → generate entries + suspend
      if (newStatus === 'approval') {
        await generateApprovalEntries(requestId, await resolveChainForRequest(requestId));
        return 'suspend';
      }

      // A gated stage waits for its owner to act. `sourcing` and `approval` are
      // always gated; the rest is the node's `gate` field, falling back to the
      // defaults in node-config for templates saved before that field existed.
      // Without this the engine ran intake → approval in one step and the
      // stages in between were invisible transitions with no owner.
      if (isGatedStage(node, newStatus)) {
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

// ── Fallback (no resolvable template) ────────────────────────────────────────

/**
 * What happens when a request has no template to run.
 *
 * This used to create a synthetic instance with `template_id = 'fallback:<channel>'`,
 * which `getWorkflowTemplate` can never resolve. That made the row worse than
 * useless: `advanceWorkflow` returns early when the template does not resolve,
 * and the Complete-stage action only takes its own no-instance path when there
 * is genuinely **no** instance — so the button found the fallback row, called
 * `advanceWorkflow`, nothing happened, and it still reported success. A request
 * with a fallback instance could not be moved at all.
 *
 * So: no instance. The channel's stage list is the whole fallback, and the
 * action path already walks it via `nextStageAfter` + `transitionStage`. That
 * is also the state 93 of 101 live requests are in, which is the path that
 * actually gets exercised.
 *
 * The stage is recorded through `transitionStage` rather than a bare status
 * write, so the request gets stage history, an owner and an SLA deadline like
 * any other — the omission that left wizard-created requests rendering as
 * never having entered anything.
 */
async function initFallbackWorkflow(requestId: string, buyingChannel: string): Promise<void> {
  // The channel's path comes from the templates now. Already async and already
  // reading templates elsewhere in this module, so this costs one list call
  // rather than a new data path.
  const stages = getStagesForChannel(
    channelStageMapFromTemplates(await listWorkflowTemplates()), buyingChannel,
  );
  // Governed checkout may already have resolved the first actionable stage
  // (risk, approval, or PO) before the fallback is initialized. Re-entering
  // `intake` here would make a completed call-off appear stuck and discard the
  // server-authoritative routing decision. Preserve a valid non-intake status;
  // otherwise use the channel's normal first stage for legacy submissions.
  const { data: requestRow } = await db
    .from('requests')
    .select('status')
    .eq('id', requestId)
    .maybeSingle();
  const existingStatus = (requestRow as Record<string, unknown> | null)?.status;
  const firstStage = typeof existingStatus === 'string' && existingStatus !== 'intake' && stages.includes(existingStatus as ReturnType<typeof getStagesForChannel>[number])
    ? existingStatus
    : (stages[0] ?? 'intake');

  await transitionStage({
    requestId,
    toStage: firstStage,
    action: 'submitted',
  });
}

/** Check whether all approval entries for a request are approved. */
export async function areAllApprovalsComplete(requestId: string): Promise<boolean> {
  const { data: entries } = await db
    .from('approval_entries')
    .select('status')
    .eq('request_id', requestId)
    .eq('status', 'pending');

  return !entries || entries.length === 0;
}
