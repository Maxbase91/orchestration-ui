import type { AssistantMessage, AssistantTurn, ConfirmTurn } from '@/data/types';
import type { AssistantProvider, ProviderContext } from './provider';
import { classifyIntent, allowedActions } from './intents';
import { searchKnowledge } from './capabilities/knowledge';
import { lookupObject } from './capabilities/lookup';
import { proposeAction, executeAction } from './capabilities/action';
import { createTicket } from './capabilities/handover';
import { startDemand } from './capabilities/intake';

// Patterns to extract actionable intent from user input.
function extractActionIntent(input: string): { actionType: string; params: Record<string, unknown> } | null {
  const t = input.toLowerCase();

  if (/add (me (as )?a? ?watcher|watcher)/.test(t)) {
    const requestIdMatch = input.match(/\b(REQ-\S+)/i);
    return { actionType: 'add_watcher', params: { requestId: requestIdMatch?.[1] ?? '' } };
  }

  if (/set (my |an? )?delegate|delegate (my |approvals? )?(to)?/.test(t)) {
    const nameMatch = input.match(/to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    return { actionType: 'set_delegate', params: { delegateName: nameMatch?.[1] ?? '' } };
  }

  if (/out.of.office|set (me as |my )?ooo/.test(t)) {
    const untilMatch = input.match(/until\s+(\S+)/i);
    return { actionType: 'set_ooo', params: { until: untilMatch?.[1] ?? '' } };
  }

  if (/request (a )?risk reassessment/.test(t)) {
    const supMatch = input.match(/for\s+([\w\s-]+?)(?:\s*$|\.)/i);
    return { actionType: 'request_risk_reassessment', params: { subjectId: supMatch?.[1]?.trim() ?? '' } };
  }

  if (/request (contract )?renewal/.test(t)) {
    const conMatch = input.match(/\b(CON-\S+)/i);
    return { actionType: 'request_contract_renewal', params: { contractId: conMatch?.[1] ?? '' } };
  }

  if (/request (a )?po change/.test(t)) {
    const poMatch = input.match(/\b(PO-\S+)/i);
    return { actionType: 'request_po_change', params: { poId: poMatch?.[1] ?? '', changeDescription: input } };
  }

  if (/raise (a )?payment.*(escalation|escalate)|escalate.*payment/.test(t)) {
    const invMatch = input.match(/\b(INV-\S+)/i);
    return { actionType: 'raise_payment_escalation', params: { invoiceId: invMatch?.[1] ?? '' } };
  }

  if (/reassign/.test(t)) {
    const reqMatch = input.match(/\b(REQ-\S+)/i);
    return { actionType: 'reassign_request', params: { requestId: reqMatch?.[1] ?? '', newOwner: '' } };
  }

  if (/approver substitut/.test(t)) {
    return { actionType: 'approver_substitution', params: { originalApprover: '', substituteApprover: '', requestId: '' } };
  }

  return null;
}

// Navigation shortcuts — return deep-links before intent classification.
function tryNavigationShortcut(input: string): AssistantTurn[] | null {
  const t = input.toLowerCase();
  if (/compare bids?|bid comparison|evaluation cent(re|er)|score bids?/.test(t)) {
    return [
      { type: 'chat-answer', content: 'The Evaluation Centre lets you score and compare bids side-by-side. Opening it now.' },
      { type: 'deep-link', label: 'Evaluation Centre — Bid Comparison', description: 'Score and compare all active bid responses', path: '/sourcing/evaluation' },
    ];
  }
  if (/spend (analytics|overview|dashboard)|view spend|check spend/.test(t)) {
    return [
      { type: 'chat-answer', content: 'Here\'s your Spend Overview dashboard.' },
      { type: 'deep-link', label: 'Spend Overview', description: 'Spend by category, supplier, and cost centre', path: '/analytics/spend' },
    ];
  }
  if (/bottleneck|workflow monitor|pipeline monitor/.test(t)) {
    return [
      { type: 'chat-answer', content: 'The Workflow Monitor shows all active pipelines and where they\'re stuck.' },
      { type: 'deep-link', label: 'Workflow Monitor — Bottlenecks', description: 'Live view of all workflow stages', path: '/workflows/monitor' },
    ];
  }
  return null;
}

// Extract lookup subject from user input.
function extractLookupSubject(input: string): { type: 'request' | 'supplier' | 'contract' | 'po' | 'invoice' | 'risk-assessment' | null; identifier: string } {
  const idMatch = input.match(/\b(REQ-[\w-]+|SUP-\d+|CON-\d+|PO-\d+|INV-[\w-]+|RA-\d+)\b/i);
  if (idMatch) {
    const id = idMatch[1].toUpperCase();
    if (id.startsWith('REQ-')) return { type: 'request', identifier: id };
    if (id.startsWith('SUP-')) return { type: 'supplier', identifier: id };
    if (id.startsWith('CON-')) return { type: 'contract', identifier: id };
    if (id.startsWith('PO-')) return { type: 'po', identifier: id };
    if (id.startsWith('INV-')) return { type: 'invoice', identifier: id };
    if (id.startsWith('RA-')) return { type: 'risk-assessment', identifier: id };
  }

  // Name-based supplier lookup
  const knownNames = ['accenture', 'sap', 'deloitte', 'infosys', 'capgemini', 'randstad', 'hays', 'acme'];
  const t = input.toLowerCase();
  const nameMatch = knownNames.find((n) => t.includes(n));
  if (nameMatch) return { type: 'supplier', identifier: nameMatch };

  // Contract keyword
  if (/contract/.test(t) && !/renewal|renew/.test(t)) return { type: 'contract', identifier: input };

  return { type: null, identifier: input };
}

// Build forward-step chips based on role and last turn context.
function buildForwardChips(ctx: ProviderContext, _lastInput: string): AssistantTurn[] {
  const chips = allowedActions(ctx.role)
    .slice(0, 3)
    .map((label) => ({ label, prompt: label }));
  if (chips.length === 0) return [];
  return [{ type: 'suggestion-chips', chips }];
}

// Fallback when no intent matches.
function unknownResponse(input: string, ctx: ProviderContext): AssistantTurn[] {
  const context = `User query: "${input}". Role: ${ctx.role}. No grounded answer found.`;
  return createTicket(`Unresolved query: ${input.slice(0, 80)}`, context, ctx);
}

export const mockProvider: AssistantProvider = {
  async respond(messages: AssistantMessage[], ctx: ProviderContext): Promise<AssistantTurn[]> {
    // Use only the last user message for mock intent classification.
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return [];

    const input = lastUser.content.trim();

    // Navigation shortcuts bypass intent classification.
    const shortcut = tryNavigationShortcut(input);
    if (shortcut) return shortcut;

    const intent = classifyIntent(input);

    switch (intent) {
      case 'knowledge': {
        const turns = searchKnowledge(input);
        if (turns.length === 0) return unknownResponse(input, ctx);
        // Append role-aware forward chips if knowledge answer didn't include any
        const hasChips = turns.some((t) => t.type === 'suggestion-chips');
        if (!hasChips) turns.push(...buildForwardChips(ctx, input));
        return turns;
      }

      case 'lookup': {
        const { type, identifier } = extractLookupSubject(input);
        const turns = lookupObject(type, identifier);
        return turns;
      }

      case 'action': {
        const parsed = extractActionIntent(input);
        if (!parsed) {
          return [
            {
              type: 'chat-answer',
              content: "I understood you want to take an action, but I couldn't identify which one. Could you be more specific? For example: \"Set my delegate to Jane Smith\" or \"Add me as a watcher to REQ-2024-0001\".",
            },
            ...buildForwardChips(ctx, input),
          ];
        }
        return proposeAction(parsed.actionType, parsed.params, ctx);
      }

      case 'intake': {
        return startDemand(input);
      }

      case 'handover': {
        const context = `User requested human assistance. Query: "${input}". Role: ${ctx.role}.`;
        return createTicket(`Handover requested: ${input.slice(0, 80)}`, context, ctx);
      }

      default:
        return unknownResponse(input, ctx);
    }
  },

  async executeAction(turn: ConfirmTurn, ctx: ProviderContext): Promise<AssistantTurn[]> {
    return executeAction(turn, ctx);
  },
};
