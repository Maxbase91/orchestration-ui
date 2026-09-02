// The single way a request changes stage.
//
// Before this module there were two competing mechanisms. `api/workflow-action.ts`
// did it correctly — close the open stage_history row, open a new one, reset the
// dwell counter — while the engine called updateRequest({status}) directly and
// wrote no history at all. Since both steppers derive "which stages are complete"
// and "who owned this stage" *exclusively* from stage_history, every request the
// engine touched rendered as never having started.
//
// Both callers now go through transitionStage(). The stage_history row is not
// bookkeeping: it IS the lifecycle as far as the UI is concerned.

import { db } from '@/lib/db-client';
import { updateRequest } from '@/lib/db/requests';
import type { ProcurementRequest } from '@/data/types';
import { resolveStageOwnerRole } from './approver-resolution';
import type { TemplateNode } from './node-config';

const STAGE_HISTORY = 'stage_history';

export interface TransitionInput {
  requestId: string;
  /** The stage being entered. */
  toStage: string;
  /** Audit verb — 'advanced', 'referred-back', 'kanban-move', 'awarded'… */
  action: string;
  /** Who caused it. Falls back to the node's configured role when absent. */
  actor?: { id: string; name: string };
  /** The template node being entered, when the engine drives the transition. */
  node?: TemplateNode;
  notes?: string;
}

/** Business days out from now, as an ISO timestamp. Weekends do not consume SLA. */
export function addBusinessDays(from: Date, days: number): Date {
  const out = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    out.setDate(out.getDate() + 1);
    const day = out.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return out;
}

/**
 * Who owns the stage being entered.
 *
 * The node's configured role wins over the acting user: the point of a gate is
 * that the *next* stage is somebody else's to action, so carrying the previous
 * actor forward would make every stage look self-assigned.
 */
function resolveStageOwner(
  node: TemplateNode | undefined,
  actor: { id: string; name: string } | undefined,
): string | null {
  if (node?.role) {
    // Null when the role is unmapped: an unassigned stage is visibly wrong,
    // whereas a silently defaulted owner is a lie. See resolveStageOwnerRole.
    return resolveStageOwnerRole(node.role)?.id ?? null;
  }
  return actor?.id ?? null;
}

/**
 * Move a request into a new stage.
 *
 * Idempotent on the stage: re-entering the stage the request is already in
 * writes nothing, so a double-click or a replayed engine step cannot open a
 * second history row.
 *
 * The guard is "already in this stage **and** already recorded as being in it",
 * not status alone. A request is created with `status: 'intake'` before anything
 * opens a history row for it, so a status-only guard would decline to record the
 * very first stage — which is how wizard-created requests came to render as
 * having entered nothing at all.
 */
export async function transitionStage(input: TransitionInput): Promise<void> {
  const { requestId, toStage, action, actor, node, notes } = input;

  const { data: existing } = await db
    .from('requests')
    .select('status, owner_id')
    .eq('id', requestId)
    .maybeSingle();

  const fromStage = (existing as Record<string, unknown> | null)?.status as string | undefined;
  if (fromStage === toStage) {
    const { data: open } = await db
      .from(STAGE_HISTORY)
      .select('id')
      .eq('request_id', requestId)
      .eq('stage', toStage)
      .is('completed_at', null)
      .limit(1);
    if (open && open.length > 0) return;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Close the row the request is leaving. Filtered on completed_at is null so a
  // stage entered more than once (refer-back → resubmit) closes only the open one.
  // Nothing to close when the request is being recorded as entering the stage
  // it is already in — that is the first-record case above, not a move.
  if (fromStage && fromStage !== toStage) {
    await db
      .from(STAGE_HISTORY)
      .update({ completed_at: nowIso })
      .eq('request_id', requestId)
      .eq('stage', fromStage)
      .is('completed_at', null);
  }

  const ownerId =
    resolveStageOwner(node, actor) ??
    ((existing as Record<string, unknown> | null)?.owner_id as string | undefined) ??
    null;

  // sla_deadline was never populated by anything before this. The countdown on
  // the request header and the Stuck/bottleneck views have always read it.
  const slaDeadline =
    node?.slaDays != null ? addBusinessDays(now, node.slaDays).toISOString() : null;

  await db.from(STAGE_HISTORY).insert({
    request_id: requestId,
    stage: toStage,
    entered_at: nowIso,
    completed_at: null,
    owner_id: ownerId,
    action,
    notes: notes ?? null,
  });

  const patch: Partial<ProcurementRequest> = {
    status: toStage as ProcurementRequest['status'],
    daysInStage: 0,
    isOverdue: false,
  };
  if (ownerId) patch.ownerId = ownerId;
  if (slaDeadline) patch.slaDeadline = slaDeadline;

  await updateRequest(requestId, patch);
}
