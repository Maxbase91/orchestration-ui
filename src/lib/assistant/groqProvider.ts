import type { AssistantMessage, ConfirmTurn, AssistantTurn } from '@/data/types';
import type { AssistantProvider, ProviderContext } from './provider';

export const groqProvider: AssistantProvider = {
  async respond(messages: AssistantMessage[], ctx: ProviderContext): Promise<AssistantTurn[]> {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context: ctx }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('api/chat error:', res.status, err);
        return [{
          type: 'chat-answer',
          content: 'Sorry, I ran into an issue reaching the assistant. Please try again.',
        }];
      }

      const { turns } = (await res.json()) as { turns: AssistantTurn[] };
      return turns;
    } catch (e) {
      console.error('groqProvider.respond:', e);
      return [{
        type: 'chat-answer',
        content: 'Unable to reach the assistant right now. Please check your connection.',
      }];
    }
  },

  async executeAction(turn: ConfirmTurn, ctx: ProviderContext): Promise<AssistantTurn[]> {
    try {
      const res = await fetch('/api/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: turn.actionType,
          actionParams: turn.actionParams,
          userId: ctx.currentUser.id,
          userName: ctx.currentUser.name,
          role: ctx.role,
        }),
      });

      if (!res.ok) {
        return [{ type: 'chat-answer', content: 'The action could not be completed. Please try again.' }];
      }

      const { turns } = (await res.json()) as { turns: AssistantTurn[] };
      return turns;
    } catch (e) {
      console.error('groqProvider.executeAction:', e);
      return [{ type: 'chat-answer', content: 'Action failed. Please try again.' }];
    }
  },
};
