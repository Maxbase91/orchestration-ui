// Moving a request on when its goods arrive.
//
// A goods receipt wrote to goods_receipts and purchase_orders and never touched
// the request, so a fully received order sat in `po` for good. The receipt is
// the event: asking someone to record it and then also press "Goods received"
// makes the lifecycle depend on a second action nobody has a reason to take.
//
// Takes its client as a parameter like tickets-core and approvals-core, with
// relative '.js' specifiers only, so the serverless handlers and the tests can
// use it rather than only the browser.
import type { NeonCompatibleClient, DbRow } from '../neon-compatible-client.js';
import { nextStageAfter } from '../workflow/buying-channel-stages.js';

export type ReceiptStatus = 'complete' | 'partial';

export interface ReceiptAdvance {
  /** The stage the request moved to, or null when it did not move. */
  movedTo: string | null;
  reason: 'advanced' | 'partial' | 'not-in-po' | 'no-next-stage' | 'request-missing';
}

/**
 * Decide whether a receipt moves its request, and where to.
 *
 * Pure so the rule is testable on its own: only a complete receipt moves
 * anything, only from `po`, and only where the channel has a stage after it.
 */
export function stageAfterReceipt(input: {
  receiptStatus: ReceiptStatus;
  requestStatus: string | null | undefined;
  buyingChannel: string | null | undefined;
}): ReceiptAdvance {
  if (input.receiptStatus !== 'complete') return { movedTo: null, reason: 'partial' };
  if (!input.requestStatus) return { movedTo: null, reason: 'request-missing' };
  // A receipt recorded against a request that has already moved on must not
  // drag it backwards.
  if (input.requestStatus !== 'po') return { movedTo: null, reason: 'not-in-po' };
  const next = nextStageAfter(input.buyingChannel ?? '', 'po');
  if (!next) return { movedTo: null, reason: 'no-next-stage' };
  return { movedTo: next, reason: 'advanced' };
}

/**
 * Apply that decision: close the open stage row, open the next one, and move
 * the request. Mirrors what the governed checkout writes, so a request's
 * history reads the same however it got there.
 */
export async function advanceOnReceipt(
  client: NeonCompatibleClient,
  input: { requestId: string; receivedBy: string; receiptStatus: ReceiptStatus },
): Promise<ReceiptAdvance> {
  const { data } = await client
    .from('requests').select('id, status, buying_channel').eq('id', input.requestId).maybeSingle();
  const request = data as DbRow | null;

  const decision = stageAfterReceipt({
    receiptStatus: input.receiptStatus,
    requestStatus: request ? String(request.status) : null,
    buyingChannel: request ? String(request.buying_channel ?? '') : null,
  });
  if (!decision.movedTo) return decision;

  const now = new Date().toISOString();
  await client.from('stage_history').update({ completed_at: now })
    .eq('request_id', input.requestId).is('completed_at', null);
  await client.from('stage_history').insert({
    request_id: input.requestId,
    stage: decision.movedTo,
    entered_at: now,
    owner_id: request?.owner_id ?? null,
    action: 'received',
    notes: 'Goods receipt completed in full.',
  });
  await client.from('requests')
    .update({ status: decision.movedTo, updated_at: now, days_in_stage: 0 })
    .eq('id', input.requestId);

  return decision;
}
