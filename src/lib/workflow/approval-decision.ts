// Recording an approval decision, in one place.
//
// There were three ways to approve — the request header, the Approvals tab and
// the approvals queue — and they behaved differently. The header advanced the
// request but stamped nothing unless the entry happened to name you. The tab
// and the queue stamped the entry and advanced nothing at all, so approving the
// last outstanding step flipped a badge and left the request parked in
// `approval` for good. All three now come through here.
//
// What a decision leaves behind: the entry says who responded and when, the
// request's timeline says it happened, and the audit log carries it alongside
// every other governed action.
import type { ApprovalEntry, ProcurementRequest } from '@/data/types';
import { updateApproval, listApprovals } from '@/lib/db/approvals';
import { createAuditEntry } from '@/lib/db/audit-entries';
import { advanceWorkflow, areAllApprovalsComplete } from './engine';
import { transitionStage } from './transition';
import { nextStageAfter } from './buying-channel-stages';

export type ApprovalDecision = 'approved' | 'rejected' | 'info-requested';

export interface ApprovalDecisionInput {
  approval: ApprovalEntry;
  request: Pick<ProcurementRequest, 'id' | 'status' | 'buyingChannel'>;
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
 * Stamp one approval and take whatever follows from it.
 *
 * An approval only moves the request when it is the last one outstanding;
 * before that the entry is recorded and the request stays put, which is a
 * different outcome and worth reporting as one.
 *
 * A rejection refers the request back to its requester rather than cancelling
 * it. The demand is usually sound and the paperwork is not, so ending it
 * outright would make the requester start again for a correctable problem.
 */
export async function recordApprovalDecision(
  input: ApprovalDecisionInput,
): Promise<ApprovalDecisionResult> {
  const { approval, request, decision, actor, comments } = input;
  const now = new Date().toISOString();

  if (decision === 'rejected' && !comments?.trim()) {
    throw new Error('A rejection needs a reason — the requester has to know what to change.');
  }

  await updateApproval(approval.id, {
    status: decision,
    respondedAt: now,
    // Who responded, which is not always who was asked: a delegate acting for
    // someone out of office, or any holder of a role-assigned step.
    decidedBy: actor.id,
    decidedByName: actor.name,
    ...(comments?.trim() ? { comments: comments.trim() } : {}),
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
      + (comments?.trim() ? `: ${comments.trim()}` : ''),
  });

  const remaining = (await listApprovals())
    .filter((entry) => entry.requestId === request.id && entry.status === 'pending');

  if (decision === 'rejected') {
    await transitionStage({
      requestId: request.id,
      toStage: 'intake',
      action: 'referred-back',
      notes: `Rejected at ${approval.approverRole} by ${actor.name}: ${comments?.trim() ?? ''}`,
      actor,
    });
    return { advanced: false, outstanding: remaining.length, referredBack: true };
  }

  if (decision === 'info-requested' || remaining.length > 0) {
    return { advanced: false, outstanding: remaining.length, referredBack: false };
  }

  // Last one in. The engine moves the request where it has an instance to move;
  // where it does not, the channel's stage list says what comes next.
  if (await areAllApprovalsComplete(request.id)) {
    await advanceWorkflow(request.id, 'approved');
    const next = nextStageAfter(request.buyingChannel, request.status);
    if (next) {
      await transitionStage({
        requestId: request.id,
        toStage: next,
        action: 'approved',
        notes: `All approvals complete — last by ${actor.name}.`,
        actor,
      });
    }
    return { advanced: true, outstanding: 0, referredBack: false };
  }

  return { advanced: false, outstanding: remaining.length, referredBack: false };
}
