import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLLM } from './_llm.js';
import { getAgent, isAgentActive } from './_ai-agents.js';
import { ServerConfigurationError, getDbAdmin } from './_db-admin.js';

const CLASSIFIER_AGENT_ID = 'AI-001';

// The categories come from configuration (Admin → Categories): id, label and
// description, in the configured order. This prompt used to carry its own
// category rules, a price list of catalogue items that matched nothing in the
// real catalogue ("A4 Paper €5, Pens €8…"), a catalogue limit of "€500" (the
// governed figure is €1,000) and a list of routes and supplier ids. The
// catalogue decision itself is made against real items (decideIntakeRoute), so
// the model only says whether a demand looks like a catalogue item.
interface PromptCategory { id: string; label: string; description: string }

/** A worked example for a seeded category — used only if that category is configured. */
const EXAMPLES: Array<[string, string]> = [
  ['design a target operating model and lead a digital transformation programme', 'consulting'],
  ['cleaning services for our Frankfurt office 3 days a week', 'services'],
  ['new laptops for engineering team', 'goods'],
  ['Salesforce CRM subscription 200 seats', 'software'],
  ['10 interim Java developers for 6 months', 'contingent-labour'],
  ['translation of product documentation into 5 languages', 'services'],
  ['conduct a cybersecurity maturity assessment', 'consulting'],
];

function systemPromptFor(categories: PromptCategory[]): string {
  const ids = categories.map((c) => c.id);
  const examples = EXAMPLES.filter(([, id]) => ids.includes(id));
  return `You classify procurement requests. Return ONLY JSON.

INTENTS:
- "catalogue": a standard item a catalogue would hold (office supplies, stationery, peripherals).
- "new-request": anything else to buy — services, consulting, software, custom or bulk goods.
- "navigation": the user wants to find or view existing data (suppliers, contracts, approvals, spend).
- "general": unclear what the user needs.

Buying is "catalogue" or "new-request", never "navigation".

CATEGORIES (answer with one of these ids):
${categories.map((c) => `- "${c.id}" (${c.label}): ${c.description}`).join('\n')}
${examples.length ? `\nEXAMPLES:\n${examples.map(([text, id]) => `Input: "${text}" → ${id}`).join('\n')}\n` : ''}
JSON format:
{"intent":"catalogue|new-request|navigation|general","message":"brief message","catalogueItems":[],"links":[],"category":"${ids.join('|')}","extractedTitle":"title","extractedSupplier":"supplier","extractedValue":0,"generatedDescription":"description"}

For new-request: include category, extractedTitle, extractedSupplier, extractedValue, generatedDescription.`;
}

async function configuredCategories(): Promise<PromptCategory[]> {
  try {
    const { data } = await getDbAdmin()
      .from('procurement_categories')
      .select('id, label, description, active, sort_order')
      .eq('active', true)
      .order('sort_order');
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id), label: String(r.label), description: String(r.description ?? ''),
    }));
  } catch {
    return [];
  }
}

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    // Load the classifier agent from the database so admins can toggle/tune it
    // without a code change. When the agent is disabled, return a stub
    // response instead of calling the LLM.
    const agent = await getAgent(CLASSIFIER_AGENT_ID);
    // The explicit null check comes first so the compiler knows `agent` is
    // present below; `isAgentActive` stays a plain boolean because the branch
    // it guards also has to describe a present-but-disabled agent.
    if (!agent || !isAgentActive(agent)) {
      return res.status(200).json({
        intent: 'general',
        message: agent
          ? `${agent.name} is currently ${agent.status}. Enable it in Admin → AI Agents to get smart classification.`
          : 'AI classifier is not configured. Enable AI-001 (Category Classifier) in Admin → AI Agents.',
        links: [{ label: 'Create New Request', path: '/requests/new' }],
        _agent: { id: agent?.id ?? CLASSIFIER_AGENT_ID, status: agent?.status ?? 'missing' },
      });
    }

    const categories = await configuredCategories();
    const systemPrompt = systemPromptFor(categories);
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
      id: agent.id,
      name: agent.name,
      status: agent.status,
    };
    return res.status(200).json(parsed);
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      console.error('AI handler configuration error:', error.message);
      return res.status(503).json({
        error: 'AI service is temporarily unavailable.',
        code: 'service_unavailable',
      });
    }
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI handler error:', msg);
    return res.status(502).json({
      error: 'AI service could not complete the request.',
      code: 'provider_failure',
    });
  }
}
