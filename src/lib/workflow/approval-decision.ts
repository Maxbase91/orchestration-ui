// Recording an approval decision, in one place.
//
// There were three ways to approve — the request header, the Approvals tab and
// the approvals queue — and they behaved differently. The header advanced the
// request but stamped nothing unless the entry happened to name you. The tab
// and the queue stamped the entry and advanced nothing at all, so approving the
// last outstanding step flipped a badge and left the request parked in
// `approval` for good. The header's Reject then kept a path of its own: no
// reason, no audit entry, and a different destination from the tab's. All
// three come through here now (2026-09-26).
//
// What a decision leaves behind: the entry says who responded and when, the
// request's timeline says it happened, and the audit log carries it alongside
// every other governed action.
import type { ApprovalEntry, ProcurementRequest } from '@/data/types';
import { updateApproval, listApprovals } from '@/lib/db/approvals';
import { createAuditEntry } from '@/lib/db/audit-entries';
import { getRequest } from '@/lib/db/requests';
import { getWorkflowInstanceForRequest } from '@/lib/db/workflow-instances';
import { getWorkflowTemplate, listWorkflowTemplates } from '@/lib/db/workflow-templates';
import { getActivePolicyConfig } from '@/lib/procurement/policy-config';
import { advanceWorkflow, areAllApprovalsComplete } from './engine';
import { transitionStage } from './transition';
import { nextStageAfter, channelStageMapFromTemplates, templateForChannel } from './channel-stages';
import { nodeIdForStatus } from './node-config';
import { branchTarget, statusAtNode } from './branch-target';

export type ApprovalDecision = 'approved' | 'rejected' | 'info-requested';

type DecidedRequest = Pick<
  ProcurementRequest,
  'id' | 'status' | 'buyingChannel' | 'workflowTemplateId' | 'value' | 'category' | 'riskAssessmentRequired' | 'inherentRiskTier'
>;

export interface ApprovalDecisionInput {
  approval: ApprovalEntry;
  request: DecidedRequest;
  decision: ApprovalDecision;
  actor: { id: string; name: string };
  /** Required for a rejection: the requester is told why, and can fix it. */
  comments?: string;
}

export interface ApprovalDecisionResult {
  /** The request left the approval stage. */
  advanced: boolean;
  /** Approvals still outstanding after this one. */
  outstanding: number;
  /** The request went back to the requester with a reason. */
  referredBack: boolean;
}

/**
 * Where a rejection of this request goes: its template's Rejected branch from
 * the stage it is in (decided 2026-09-26 — the Workflow Designer decides, not
 * code). Read before anything is written, so a template with no Rejected path
 * refuses the rejection instead of recording one the request cannot follow.
 */
async function rejectionRoute(request: DecidedRequest) {
  const instance = await getWorkflowInstanceForRequest(request.id);
  const templates = instance ? [] : await listWorkflowTemplates();
  // The instance's own template when there is one; otherwise the one the
  // request names, else the one that claims its channel — as submit chose it.
  const templateId = instance?.templateId ?? request.workflowTemplateId
    ?? templateForChannel(templates, request.buyingChannel) ?? undefined;
  const template = templateId ? await getWorkflowTemplate(templateId) : null;
  if (!template) return null;
  const fromNodeId = instance?.currentNodeIds[0] ?? nodeIdForStatus(template.nodes, request.status);
  if (!fromNodeId) return null;
  const target = branchTarget(template, fromNodeId, 'rejected', {
    value: request.value, category: request.category, status: request.status,
    riskRequired: request.riskAssessmentRequired === true, riskTier: request.inherentRiskTier,
  }, getActivePolicyConfig());
  return target ? { hasInstance: Boolean(instance), status: statusAtNode(target) } : null;
}

/**
 * Stamp one approval and take whatever follows from it.
 *
 * An approval only moves the request when it is the last one outstanding;
 * before that the entry is recorded and the request stays put, which is a
 * different outcome and worth reporting as one.
 *
 * A rejection sends the request where its template's Rejected branch goes —
 * Referred Back, in every shipped template — rather than cancelling it. The
 * demand is usually sound and the paperwork is not, so ending it outright would
 * make the requester start again for a correctable problem.
 */
export async function recordApprovalDecision(
  input: ApprovalDecisionInput,
): Promise<ApprovalDecisionResult> {
  const { approval, request, decision, actor, comments } = input;
  const reason = comments?.trim();
  const now = new Date().toISOString();

  if (decision === 'rejected' && !reason) {
    throw new Error('A rejection needs a reason — the requester has to know what to change.');
  }
  const route = decision === 'rejected' ? await rejectionRoute(request) : null;
  if (decision === 'rejected' && !route) {
    throw new Error('This request\'s workflow has no Rejected path, so nothing was recorded. '
      + 'An administrator adds one in the Workflow Designer.');
  }

  await updateApproval(approval.id, {
    status: decision,
    respondedAt: now,
    // Who responded, which is not always who was asked: a delegate acting for
    // someone out of office, or any holder of a role-assigned step.
    decidedBy: actor.id,
    decidedByName: actor.name,
    ...(reason ? { comments: reason } : {}),
  });

  const verb = decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'requested information on';
  await createAuditEntry({
    timestamp: now,
    type: 'human',
    action: `approval.${decision}`,
    objectType: 'approval_entries',
    objectId: approval.id,
    requestId: request.id,
    userId: actor.id,
    userName: actor.name,
    detail: `${actor.name} ${verb} step ${approval.stepOrder ?? '?'} (${approval.approverRole})`
      + (reason ? `: ${reason}` : ''),
  });

  const remaining = (await listApprovals())
    .filter((entry) => entry.requestId === request.id && entry.status === 'pending');

  if (decision === 'rejected' && route) {
    const notes = `Rejected at ${approval.approverRole} by ${actor.name}: ${reason}`;
    // The engine walks the branch where there is an instance to walk; where
    // there is none, the branch found above is the destination.
    if (route.hasInstance) await advanceWorkflow(request.id, 'rejected', notes);
    else await transitionStage({ requestId: request.id, toStage: route.status, action: 'rejected', notes, actor });
    // The engine reports nothing when it fails, so check the request moved
    // rather than saying it went back to the requester when it did not.
    const after = await getRequest(request.id);
    if (!after || after.status === request.status) {
      throw new Error('The rejection is recorded, but the request did not move to '
        + `${route.status === 'referred-back' ? 'Referred Back' : route.status}. Reload the page; `
        + 'if it has not moved, tell an administrator.');
    }
    return { advanced: false, outstanding: remaining.length, referredBack: true };
  }

  if (decision === 'info-requested' || remaining.length > 0) {
    return { advanced: false, outstanding: remaining.length, referredBack: false };
  }

  // Last one in. The engine moves the request where it has an instance to move;
  // where it does not, the channel's stage list says what comes next. Never
  // both: the engine may branch past the next stage in the list, and moving it
  // again after would pull it back.
  if (await areAllApprovalsComplete(request.id)) {
    if (await getWorkflowInstanceForRequest(request.id)) {
      await advanceWorkflow(request.id, 'approved');
    } else {
      const channelStages = channelStageMapFromTemplates(await listWorkflowTemplates());
      const next = nextStageAfter(channelStages, request.buyingChannel, request.status);
      if (next) {
        await transitionStage({
          requestId: request.id,
          toStage: next,
          action: 'approved',
          notes: `All approvals complete — last by ${actor.name}.`,
          actor,
        });
      }
    }
    return { advanced: true, outstanding: 0, referredBack: false };
  }

  return { advanced: false, outstanding: remaining.length, referredBack: false };
}
