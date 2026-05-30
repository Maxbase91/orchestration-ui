import type { AssistantMessage, ConfirmTurn, AssistantTurn } from '@/data/types';
import type { AssistantProvider, ProviderContext } from './provider';
import { mockProvider } from './mockProvider';

export const groqProvider: AssistantProvider = {
  async respond(messages: AssistantMessage[], ctx: ProviderContext): Promise<AssistantTurn[]> {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context: ctx }),
      });

      if (!res.ok) {
        console.warn('api/chat returned', res.status, '— falling back to mock');
        return mockProvider.respond(messages, ctx);
      }

      const { turns } = (await res.json()) as { turns: AssistantTurn[] };
      if (!turns?.length) {
        console.warn('api/chat returned empty turns — falling back to mock');
        return mockProvider.respond(messages, ctx);
      }

      return turns;
    } catch (e) {
      console.warn('api/chat unreachable — falling back to mock:', e);
      return mockProvider.respond(messages, ctx);
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
        console.warn('api/execute-action returned', res.status, '— falling back to mock');
        return mockProvider.executeAction(turn, ctx);
      }

      const { turns } = (await res.json()) as { turns: AssistantTurn[] };
      return turns?.length ? turns : mockProvider.executeAction(turn, ctx);
    } catch (e) {
      console.warn('api/execute-action unreachable — falling back to mock:', e);
      return mockProvider.executeAction(turn, ctx);
    }
  },
};
