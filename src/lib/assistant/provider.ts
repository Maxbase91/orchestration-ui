import type { AssistantMessage, AssistantTurn, ConfirmTurn } from '@/data/types';
import type { Role } from '@/config/roles';

export interface ProviderContext {
  role: Role;
  currentUser: { id: string; name: string };
}

export interface AssistantProvider {
  respond(messages: AssistantMessage[], context: ProviderContext): Promise<AssistantTurn[]>;
  executeAction(turn: ConfirmTurn, context: ProviderContext): Promise<AssistantTurn[]>;
}
