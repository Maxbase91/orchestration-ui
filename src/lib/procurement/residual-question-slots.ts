// The criteria-driven risk questions, as conversation slots.
//
// `determineResidualQuestions` stays the ONLY place the criteria live — this is
// a shape translation with no conditions in it. The output is appended to the
// agenda after the description slots, so the chat asks the risk questions where
// the requester is already answering questions, rather than in a separate card
// of switches below the conversation.
//
// Why they are not in `ALL_SLOTS` or the admin-editable template:
//
//  1. `resolveSlots` REPLACES the built-in set when a `service_description_
//     templates` row exists. A slot added to `ALL_SLOTS` but not to a stored
//     template silently stops being asked — for exactly the categories most
//     likely to have one.
//  2. The criteria are OR-shaped (`ACCESS_CATEGORIES.has(category) ||
//     sensitivity >= medium`) and one of them reads `supplierRiskRating`, which
//     is not in the admin condition vocabulary at all.
//  3. The admin slot editor gives every slot a `required` switch and an
//     editable prompt. Turning off "Does this engagement grant privileged or
//     system access?" would be a change to the inherent-risk cascade dressed as
//     a copy edit.
//
// Keeping them outside means every stored template keeps working with no
// migration; `test:service-description-config` pins that none can smuggle one in.

import type { DemandSlot } from './demand-conversation.js';
import type { ResidualQuestion } from './residual-questions.js';

export function riskSlotsFor(questions: readonly ResidualQuestion[]): DemandSlot[] {
  return questions.map((question) => ({
    id: question.id,
    target: { kind: 'risk', field: question.field },
    // Required: the determination reads these, so an unanswered one leaves the
    // record saying a question was triggered and never put.
    required: true,
    answerType: 'yes-no',
    prompt: question.question,
    // The same "Asked because…" line the mini-IRQ card carried, now attached to
    // the message that asks it.
    why: question.reason,
  }));
}
