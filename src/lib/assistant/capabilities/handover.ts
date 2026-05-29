import { appendTicket } from '@/data/tickets';
import type { AssistantTurn } from '@/data/types';
import type { ProviderContext } from '../provider';

export function createTicket(summary: string, context: string, ctx: ProviderContext): AssistantTurn[] {
  const ticket = appendTicket(summary, context, ctx.currentUser.name);

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
