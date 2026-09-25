// A routed question as chat turns: what the assistant shows when the shared
// route (question-route.ts) answers without the model — the same answers, and
// the same next steps, as the Home box.
//
// Pure. Relative imports only, so test:question-route exercises it.

import type { AssistantTurn } from '../../data/types.js';
import type { QuestionRoute } from './question-route.js';
import type { PolicyAnswer } from './policy-lookup.js';
import { startDemand } from './capabilities/intake.js';

const euros = (n: number) => `€${n.toLocaleString('en-IE', { maximumFractionDigits: 2 })}`;

export function routeTurns(route: Exclude<QuestionRoute, { kind: 'assistant' }>, query: string): AssistantTurn[] {
  switch (route.kind) {
    case 'status':
      return [{ type: 'status-answer', answer: route.status }];
    case 'policy':
      return [{ type: 'policy-answer', answer: route.policy }];
    case 'demand':
      return startDemand(query);
    case 'catalogue': {
      const items = route.items.slice(0, 3);
      return [
        {
          type: 'chat-answer',
          content: items.length === 1
            ? 'This looks like a catalogue item you can order today.'
            : `This looks like ${items.length} catalogue items you can order today.`,
        },
        ...items.map((item): AssistantTurn => ({
          type: 'deep-link',
          label: item.name,
          description: `${euros(item.unitPrice)} / ${item.unit} · ${item.supplierName}`,
          // Into the basket on the Catalogue page, where catalogue orders are placed.
          path: `/catalogue?add=${encodeURIComponent(item.id)}`,
        })),
        // The correction, as on Home: the words go with it, nothing is retyped.
        {
          type: 'deep-link',
          label: 'Not what you need? Describe it in full',
          description: query.trim().slice(0, 120),
          path: `/requests/new?q=${encodeURIComponent(query.trim().slice(0, 300))}`,
        },
      ];
    }
  }
}

/** A policy answer as text, for the model's view of the conversation so far. */
export function policyAnswerText(answer: PolicyAnswer): string {
  return [answer.direct?.answer, answer.entry && `${answer.entry.title}: ${answer.entry.text}`]
    .filter(Boolean)
    .join('\n');
}
