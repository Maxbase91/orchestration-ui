import type { AssistantMessage, AssistantTurn, ConfirmTurn } from '@/data/types';
import type { AssistantProvider, ProviderContext } from './provider';
import { classifyIntent, allowedActions } from './intents';
import { searchKnowledge } from './capabilities/knowledge';
import { lookupObject } from './capabilities/lookup';
import { proposeAction, executeAction } from './capabilities/action';
import { createTicket } from './capabilities/handover';
import { startDemand } from './capabilities/intake';

// ─── Action intent extraction ─────────────────────────────────────────────────
// Returns null when a required parameter is missing (triggers clarification).

function extractActionIntent(
  input: string
): { actionType: string; params: Record<string, unknown>; missingParam?: string } | null {
  const t = input.toLowerCase();

  if (/add (me (as )?a? ?watcher|watcher)/.test(t)) {
    const requestIdMatch = input.match(/\b(REQ-[\w-]+)/i);
    if (!requestIdMatch) return { actionType: 'add_watcher', params: {}, missingParam: 'request ID (e.g. REQ-2024-0001)' };
    return { actionType: 'add_watcher', params: { requestId: requestIdMatch[1].toUpperCase() } };
  }

  if (/set (my |an? )?delegate|delegate (my |approvals? )?(to)?/.test(t)) {
    const nameMatch = input.match(/\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (!nameMatch) return { actionType: 'set_delegate', params: {}, missingParam: "your delegate's name (e.g. \"Set my delegate to Jane Smith\")" };
    return { actionType: 'set_delegate', params: { delegateName: nameMatch[1] } };
  }

  if (/out.of.office|set (me as |my )?ooo/.test(t)) {
    const untilMatch = input.match(/until\s+(\S+)/i);
    return { actionType: 'set_ooo', params: { until: untilMatch?.[1] ?? '' } };
  }

  if (/request (a )?risk reassessment/.test(t)) {
    const supMatch = input.match(/for\s+([\w\s-]+?)(?:\s*$|\.)/i);
    if (!supMatch) return { actionType: 'request_risk_reassessment', params: {}, missingParam: 'the supplier or contract name (e.g. "for Accenture")' };
    return { actionType: 'request_risk_reassessment', params: { subjectId: supMatch[1].trim() } };
  }

  if (/request (contract )?renewal/.test(t)) {
    const conMatch = input.match(/\b(CON-\S+)/i);
    if (!conMatch) return { actionType: 'request_contract_renewal', params: {}, missingParam: 'the contract ID (e.g. CON-003)' };
    return { actionType: 'request_contract_renewal', params: { contractId: conMatch[1].toUpperCase() } };
  }

  if (/request (a )?po change/.test(t)) {
    const poMatch = input.match(/\b(PO-\S+)/i);
    if (!poMatch) return { actionType: 'request_po_change', params: {}, missingParam: 'the PO ID (e.g. PO-001)' };
    return { actionType: 'request_po_change', params: { poId: poMatch[1].toUpperCase(), changeDescription: input } };
  }

  if (/raise (a )?payment.*(escalation|escalate)|escalate.*payment/.test(t)) {
    const invMatch = input.match(/\b(INV-[\w-]+)/i);
    if (!invMatch) return { actionType: 'raise_payment_escalation', params: {}, missingParam: 'the invoice ID (e.g. INV-001)' };
    return { actionType: 'raise_payment_escalation', params: { invoiceId: invMatch[1].toUpperCase() } };
  }

  if (/\breeasign\b|reassign/.test(t)) {
    const reqMatch = input.match(/\b(REQ-[\w-]+)/i);
    if (!reqMatch) return { actionType: 'reassign_request', params: {}, missingParam: 'the request ID (e.g. REQ-2024-0001)' };
    return { actionType: 'reassign_request', params: { requestId: reqMatch[1].toUpperCase(), newOwner: '' } };
  }

  if (/approver substitut/.test(t)) {
    return { actionType: 'approver_substitution', params: { originalApprover: '', substituteApprover: '', requestId: '' }, missingParam: 'the approver names and request ID' };
  }

  return null;
}

// ─── Navigation shortcuts ─────────────────────────────────────────────────────
// These bypass intent classification for common navigation queries.

function tryNavigationShortcut(input: string): AssistantTurn[] | null {
  const t = input.toLowerCase();

  // My requests / demand status
  if (/\b(my (last|latest|recent|current|open)? ?(request|demand|order|purchase)|track (my|a) (request|demand)|where is my (request|demand)|status of my (request|demand)|what('s| is) (happening|the status) (with|of) my)\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'Here are your requests. You can filter by status, category, or date to find the one you\'re looking for.' },
      { type: 'deep-link', label: 'My Requests', description: 'All requests you have raised', path: '/requests/my' },
    ];
  }

  // All requests (for managers)
  if (/\ball requests?\b|\bview (all|the) requests?\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'Here\'s the full requests pipeline.' },
      { type: 'deep-link', label: 'All Requests', description: 'Full demand pipeline', path: '/requests' },
    ];
  }

  // Approvals — careful not to match "approval delegate" (which is an action)
  if (/\b(my approvals?|pending approvals?|what (needs|require)s? my approvals?|approval queue)\b/.test(t) && !/\b(delegate|chain|limit|matrix)\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'Here are the items waiting for your approval.' },
      { type: 'deep-link', label: 'My Approvals', description: 'Pending approvals in your queue', path: '/approvals' },
    ];
  }

  // Contract renewals / expiring
  if (/\b(contract renewals?|renewing contracts?|expiring contracts?|contracts? (due|coming up|expir))\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'Here are contracts approaching renewal. Review them at least 90 days before expiry.' },
      { type: 'deep-link', label: 'Contract Renewals', description: 'Contracts due for renewal', path: '/contracts/renewals' },
      { type: 'deep-link', label: 'All Contracts', description: 'Full contracts register', path: '/contracts' },
    ];
  }

  // Supplier directory / risk
  if (/\b(supplier directory|all suppliers|supplier list|supplier risk overview|supplier(s)? overview)\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'Opening the Supplier Directory. Use filters to narrow by tier, risk rating, or category.' },
      { type: 'deep-link', label: 'Supplier Directory', description: 'All registered suppliers', path: '/suppliers' },
      { type: 'deep-link', label: 'Supplier Risk', description: 'Risk assessments and SRA status', path: '/suppliers/risk' },
    ];
  }

  // Bid comparison / Evaluation Centre
  if (/\b(compare bids?|bid comparison|evaluation cent(re|er)|score bids?|bid evaluation)\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'The Evaluation Centre lets you score and compare bids side-by-side.' },
      { type: 'deep-link', label: 'Evaluation Centre — Bid Comparison', description: 'Score and compare all active bid responses', path: '/sourcing/evaluation' },
    ];
  }

  // Spend analytics
  if (/\b(spend (analytics|overview|dashboard|report)|view spend|check spend|my spend|budget)\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'Here\'s your Spend Overview dashboard.' },
      { type: 'deep-link', label: 'Spend Overview', description: 'Spend by category, supplier, and cost centre', path: '/analytics/spend' },
    ];
  }

  // Workflow monitor / bottlenecks
  if (/\b(bottleneck|workflow monitor|pipeline monitor|stuck (requests?|approvals?))\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'The Workflow Monitor shows all active pipelines and where they\'re stuck.' },
      { type: 'deep-link', label: 'Workflow Monitor — Bottlenecks', description: 'Live view of all workflow stages', path: '/workflows/monitor' },
    ];
  }

  // Tasks
  if (/\bmy tasks?\b/.test(t)) {
    return [
      { type: 'chat-answer', content: 'Here are your open tasks.' },
      { type: 'deep-link', label: 'My Tasks', description: 'Open tasks assigned to you', path: '/tasks' },
    ];
  }

  return null;
}

// ─── Lookup subject extraction ────────────────────────────────────────────────

function extractLookupSubject(input: string): {
  type: 'request' | 'supplier' | 'contract' | 'po' | 'invoice' | 'risk-assessment' | null;
  identifier: string;
} {
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
  const knownNames = ['accenture', 'sap', 'deloitte', 'infosys', 'capgemini', 'atos', 'randstad', 'hays', 'acme', 'michael page', 'adecco'];
  const t = input.toLowerCase();
  const nameMatch = knownNames.find((n) => t.includes(n));
  if (nameMatch) return { type: 'supplier', identifier: nameMatch };

  // Contract keyword (not renewal — that's a navigation shortcut)
  if (/\bcontract\b/.test(t) && !/\b(renew|renewal|expir)\b/.test(t)) return { type: 'contract', identifier: input };

  // No recognisable object found
  return { type: null, identifier: '' };
}

// ─── Forward-step chips ───────────────────────────────────────────────────────

function buildForwardChips(ctx: ProviderContext): AssistantTurn[] {
  const chips = allowedActions(ctx.role)
    .slice(0, 3)
    .map((label) => ({ label, prompt: label }));
  if (chips.length === 0) return [];
  return [{ type: 'suggestion-chips', chips }];
}

// ─── Fallback ─────────────────────────────────────────────────────────────────
// Show helpful options instead of immediately creating a ticket.

function helpResponse(ctx: ProviderContext): AssistantTurn[] {
  return [
    {
      type: 'chat-answer',
      content: `I'm not sure I understood that. Here are some things I can help with:
• **Policies & process** — e.g. "What is the consulting threshold?"
• **Look up an object** — provide an ID (REQ-2024-0001, CON-003) or a supplier name (Accenture)
• **Take an action** — e.g. "Set my delegate to Jane Smith" or "Add me as watcher to REQ-2024-0001"
• **Raise a demand** — e.g. "I want to buy software"
• **Navigate** — e.g. "My requests", "My approvals", "Contract renewals"
• **Get human help** — "I need to speak to someone"`,
    },
    ...buildForwardChips(ctx),
  ];
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const mockProvider: AssistantProvider = {
  async respond(messages: AssistantMessage[], ctx: ProviderContext): Promise<AssistantTurn[]> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return [];

    const input = lastUser.content.trim();

    // Navigation shortcuts are checked first.
    const shortcut = tryNavigationShortcut(input);
    if (shortcut) return shortcut;

    const intent = classifyIntent(input);

    switch (intent) {
      case 'knowledge': {
        const turns = searchKnowledge(input);
        if (turns.length === 0) return helpResponse(ctx);
        const hasChips = turns.some((t) => t.type === 'suggestion-chips');
        if (!hasChips) turns.push(...buildForwardChips(ctx));
        return turns;
      }

      case 'lookup': {
        const { type, identifier } = extractLookupSubject(input);

        // No recognisable object — guide the user rather than error.
        if (!type && !identifier) {
          return [
            {
              type: 'chat-answer',
              content: 'I need a bit more information to look that up. Could you provide:\n• A request ID (e.g. REQ-2024-0001)\n• A supplier name (e.g. Accenture) or ID (e.g. SUP-001)\n• A contract ID (e.g. CON-003)\n• Or a PO / invoice ID',
            },
            {
              type: 'deep-link',
              label: 'My Requests',
              description: 'Browse your open requests',
              path: '/requests/my',
            },
          ];
        }

        return lookupObject(type, identifier);
      }

      case 'action': {
        const parsed = extractActionIntent(input);

        if (!parsed) {
          return [
            {
              type: 'chat-answer',
              content: 'I can take actions on your behalf — here are some examples:\n• "Set my delegate to Jane Smith"\n• "Add me as a watcher to REQ-2024-0001"\n• "Request a risk reassessment for Accenture"\n• "Set out-of-office"\n\nWhat would you like to do?',
            },
            ...buildForwardChips(ctx),
          ];
        }

        // Required param is missing — ask for it specifically.
        if (parsed.missingParam) {
          return [
            {
              type: 'chat-answer',
              content: `To do that I need ${parsed.missingParam}. Could you provide it?`,
            },
          ];
        }

        return proposeAction(parsed.actionType, parsed.params, ctx);
      }

      case 'intake':
        return startDemand(input);

      case 'handover': {
        const context = `User requested human assistance. Query: "${input}". Role: ${ctx.role}.`;
        return createTicket(`Handover requested: ${input.slice(0, 80)}`, context, ctx);
      }

      default:
        return helpResponse(ctx);
    }
  },

  async executeAction(turn: ConfirmTurn, ctx: ProviderContext): Promise<AssistantTurn[]> {
    return executeAction(turn, ctx);
  },
};
