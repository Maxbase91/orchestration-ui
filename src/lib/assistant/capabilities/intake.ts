import type { AssistantTurn } from '../../../data/types.js';

// A demand raised in the assistant goes where one raised on Home goes: to the
// describe step, carrying the words, which classifies it with the configured
// categories and finds a named supplier in the directory.
//
// This module used to classify on its own and look the supplier up in a list
// of ten names typed here, then pass `category`, `value` and `supplier` as
// query parameters — a second classification that could disagree with the
// describe step about the same sentence, and a supplier list nobody maintained.

// The server assistant (api/chat.ts, `start_demand`) says the same thing and
// links the same way — it passed the model's category, value and supplier,
// which intake ignored, and offered "a pre-filled consulting request" that
// was never pre-filled.
/** What is true after a demand is offered: nothing exists until the requester submits. */
export const DEMAND_OFFERED =
  "That sounds like something to buy. I'll take you to New Request with your words; it checks the catalogue and existing contracts first, then asks only what is still needed. Nothing is created or sent until you submit it.";

export function startDemand(input: string): AssistantTurn[] {
  const text = input.trim().slice(0, 300);
  return [
    {
      type: 'chat-answer',
      content: DEMAND_OFFERED,
    },
    {
      type: 'deep-link',
      label: 'Start the request',
      description: text,
      path: `/requests/new?q=${encodeURIComponent(text)}`,
    },
  ];
}
