// What is outstanding on a request, as one rule.
//
// "Open" was previously derived four different ways with four different status
// sets — my-tasks-page, team-tasks-page, widget-my-requests and use-live-kpis
// each had their own — and none of them could say *what* was open or *who* had
// to act. The request page showed a stage with no owner and no action.
//
// This module answers three questions the UI kept asking and could not resolve:
// which stage is waiting, who owns it, and what they have to do.

import type { ProcurementRequest, ApprovalEntry } from '@/data/types';
import { gateActionLabel, isTerminalStatus, type TemplateNode } from './node-config';

/** Where the SLA clock stands for the open stage. */
export type OpenSlaState = 'none' | 'on-track' | 'at-risk' | 'breached';

export interface OpenItem {
  requestId: string;
  /** The stage that is waiting. */
  stage: string;
  /** Who has to act. Null when the stage's configured role could not be resolved. */
  ownerId: string | null;
  /** The role name from the template, for display when no user resolves. */
  ownerRole?: string;
  /** The action that clears it, e.g. "Complete validation". */
  action: string;
  /** What has to be true before that action is legitimate. */
  exitCriteria?: string;
  /** When the stage was entered. */
  waitingSince?: string;
  slaState: OpenSlaState;
  /** Approvers still to respond, when the open stage is approval. */
  pendingApprovers: string[];
}

/** Inside this many hours of the deadline a stage is at risk rather than on track. */
const AT_RISK_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Classify the SLA on an open stage.
 *
 * Returns `none` rather than `on-track` when no deadline is set, so a request
 * with no SLA is never reported as healthy — the same distinction ticket-sla.ts
 * makes, and for the same reason: absence of a target is not compliance.
 */
export function openSlaState(
  slaDeadline: string | undefined,
  now: Date = new Date(),
): OpenSlaState {
  if (!slaDeadline) return 'none';
  const remaining = new Date(slaDeadline).getTime() - now.getTime();
  if (remaining <= 0) return 'breached';
  if (remaining <= AT_RISK_HOURS * HOUR_MS) return 'at-risk';
  return 'on-track';
}

/**
 * What is outstanding on this request, or null when nothing is.
 *
 * A terminal request has no open item. Everything else is waiting on somebody:
 * that is the point of the gate model — if a stage is not waiting on a person it
 * should have auto-advanced rather than sitting there.
 */
export function openItemForRequest(
  request: ProcurementRequest,
  node: TemplateNode | undefined,
  approvals: ApprovalEntry[] = [],
  enteredAt?: string,
  now: Date = new Date(),
): OpenItem | null {
  if (isTerminalStatus(request.status)) return null;

  const pendingApprovers =
    request.status === 'approval'
      ? approvals.filter((a) => a.status === 'pending').map((a) => a.approverId)
      : [];

  return {
    requestId: request.id,
    stage: request.status,
    ownerId: request.ownerId ?? null,
    ...(node?.role ? { ownerRole: node.role } : {}),
    action: actionForStage(request.status, pendingApprovers.length),
    ...(node?.purpose ? { exitCriteria: node.purpose } : {}),
    ...(enteredAt ? { waitingSince: enteredAt } : {}),
    slaState: openSlaState(request.slaDeadline, now),
    pendingApprovers,
  };
}

/**
 * The action that clears the stage.
 *
 * Approval and sourcing have their own verbs because their gate is not "the
 * owner says it is done" — approval waits on a chain of people, sourcing on an
 * award. Saying "Complete approval" would misdescribe both.
 */
function actionForStage(status: string, pendingCount: number): string {
  if (status === 'approval') {
    return pendingCount > 0
      ? `Awaiting ${pendingCount} approval${pendingCount === 1 ? '' : 's'}`
      : 'Awaiting approval';
  }
  if (status === 'sourcing') return 'Award the sourcing event';
  if (status === 'referred-back') return 'Requester to resubmit';
  return gateActionLabel(status);
}
