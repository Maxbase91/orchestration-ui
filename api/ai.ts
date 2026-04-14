import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLLM } from '../src/lib/llm.js';

const SYSTEM_PROMPT = `You classify procurement requests. Return ONLY JSON.

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

  try {
    const content = await callLLM({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      maxTokens: 1024,
    });

    const parsed = JSON.parse(content);
    return res.status(200).json(parsed);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI handler error:', msg);
    return res.status(502).json({ error: msg });
  }
}
