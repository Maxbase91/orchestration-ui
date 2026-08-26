// Assistant handover — raises a support ticket when the user asks for a human.
//
// Persists through the shared ticket module so the assistant and the Contact
// Support form write to one store. Previously this appended to an in-memory
// array while telling the user to track the ticket in Help → Support, which
// reads Supabase — so the ticket it promised could never be found there.

import { createTicket as persistTicket } from '@/lib/db/tickets';
import type { AssistantTurn } from '@/data/types';
import type { ProviderContext } from '../provider';

export async function createTicket(
  summary: string,
  context: string,
  ctx: ProviderContext,
): Promise<AssistantTurn[]> {
  let ticket;
  try {
    ticket = await persistTicket({
      summary,
      context,
      createdBy: ctx.currentUser.name,
      source: 'assistant',
    });
  } catch {
    // Never strand the user on a storage failure: say plainly that it did not
    // save, rather than returning a ticket ID that does not exist.
    return [
      {
        type: 'chat-answer',
        content:
          "I couldn't raise the ticket just now — the request didn't save. Please try again, or use Help → Contact Support to submit it directly.",
      },
      {
        type: 'deep-link',
        label: 'Contact Support',
        description: 'Submit the request directly',
        path: '/help/support',
      },
    ];
  }

  return [
    {
      type: 'chat-answer',
      content: `I've raised a support ticket on your behalf.\n\n**Ticket ID:** ${ticket.id}\n**Summary:** ${ticket.summary}\n\nA member of the Procurement team will review this and get back to you. You can track the ticket status in Help → Support.`,
    },
    {
      type: 'deep-link',
      label: `Support Ticket — ${ticket.id}`,
      description: 'View ticket status and responses',
      path: `/help/support`,
    },
  ];
}
