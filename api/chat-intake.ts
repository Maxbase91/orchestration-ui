import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a procurement intake assistant collecting details for a new procurement request. The user has already selected a category. Your job is to collect the remaining details through natural conversation — ONE question at a time.

Required fields to collect:
1. title — what they need (brief professional description)
2. supplier — preferred supplier name (can be "none" or "to be determined")
3. estimatedValue — estimated cost in EUR (as a number)
4. deliveryDate — when they need it (ISO date string or descriptive timeframe)
5. businessJustification — why they need it (business reason)
6. costCentre — which cost centre (options: CC-1001 Marketing, CC-2001 IT, CC-3001 Operations, CC-4001 Finance, CC-5001 HR)

Known suppliers in our directory: Accenture, SAP SE, Deloitte, KPMG, Capgemini, AWS (Amazon Web Services), Microsoft, Siemens, Bosch, WPP, Cushman & Wakefield, Sodexo, Randstad, Hays, Iron Mountain, Konica Minolta, TechBridge Solutions, GreenEnergy Corp.

Rules:
- Ask ONE question at a time. Be conversational, helpful, and brief.
- Extract any data the user has already provided in their answers.
- If the user mentions a value like "150k" or "about 200 thousand", convert to a number (150000, 200000).
- If the user mentions a timeframe like "next quarter" or "by March", estimate a reasonable ISO date.
- When title + estimatedValue + costCentre are filled, you may set complete to true. Supplier, deliveryDate, and justification are helpful but not blocking.
- Generate a professional title from the description if not explicitly stated.
- Keep your questions under 2 sentences. Sound human, not robotic.
- If the user gives multiple pieces of info in one answer, extract all of them and skip those questions.

Respond with ONLY a JSON object (no markdown, no backticks):
{
  "extracted": { "title": "...", "supplier": "...", "estimatedValue": 150000, "deliveryDate": "2025-06-01", "businessJustification": "...", "costCentre": "CC-2001", "isUrgent": false },
  "nextQuestion": "Your next conversational question",
  "complete": false,
  "summary": "Brief one-line summary of the request so far"
}

Only include fields in "extracted" that you have ACTUALLY extracted from this conversation turn — omit unknown fields entirely.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  const { messages, category, extractedSoFar } = req.body;

  const systemMessage = `${SYSTEM_PROMPT}\n\nRequest category: ${category}\nData collected so far: ${JSON.stringify(extractedSoFar ?? {})}`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemMessage }, ...(messages ?? [])],
        temperature: 0.4,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq chat-intake error:', response.status, err);
      return res.status(502).json({ error: 'LLM API error' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'Empty LLM response' });

    return res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error('Chat intake error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
