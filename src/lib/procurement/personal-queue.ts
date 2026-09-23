// What is on one person's plate — derived once, for every surface that asks.
//
// Three surfaces answered this question and no two agreed. The approvals queue
// counted an approval as mine when `approverId` matched *or* it was delegated
// to me; `/tasks/my-tasks` checked `approverId` alone, so an approver covering
// for someone out of office saw the approval in their queue and not in their
// task list. The dashboard's attention band would have been the fourth
// definition, which is why these live here instead.
//
// Pure and dependency-free: the callers hold the query results, and nothing
// here reads a hook or a client.
// Relative with an extension, not `@/`: approval-derivation.ts imports this
// module and is reachable from an api/ function, where aliases do not resolve.
import type { ApprovalEntry, ProcurementRequest } from '../../data/types.js';

/**
 * The two fields that decide it, so a caller holding a looser shape — a raw
 * chain step, a partially typed row — can ask the same question.
 */
export interface ApprovalAssignment {
  approverId?: string | null;
  delegatedTo?: string | null;
}

/**
 * Mine to decide — assigned to me, or delegated to me while the assignee is
 * out of office. Delegation is why this is a function rather than a field
 * comparison at each call site.
 *
 * This answers *assignment*, not permission. A role-assigned entry belongs to
 * whoever holds the role and may be actioned by them without being in anyone's
 * named queue — that is `canActOnApproval` in `approval-derivation.ts`, which
 * defers here for the person-assigned half.
 */
export function isMyApproval(approval: ApprovalAssignment, userId: string): boolean {
  return approval.approverId === userId || approval.delegatedTo === userId;
}

/** Mine and still undecided — the queue that has to shrink. */
export function approvalsAwaiting(approvals: ApprovalEntry[], userId: string): ApprovalEntry[] {
  return approvals.filter((a) => a.status === 'pending' && isMyApproval(a, userId));
}

/**
 * Sent back to me to fix. Only the requester can act on a referred-back
 * request — the owner's job at that point is to wait — so this is scoped to
 * `requestorId` rather than to either party.
 */
export function referredBackToMe(requests: ProcurementRequest[], userId: string): ProcurementRequest[] {
  return requests.filter((r) => r.status === 'referred-back' && r.requestorId === userId);
}

/**
 * Past its stage SLA and mine either way: the owner is accountable for moving
 * it and the requester is the one waiting, and both need to know.
 * `isOverdue` is derived from `sla_deadline` in the request mapper, not read
 * from the stored `is_overdue` column, which nothing has ever set true.
 */
export function overdueOnMyPlate(requests: ProcurementRequest[], userId: string): ProcurementRequest[] {
  return requests.filter((r) => r.isOverdue && (r.ownerId === userId || r.requestorId === userId));
}
