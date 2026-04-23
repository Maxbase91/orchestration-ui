import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLLM } from '../src/lib/llm.js';
import { getAgent, isAgentActive } from './_ai-agents.js';

const CLASSIFIER_AGENT_ID = 'AI-001';

const BASE_SYSTEM_PROMPT = `You classify procurement requests. Return ONLY JSON.

INTENTS:
- "catalogue": standard office items (paper, pens, toner, cables, headsets, mice, keyboards). Items under €500.
- "new-request": consulting, services, software, custom goods, bulk orders, professional services.
- "navigation": user wants to FIND/VIEW existing data (suppliers, contracts, approvals, spend).
- "general": unclear what user needs.

CRITICAL: buying/purchasing = "catalogue" or "new-request", NEVER "navigation".
"buy consulting" = new-request. "buy paper" = catalogue. "find Accenture" = navigation.

Routes: /requests/new, /requests/my, /requests, /approvals, /workflows, /suppliers, /suppliers/SUP-001 (Accenture), /suppliers/SUP-002 (SAP), /suppliers/SUP-003 (Deloitte), /contracts, /purchasing/invoices, /analytics/spend, /tasks, /help/kb

Catalogue items: A4 Paper €5, Pens €8, Sticky Notes €4, Toner €45, Markers €12, Folders €15, USB Hub €59, Mouse €49, Headset €179, Monitor Arm €89, Coffee €22, Safety Gloves €25

JSON format:
{"intent":"catalogue|new-request|navigation|general","message":"brief message","catalogueItems":[{"name":"A4 Paper 500pk","price":5,"unit":"pack","id":"paper-1"}],"links":[{"label":"label","path":"/path"}],"category":"consulting|services|software|goods|contingent-labour","extractedTitle":"title","extractedSupplier":"supplier","extractedValue":0,"generatedDescription":"description"}

For new-request: include category, extractedTitle, extractedSupplier, extractedValue, generatedDescription.
For catalogue: include matching catalogueItems.
For navigation: include relevant links.
links[0] must be the primary action.`;

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  // Load the classifier agent from Supabase so admins can toggle/tune it
  // without a code change. When the agent is disabled, return a stub
  // response instead of calling the LLM.
  const agent = await getAgent(CLASSIFIER_AGENT_ID);
  if (!isAgentActive(agent)) {
    return res.status(200).json({
      intent: 'general',
      message: agent
        ? `${agent.name} is currently ${agent.status}. Enable it in Admin → AI Agents to get smart classification.`
        : 'AI classifier is not configured. Enable AI-001 (Category Classifier) in Admin → AI Agents.',
      links: [{ label: 'Create New Request', path: '/requests/new' }],
      _agent: { id: agent?.id ?? CLASSIFIER_AGENT_ID, status: agent?.status ?? 'missing' },
    });
  }

  // Augment the system prompt with the admin-editable agent description so
  // tweaking the description in the UI influences classifier behaviour.
  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## AGENT CONTEXT (admin-configured)\n${agent!.description}`;

  try {
    const content = await callLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      maxTokens: 1024,
    });

    const parsed = JSON.parse(content);
    parsed._agent = {
      id: agent!.id,
      name: agent!.name,
      status: agent!.status,
      accuracy: agent!.accuracy,
    };
    return res.status(200).json(parsed);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI handler error:', msg);
    return res.status(502).json({ error: msg });
  }
}
