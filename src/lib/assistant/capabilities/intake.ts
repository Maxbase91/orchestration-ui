import type { AssistantTurn } from '@/data/types';

// A demand raised in the assistant goes where one raised on Home goes: to the
// describe step, carrying the words, which classifies it with the configured
// categories and finds a named supplier in the directory.
//
// This module used to classify on its own and look the supplier up in a list
// of ten names typed here, then pass `category`, `value` and `supplier` as
// query parameters — a second classification that could disagree with the
// describe step about the same sentence, and a supplier list nobody maintained.

export function startDemand(input: string): AssistantTurn[] {
  const text = input.trim().slice(0, 300);
  return [
    {
      type: 'chat-answer',
      content: "That sounds like something to buy. I'll take you to New Request with your words; it checks the catalogue and existing contracts first, then asks only what is still needed.",
    },
    {
      type: 'deep-link',
      label: 'Start the request',
      description: text,
      path: `/requests/new?q=${encodeURIComponent(text)}`,
    },
  ];
}
