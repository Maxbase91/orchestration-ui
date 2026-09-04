// What the Details step reveals, and when.
//
// The step used to render everything at once: requester context, the
// service-description conversation, a card of risk switches, and supplier
// selection — all on screen before the requester had answered anything. The
// reveal rule is deliberately trivial so it cannot disagree with the step gate:
//
//   section N+1 is revealed exactly when section N is complete,
//   and the last section's completion IS `canProceed('details')`.
//
// Both this module and `intake-steps.ts` call the same predicate, so a screen
// that shows a section and a gate that ignores it cannot drift apart.

import { buildAgenda, requiredSlotsFilled, type DemandConversationContext, type DemandSlot } from '../../../lib/procurement/demand-conversation.js';

export type DetailsSectionId = 'requester' | 'description' | 'supplier';

export interface DetailsSectionInput {
  isChatIntakePath: boolean;
  conversationCtx: DemandConversationContext;
  /** Description slots AND the demand's risk questions — one agenda. */
  conversationSlots: DemandSlot[];
}

/**
 * Is the service description (including its risk-question tail) finished?
 *
 * Two independent conditions: the mandatory floor `REQUIRED_SLOT_IDS` defines,
 * and every risk question this demand triggered actually answered. The floor
 * cannot see the risk questions — they are appended per demand rather than
 * being in a fixed list — so they have to be checked separately.
 *
 * Deliberately NOT "the agenda is empty". The agenda also carries OPTIONAL
 * slots, and the conversation drops one the requester could not answer (the
 * need-by date has a parser behind it, so an unreadable answer would otherwise
 * be asked forever). Gating on an empty agenda made a declined optional
 * question block the step, with the chat saying "that's everything I need"
 * while Next stayed disabled and nothing on screen explained why.
 */
export function descriptionComplete(input: DetailsSectionInput): boolean {
  if (!input.isChatIntakePath) return false;
  if (!requiredSlotsFilled(input.conversationCtx, input.conversationSlots)) return false;
  const risk = input.conversationSlots.filter((slot) => slot.target.kind === 'risk');
  return buildAgenda(input.conversationCtx, undefined, risk).length === 0;
}

export interface DetailsSection {
  id: DetailsSectionId;
  complete: boolean;
  /** True once the requester should see it. */
  revealed: boolean;
}

/**
 * The section sequence for the conversation path.
 *
 * Requester context is complete on arrival — it is derived from the profile,
 * not asked — so it mounts collapsed to a summary and the conversation is the
 * first thing on screen. Supplier is revealed last and is never a gate:
 * leaving it open is a valid answer, and sourcing will identify candidates.
 */
export function detailsSections(input: DetailsSectionInput): DetailsSection[] {
  const described = descriptionComplete(input);
  return [
    { id: 'requester', complete: true, revealed: true },
    { id: 'description', complete: described, revealed: true },
    { id: 'supplier', complete: true, revealed: described },
  ];
}
