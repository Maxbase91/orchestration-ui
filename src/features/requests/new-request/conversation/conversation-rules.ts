// The conversation page's rules that are not presentation: when the
// conversation is through, when the buying channel is confirmed, and what a
// long description is called.
//
// Pure, with relative imports, so a node test drives them beside request-rows —
// the panel's "N of M known" and this confirmation must agree.
import {
  isConversationComplete, requiredSlotsFilled,
  type DemandConversationContext, type DemandSlot,
} from '../../../../lib/procurement/demand-conversation.js';
import type { SubmissionGap } from '../../../../lib/procurement/submission-requirements.js';

/**
 * The conversation is through: nothing left on its agenda, and the mandatory
 * floor met. Both, because neither implies the other — the floor cannot see a
 * risk question triggered by this demand, and the agenda drops a question the
 * requester could not answer (a need-by date that never parsed), which must
 * not then hold the conversation open for ever.
 *
 * `slots` are the ones still being asked: the conversation leaves out the ones
 * it gave up on.
 */
export function conversationComplete(ctx: DemandConversationContext, slots: DemandSlot[]): boolean {
  return isConversationComplete(ctx, undefined, slots) && requiredSlotsFilled(ctx, slots);
}

export interface ConfirmationInput {
  route: 'describing' | 'call-off' | 'new-request';
  /** New request: the conversation's agenda is through — description and risk questions. */
  conversationComplete: boolean;
  /** New request: the supplier question is answered, including "go to market". */
  supplierSettled: boolean;
  /** What submit would still refuse (submission-requirements.ts). */
  gaps: readonly SubmissionGap[];
  /** A governed record is never written without a determination behind it. */
  hasDetermination: boolean;
  /** Call-off: nothing is left to ask. */
  callOffComplete: boolean;
}

/**
 * "Buying channel confirmed" — the one way on to the Channel page.
 *
 * It is the step gate the wizard had, moved to where the conversation ends: a
 * new request is confirmed only when submit would accept it, so the Channel
 * page never offers a Submit the server then refuses.
 */
export function channelConfirmed(input: ConfirmationInput): boolean {
  if (input.route === 'call-off') return input.callOffComplete;
  if (input.route === 'new-request') {
    return input.conversationComplete && input.supplierSettled && input.gaps.length === 0 && input.hasDetermination;
  }
  return false;
}

const TITLE_MAX = 100;

/**
 * A title from a description: the first sentence, cut at a word within 100
 * characters. A pasted brief or a document's text used to become the request's
 * title whole — which is then what the request is called on every list.
 */
export function shortTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= TITLE_MAX) return clean;
  const sentence = clean.match(/^(.+?[.!?])(\s|$)/)?.[1] ?? clean;
  if (sentence.length <= TITLE_MAX) return sentence.replace(/[.!?]$/, '');
  const cut = sentence.slice(0, TITLE_MAX);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : TITLE_MAX).trimEnd()}…`;
}
