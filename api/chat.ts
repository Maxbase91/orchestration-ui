import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLLMWithTools, callLLMStreaming, callLLM, type LLMMessage, type GroqTool } from './_llm.js';
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
  {
    type: 'function',
    function: {
      name: 'filter_objects',
      description: 'Query a list of procurement objects using filter criteria. Use for "show me all X", "which Y are Z" queries (e.g. overdue requests, high-risk suppliers, expiring contracts).',
      parameters: {
        type: 'object',
        properties: {
          object_type: {
            type: 'string',
            enum: ['requests', 'suppliers', 'contracts', 'purchase_orders', 'invoices'],
            description: 'The type of objects to query',
          },
          filters: {
            type: 'string',
            description: 'JSON string of filter criteria. Requests: {is_overdue, status, priority, category}. Suppliers: {risk_rating, sra_status}. Contracts: {status}. Invoices: {match_status, status}.',
          },
          limit: {
            type: 'number',
            description: 'Max results to return, 1–10 (default 5)',
          },
        },
        required: ['object_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember_preference',
      description: 'Store a user preference for future sessions — e.g. their delegate, cost centre, department, or preferred supplier. Call this when the user tells you something personal that should be remembered.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Preference key, e.g. "delegate", "cost_centre", "department", "preferred_supplier"' },
          value: { type: 'string', description: 'The value to remember' },
        },
        required: ['key', 'value'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a procurement assistant for an enterprise platform.

RULES — always follow these:
1. ALWAYS call a tool to answer. Never respond from your own knowledge or guess.
2. Policy/process questions → search_knowledge.
3. Status or detail queries on a single object → lookup_object (include the ID or name exactly as given).
4. List/filter queries ("show me all X", "which Y are Z") → filter_objects.
5. State-changing actions (delegate, watcher, escalation, PO change, etc.) → propose_action first; NEVER execute without user confirmation.
6. User asks for human help or you cannot answer grounded → create_ticket.
7. Buy/procure intent → start_demand.
8. User mentions personal info to remember (delegate name, cost centre, department) → remember_preference.
9. After a tool result, write a concise, grounded response using only the returned data. Do not add facts not in the result.`;

// ─── Tool handlers ────────────────────────────────────────────────────────────

function scoreEntry(entry: { title: string; body: string; tags: string[] }, query: string): number {
  let score = 0;
  const q = query.toLowerCase();
  const tags = entry.tags.join(' ').toLowerCase();
  const title = entry.title.toLowerCase();
  const body = entry.body.toLowerCase();
  for (const word of q.split(/\s+/).filter((w) => w.length > 3)) {
    if (tags.includes(word)) score += 3;
    if (title.includes(word)) score += 2;
    if (body.includes(word)) score += 1;
  }
  return score;
}

async function execSearchKnowledge(query: string): Promise<string> {
  // Try Supabase dynamic KB first; fall back to hardcoded array if empty.
  const { data: dbEntries } = await supabase
    .from('knowledge_base')
    .select('id, title, body, source, tags');

  const pool = dbEntries && dbEntries.length > 0
    ? (dbEntries as typeof knowledgeBase)
    : knowledgeBase;

  const scored = pool.map((entry) => ({ entry, score: scoreEntry(entry, query) }));
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

async function execFilterObjects(
  objectType: string,
  filtersRaw: string | undefined,
  limit: number,
): Promise<string> {
  const cap = Math.min(Math.max(limit, 1), 10);
  let filters: Record<string, unknown> = {};
  try {
    if (filtersRaw) filters = JSON.parse(filtersRaw) as Record<string, unknown>;
  } catch { /* ignore */ }

  if (objectType === 'requests') {
    let q = supabase
      .from('requests')
      .select('id, title, status, priority, value, is_overdue, days_in_stage, category')
      .order('is_overdue', { ascending: false })
      .order('days_in_stage', { ascending: false })
      .limit(cap);
    if (filters.is_overdue === true) q = q.eq('is_overdue', true);
    if (filters.status) q = q.eq('status', filters.status as string);
    if (filters.priority) q = q.eq('priority', filters.priority as string);
    if (filters.category) q = q.eq('category', filters.category as string);
    if (filters.requestor_id) q = q.eq('requestor_id', filters.requestor_id as string);
    const { data } = await q;
    return JSON.stringify({ found: !!data?.length, object_type: 'requests', count: data?.length ?? 0, items: data ?? [] });
  }

  if (objectType === 'suppliers') {
    let q = supabase
      .from('suppliers')
      .select('id, name, risk_rating, sra_status, country, tier, performance_score')
      .order('risk_rating', { ascending: false })
      .limit(cap);
    if (filters.risk_rating) q = q.eq('risk_rating', filters.risk_rating as string);
    if (filters.sra_status) q = q.eq('sra_status', filters.sra_status as string);
    const { data } = await q;
    return JSON.stringify({ found: !!data?.length, object_type: 'suppliers', count: data?.length ?? 0, items: data ?? [] });
  }

  if (objectType === 'contracts') {
    let q = supabase
      .from('contracts')
      .select('id, title, supplier_name, status, end_date, value, utilisation_percentage')
      .order('end_date', { ascending: true })
      .limit(cap);
    if (filters.status) q = q.eq('status', filters.status as string);
    const { data } = await q;
    return JSON.stringify({ found: !!data?.length, object_type: 'contracts', count: data?.length ?? 0, items: data ?? [] });
  }

  if (objectType === 'purchase_orders') {
    let q = supabase
      .from('purchase_orders')
      .select('id, supplier_name, value, status, delivery_date')
      .limit(cap);
    if (filters.status) q = q.eq('status', filters.status as string);
    const { data } = await q;
    return JSON.stringify({ found: !!data?.length, object_type: 'purchase_orders', count: data?.length ?? 0, items: data ?? [] });
  }

  if (objectType === 'invoices') {
    let q = supabase
      .from('invoices')
      .select('id, supplier_name, amount, status, due_date, match_status, match_variance')
      .order('due_date', { ascending: true })
      .limit(cap);
    if (filters.status) q = q.eq('status', filters.status as string);
    if (filters.match_status) q = q.eq('match_status', filters.match_status as string);
    const { data } = await q;
    return JSON.stringify({ found: !!data?.length, object_type: 'invoices', count: data?.length ?? 0, items: data ?? [] });
  }

  return JSON.stringify({ found: false, error: `Unknown object_type: ${objectType}` });
}

async function execRememberPreference(
  key: string,
  value: string,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle();

  const prefs = ((existing?.prefs as Record<string, unknown>) ?? {});
  prefs[key] = value;

  await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  return JSON.stringify({ remembered: true, key, value });
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

  const isSSE = req.headers['accept'] === 'text/event-stream';

  if (isSSE) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
  }

  function sendTurns(turns: unknown[]) {
    if (isSSE) {
      res.write(`data: ${JSON.stringify({ t: 'done', turns })}\n\n`);
      res.end();
    } else {
      res.status(200).json({ turns });
    }
  }

  function sendError(msg: string) {
    const turn = { type: 'chat-answer', content: msg };
    if (isSSE) {
      res.write(`data: ${JSON.stringify({ t: 'done', turns: [turn] })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ turns: [turn] });
    }
  }

  // Load session memory and inject into system prompt
  const userId = ctx?.currentUser?.id ?? '';
  let systemPrompt = SYSTEM_PROMPT;
  if (userId) {
    const { data: prefRow } = await supabase
      .from('user_preferences')
      .select('prefs')
      .eq('user_id', userId)
      .maybeSingle();
    if (prefRow?.prefs && Object.keys(prefRow.prefs as object).length > 0) {
      systemPrompt += `\n\nUser memory (remembered from previous sessions): ${JSON.stringify(prefRow.prefs)}. Use this context when relevant.`;
    }
  }

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...rawMessages.map((m) => ({ role: m.role as LLMMessage['role'], content: m.content })),
  ];

  let lookupType: string | null = null;
  let lookupIdentifier: string | null = null;
  let ticketCreated: string | null = null;
  let demandCategory: string | null = null;
  let demandValue: string | null = null;
  let demandSupplier: string | null = null;
  let hadToolCalls = false;

  const MAX_ITERATIONS = 5;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let result;
    try {
      result = await callLLMWithTools(llmMessages, TOOLS);
    } catch (e) {
      console.error('callLLMWithTools error:', e);
      // Groq tool-calling failed — fall back to plain LLM call (Groq → Gemini)
      try {
        const fallbackText = await callLLM({ messages: llmMessages, jsonMode: false });
        sendTurns([{ type: 'chat-answer', content: fallbackText ?? "I'm having trouble right now. Please try again." }]);
      } catch (e2) {
        console.error('LLM fallback also failed:', e2);
        sendError("I'm having trouble connecting to the AI service. Please try again in a moment.");
      }
      return;
    }

    llmMessages.push(result.assistantMessage as LLMMessage);

    if (result.finishReason === 'stop' || result.toolCalls.length === 0) {
      // Build structural (non-text) turns
      const structuralTurns: unknown[] = [];

      if (lookupType === 'supplier' && lookupIdentifier) {
        structuralTurns.push({
          type: 'deep-link',
          label: `Vendor 360 — ${lookupIdentifier}`,
          description: 'Full supplier profile, contracts, and risk history',
          path: `/suppliers/${lookupIdentifier.toUpperCase()}`,
        });
      } else if (lookupType === 'request' && lookupIdentifier) {
        structuralTurns.push({
          type: 'deep-link',
          label: `Request Detail — ${lookupIdentifier.toUpperCase()}`,
          description: 'Full request timeline, approvals, and documents',
          path: `/requests/${lookupIdentifier.toUpperCase()}`,
        });
      } else if (lookupType === 'contract' && lookupIdentifier) {
        structuralTurns.push({
          type: 'deep-link',
          label: `Contract Detail — ${lookupIdentifier.toUpperCase()}`,
          description: 'Full contract, amendments, and renewal history',
          path: `/contracts/${lookupIdentifier.toUpperCase()}`,
        });
      } else if (lookupType === 'po' && lookupIdentifier) {
        structuralTurns.push({
          type: 'deep-link',
          label: `Purchase Order — ${lookupIdentifier.toUpperCase()}`,
          description: 'PO lines, receipts, and invoice match status',
          path: `/purchasing/orders/${lookupIdentifier.toUpperCase()}`,
        });
      } else if (lookupType === 'invoice' && lookupIdentifier) {
        structuralTurns.push({
          type: 'deep-link',
          label: `Invoice — ${lookupIdentifier.toUpperCase()}`,
          description: 'Invoice detail, matching, and payment status',
          path: '/purchasing/invoices',
        });
      }

      if (ticketCreated) {
        structuralTurns.push({
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
        structuralTurns.push({
          type: 'deep-link',
          label: 'Start New Request',
          description: `Open the ${demandCategory} request wizard`,
          path: `/requests/new?${params.toString()}`,
        });
      }

      // SSE streaming: stream the final LLM response token-by-token when tools were called,
      // otherwise emit the already-fetched text as a single turn.
      if (isSSE && hadToolCalls) {
        try {
          // Pass TOOLS with tool_choice:'none' so the model writes plain text
          // instead of trying to emit more tool calls as raw JSON.
          await callLLMStreaming(llmMessages, (token) => {
            res.write(`data: ${JSON.stringify({ t: 'tok', c: token })}\n\n`);
          }, TOOLS);
        } catch (e) {
          console.error('callLLMStreaming error:', e);
        }
        res.write(`data: ${JSON.stringify({ t: 'done', turns: structuralTurns })}\n\n`);
        res.end();
        return;
      }

      // Non-streaming path (or SSE without prior tool calls)
      const text = result.content?.trim() ?? '';
      const allTurns: unknown[] = [];
      if (text) allTurns.push({ type: 'chat-answer', content: text });
      allTurns.push(...structuralTurns);

      if (allTurns.length === 0) {
        allTurns.push({ type: 'chat-answer', content: 'I could not find a grounded answer. Try rephrasing or asking for human help.' });
      }

      // For SSE without tool calls: emit single tok + done so client handles it uniformly
      if (isSSE) {
        if (text) res.write(`data: ${JSON.stringify({ t: 'tok', c: text })}\n\n`);
        res.write(`data: ${JSON.stringify({ t: 'done', turns: structuralTurns })}\n\n`);
        res.end();
        return;
      }

      sendTurns(allTurns);
      return;
    }

    // Execute tool calls
    hadToolCalls = true;
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

        sendTurns([{ type: 'confirm', readBack, actionType, actionParams: params, actionId }]);
        return;
      }

      if (toolName === 'search_knowledge') {
        toolResult = await execSearchKnowledge((args.query as string) ?? '');
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
      } else if (toolName === 'filter_objects') {
        toolResult = await execFilterObjects(
          (args.object_type as string) ?? '',
          args.filters as string | undefined,
          typeof args.limit === 'number' ? args.limit : 5,
        );
      } else if (toolName === 'remember_preference') {
        toolResult = await execRememberPreference(
          (args.key as string) ?? '',
          (args.value as string) ?? '',
          userId,
        );
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

  sendError('The assistant reached its iteration limit. Please try a simpler query.');
}
