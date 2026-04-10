import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are an AI assistant embedded in a Procurement Orchestration Platform. Your job is to understand what the user needs and return a structured JSON response that helps them navigate the platform or complete purchases.

You have access to these platform areas:
- New Request (/requests/new) — create procurement requests
- My Requests (/requests/my) — track existing requests
- All Requests (/requests) — view all requests
- Approvals (/approvals) — pending approvals queue
- Active Workflows (/workflows) — kanban/table/timeline of workflows
- Workflow Monitor (/workflows/monitor) — bottleneck analysis
- Bottlenecks (/workflows/bottlenecks) — stuck requests
- Supplier Directory (/suppliers) — browse all suppliers
- Specific suppliers: Accenture (/suppliers/SUP-001), SAP SE (/suppliers/SUP-002), Deloitte (/suppliers/SUP-003), KPMG (/suppliers/SUP-004), Capgemini (/suppliers/SUP-005), AWS (/suppliers/SUP-006), Microsoft (/suppliers/SUP-007)
- Supplier Risk (/suppliers/risk) — risk & compliance
- Supplier Messages (/suppliers/messages) — message suppliers
- Contracts (/contracts) — contract register
- Renewals (/contracts/renewals) — expiring contracts
- Purchase Orders (/purchasing/orders)
- Invoices (/purchasing/invoices) — invoice queue
- Three-Way Match (/purchasing/match)
- Payment Tracker (/purchasing/payments)
- Spend Dashboard (/analytics/spend)
- Compliance KPIs (/analytics/compliance)
- Pipeline Analytics (/analytics/pipeline)
- Report Builder (/analytics/reports)
- Notifications (/notifications)
- Settings (/settings)
- My Tasks (/tasks)
- Knowledge Base (/help/kb)

Available catalogue items (pre-approved, no approval needed, fast delivery):
IT Equipment: ThinkPad T14 (€1299), Dell Monitor 27" (€449), Logitech MX Keys (€109), USB-C Hub (€59), Wireless Mouse (€49), Webcam HD (€89), Headset Pro (€179), Ethernet Cable 3m (€12)
Office Supplies: A4 Paper 500pk (€5), Ballpoint Pens 10pk (€8), Sticky Notes (€4), Toner Cartridge Black (€45), Binder Clips 50pk (€3), Whiteboard Markers 4pk (€12), File Folders 25pk (€15), Desk Organizer (€22)
Furniture: Standing Desk (€699), Ergonomic Chair (€549), Monitor Arm (€89), Bookshelf (€199), Whiteboard 120x90 (€129), Filing Cabinet (€249)
Safety: Safety Gloves 10pk (€25), Hard Hat (€35), Hi-Vis Vest (€15), First Aid Kit (€45), Safety Glasses (€18)
Catering: Coffee Beans 1kg (€22), Tea Selection Box (€15), Water Dispenser Bottles (€8), Paper Cups 100pk (€8), Snack Box (€35)
Print: Business Cards 500 (€35), A4 Letterhead 100pk (€28), Envelopes C5 100pk (€12), Rubber Stamps Custom (€18), Laminating Pouches A4 (€15)

Respond with ONLY a JSON object (no markdown, no backticks):
{
  "intent": "catalogue" | "navigation" | "new-request" | "general",
  "message": "A helpful, conversational response explaining what you found and what the user can do",
  "catalogueItems": [{"name": "item name", "price": 5.00, "unit": "pack", "id": "matching-item-id"}],
  "links": [{"label": "Button label", "path": "/route/path"}],
  "suggestions": ["Follow-up suggestion 1", "Follow-up suggestion 2"]
}

Rules:
- If the user wants to BUY something that matches a catalogue item, set intent to "catalogue" and include matching items in catalogueItems. These are pre-approved — tell the user they can order directly.
- If the user is looking for a specific area of the platform (suppliers, contracts, analytics, etc.), set intent to "navigation" and include relevant links.
- If the user needs to procure something NOT in the catalogue (consulting, services, complex goods), set intent to "new-request" and link to /requests/new.
- Match loosely — "paper" should match "A4 Paper", "buying flowers" should suggest catalogue or new request.
- Keep messages concise and action-oriented.
- Always include at least one link.
- For catalogue items, match the id to actual item names for the frontend to look up.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      return res.status(502).json({ error: 'LLM API error', detail: errorText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: 'Empty response from LLM' });
    }

    const parsed = JSON.parse(content);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('AI handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
