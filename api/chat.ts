import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLLMWithTools, type LLMMessage, type GroqTool } from './_llm.js';
import { createClient } from '@supabase/supabase-js';
import { knowledgeBase } from '../src/data/knowledgeBase.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const TOOLS: GroqTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the procurement knowledge base for policies, KOPs, FAQs, and process guidelines. Always use this for policy/process questions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The user question or topic to search for' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_object',
      description: 'Look up a specific procurement object by type and identifier. Use for status queries.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Object type',
            enum: ['request', 'supplier', 'contract', 'po', 'invoice', 'risk-assessment'],
          },
          identifier: { type: 'string', description: 'ID (REQ-2024-0001, SUP-001) or name (Accenture)' },
        },
        required: ['type', 'identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_action',
      description: 'Propose an action for user confirmation. NEVER execute a state-changing action without calling this first.',
      parameters: {
        type: 'object',
        properties: {
          action_type: {
            type: 'string',
            description: 'Action type: add_watcher | set_delegate | set_ooo | reassign_request | request_risk_reassessment | request_contract_renewal | request_po_change | raise_payment_escalation | approver_substitution',
          },
          params: { type: 'string', description: 'JSON string of action parameters' },
          read_back: { type: 'string', description: 'Human-readable description of what will happen, used to confirm with the user' },
        },
        required: ['action_type', 'params', 'read_back'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_ticket',
      description: 'Create a support/handover ticket when the user needs human help or no grounded answer exists.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'One-line ticket summary' },
          context: { type: 'string', description: 'Full context from the conversation' },
        },
        required: ['summary', 'context'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_demand',
      description: 'Detect buy/procure intent and prepare a deep-link to the New Request wizard.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Procurement category',
            enum: ['goods', 'services', 'software', 'consulting', 'contingent-labour', 'catalogue'],
          },
          estimated_value: { type: 'string', description: 'Estimated value in EUR (number as string, optional)' },
          supplier: { type: 'string', description: 'Preferred supplier name if known, optional' },
        },
        required: ['category'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a procurement assistant for an enterprise platform.

RULES — always follow these:
1. ALWAYS call a tool to answer. Never respond from your own knowledge or guess.
2. Policy/process questions → search_knowledge.
3. Status or detail queries → lookup_object (include the ID or name exactly as given).
4. State-changing actions (delegate, watcher, escalation, PO change, etc.) → propose_action first; NEVER execute without user confirmation.
5. User asks for human help or you cannot answer grounded → create_ticket.
6. Buy/procure intent → start_demand.
7. After a tool result, write a concise, grounded response using only the returned data. Do not add facts not in the result.`;

// ─── Tool handlers ────────────────────────────────────────────────────────────

function execSearchKnowledge(query: string): string {
  const q = query.toLowerCase();
  const scored = knowledgeBase.map((entry) => {
    let score = 0;
    const tags = entry.tags.join(' ').toLowerCase();
    const title = entry.title.toLowerCase();
    const body = entry.body.toLowerCase();
    for (const word of q.split(/\s+/).filter((w) => w.length > 3)) {
      if (tags.includes(word)) score += 3;
      if (title.includes(word)) score += 2;
      if (body.includes(word)) score += 1;
    }
    return { entry, score };
  });

  const top = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (top.length === 0) return JSON.stringify({ found: false });

  return JSON.stringify({
    found: true,
    entries: top.map(({ entry }) => ({
      id: entry.id,
      title: entry.title,
      body: entry.body,
      source: entry.source,
    })),
  });
}

async function execLookupObject(type: string, identifier: string): Promise<string> {
  const id = identifier.toUpperCase();

  if (type === 'supplier') {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, tier, country, risk_rating, performance_score, total_spend_12m, active_contracts, sra_status, sra_expiry_date, screening_status')
      .or(`id.eq.${id},name.ilike.%${identifier}%`)
      .limit(1)
      .maybeSingle();

    if (!data) return JSON.stringify({ found: false, type: 'supplier', identifier });
    return JSON.stringify({ found: true, type: 'supplier', data });
  }

  if (type === 'request') {
    const { data } = await supabase
      .from('requests')
      .select('id, title, status, priority, value, category, requestor_id, owner_id, delivery_date, days_in_stage, is_overdue, buying_channel')
      .eq('id', id)
      .maybeSingle();

    if (!data) return JSON.stringify({ found: false, type: 'request', identifier });
    return JSON.stringify({ found: true, type: 'request', data });
  }

  if (type === 'contract') {
    const { data } = await supabase
      .from('contracts')
      .select('id, title, supplier_name, value, status, start_date, end_date, utilisation_percentage, owner_name, department')
      .or(`id.eq.${id},supplier_name.ilike.%${identifier}%`)
      .limit(1)
      .maybeSingle();

    if (!data) return JSON.stringify({ found: false, type: 'contract', identifier });
    return JSON.stringify({ found: true, type: 'contract', data });
  }

  if (type === 'po') {
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, supplier_name, value, status, delivery_date')
      .eq('id', id)
      .maybeSingle();

    if (!data) return JSON.stringify({ found: false, type: 'po', identifier });
    return JSON.stringify({ found: true, type: 'po', data });
  }

  if (type === 'invoice') {
    const { data } = await supabase
      .from('invoices')
      .select('id, supplier_name, amount, status, due_date, match_status, match_variance')
      .eq('id', id)
      .maybeSingle();

    if (!data) return JSON.stringify({ found: false, type: 'invoice', identifier });
    return JSON.stringify({ found: true, type: 'invoice', data });
  }

  if (type === 'risk-assessment') {
    const { data } = await supabase
      .from('risk_assessments')
      .select('id, title, risk_level, score, status, valid_until, summary')
      .eq('id', id)
      .maybeSingle();

    if (!data) return JSON.stringify({ found: false, type: 'risk-assessment', identifier });
    return JSON.stringify({ found: true, type: 'risk-assessment', data });
  }

  return JSON.stringify({ found: false, error: `Unknown object type: ${type}` });
}

async function execCreateTicket(
  summary: string,
  context: string,
  userId: string,
  userName: string,
): Promise<{ ticketId: string }> {
  const { data: last } = await supabase
    .from('tickets')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNum = last
    ? parseInt((last.id as string).replace('TKT-', ''), 10) + 1
    : 1;
  const ticketId = `TKT-${String(nextNum).padStart(4, '0')}`;

  await supabase.from('tickets').insert({
    id: ticketId,
    summary,
    context,
    status: 'open',
    created_by: userName || userId,
  });

  return { ticketId };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    messages: rawMessages,
    context: ctx,
  } = req.body as {
    messages: Array<{ role: string; content: string }>;
    context: { role: string; currentUser: { id: string; name: string } };
  };

  if (!rawMessages?.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...rawMessages.map((m) => ({ role: m.role as LLMMessage['role'], content: m.content })),
  ];

  // Track structural context for post-processing turns
  let lookupType: string | null = null;
  let lookupIdentifier: string | null = null;
  let ticketCreated: string | null = null;
  let demandCategory: string | null = null;
  let demandValue: string | null = null;
  let demandSupplier: string | null = null;

  const MAX_ITERATIONS = 5;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let result;
    try {
      result = await callLLMWithTools(llmMessages, TOOLS);
    } catch (e) {
      console.error('callLLMWithTools error:', e);
      return res.status(500).json({
        turns: [{ type: 'chat-answer', content: 'The assistant encountered an error. Please try again.' }],
      });
    }

    llmMessages.push(result.assistantMessage as LLMMessage);

    if (result.finishReason === 'stop' || result.toolCalls.length === 0) {
      // Final response — build turns
      const text = result.content?.trim() ?? '';
      const turns: unknown[] = [];

      if (text) {
        turns.push({ type: 'chat-answer', content: text });
      }

      // Structural turns based on which tools were called
      if (lookupType === 'supplier' && lookupIdentifier) {
        turns.push({
          type: 'deep-link',
          label: `Vendor 360 — ${lookupIdentifier}`,
          description: 'Full supplier profile, contracts, and risk history',
          path: `/suppliers/${lookupIdentifier.toUpperCase()}`,
        });
      } else if (lookupType === 'request' && lookupIdentifier) {
        turns.push({
          type: 'deep-link',
          label: `Request Detail — ${lookupIdentifier.toUpperCase()}`,
          description: 'Full request timeline, approvals, and documents',
          path: `/requests/${lookupIdentifier.toUpperCase()}`,
        });
      } else if (lookupType === 'contract' && lookupIdentifier) {
        turns.push({
          type: 'deep-link',
          label: `Contract Detail — ${lookupIdentifier.toUpperCase()}`,
          description: 'Full contract, amendments, and renewal history',
          path: `/contracts/${lookupIdentifier.toUpperCase()}`,
        });
      } else if (lookupType === 'po' && lookupIdentifier) {
        turns.push({
          type: 'deep-link',
          label: `Purchase Order — ${lookupIdentifier.toUpperCase()}`,
          description: 'PO lines, receipts, and invoice match status',
          path: `/purchasing/orders/${lookupIdentifier.toUpperCase()}`,
        });
      } else if (lookupType === 'invoice' && lookupIdentifier) {
        turns.push({
          type: 'deep-link',
          label: `Invoice — ${lookupIdentifier.toUpperCase()}`,
          description: 'Invoice detail, matching, and payment status',
          path: '/purchasing/invoices',
        });
      }

      if (ticketCreated) {
        turns.push({
          type: 'deep-link',
          label: `Support Ticket — ${ticketCreated}`,
          description: 'View your ticket status and responses',
          path: '/help/support',
        });
      }

      if (demandCategory) {
        const params = new URLSearchParams({ category: demandCategory });
        if (demandValue) params.set('value', demandValue);
        if (demandSupplier) params.set('supplier', demandSupplier);
        turns.push({
          type: 'deep-link',
          label: 'Start New Request',
          description: `Open the ${demandCategory} request wizard`,
          path: `/requests/new?${params.toString()}`,
        });
      }

      if (turns.length === 0) {
        turns.push({ type: 'chat-answer', content: 'I could not find a grounded answer. Try rephrasing or asking for human help.' });
      }

      return res.status(200).json({ turns });
    }

    // Execute tool calls
    for (const tc of result.toolCalls) {
      const toolName = tc.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        // ignore parse errors
      }

      let toolResult = '';

      if (toolName === 'propose_action') {
        const actionType = (args.action_type as string) ?? '';
        const params = args.params
          ? (typeof args.params === 'string' ? JSON.parse(args.params) : args.params) as Record<string, unknown>
          : {};
        const readBack = (args.read_back as string) ?? `Execute ${actionType}`;
        const actionId = crypto.randomUUID();

        return res.status(200).json({
          turns: [{
            type: 'confirm',
            readBack,
            actionType,
            actionParams: params,
            actionId,
          }],
        });
      }

      if (toolName === 'search_knowledge') {
        toolResult = execSearchKnowledge((args.query as string) ?? '');
      } else if (toolName === 'lookup_object') {
        const type = (args.type as string) ?? '';
        const identifier = (args.identifier as string) ?? '';
        lookupType = type;
        lookupIdentifier = identifier;
        toolResult = await execLookupObject(type, identifier);
      } else if (toolName === 'create_ticket') {
        const { ticketId } = await execCreateTicket(
          (args.summary as string) ?? '',
          (args.context as string) ?? '',
          ctx?.currentUser?.id ?? 'unknown',
          ctx?.currentUser?.name ?? 'Unknown User',
        );
        ticketCreated = ticketId;
        toolResult = JSON.stringify({ ticketId, created: true });
      } else if (toolName === 'start_demand') {
        demandCategory = (args.category as string) ?? 'services';
        demandValue = (args.estimated_value as string) ?? null;
        demandSupplier = (args.supplier as string) ?? null;
        toolResult = JSON.stringify({ category: demandCategory, deepLinkReady: true });
      } else {
        toolResult = JSON.stringify({ error: `Unknown tool: ${toolName}` });
      }

      llmMessages.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: tc.id,
        name: toolName,
      });
    }
  }

  return res.status(200).json({
    turns: [{ type: 'chat-answer', content: 'The assistant reached its iteration limit. Please try a simpler query.' }],
  });
}
