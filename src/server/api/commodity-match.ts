// Server endpoint for specific commodity/service-family suggestions.
// Persisted routing still validates the confirmed code against current policy.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveCommodityCandidates } from '../../lib/procurement/commodity-candidates.js';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
  const body = req.body as { text?: unknown; category?: unknown };
  if (typeof body?.text !== 'string' || !body.text.trim()) { res.status(400).json({ error: 'text is required', code: 'validation_error' }); return; }
  if (body.text.length > 5000) { res.status(400).json({ error: 'text is too long', code: 'validation_error' }); return; }
  const category = typeof body.category === 'string' ? body.category : undefined;
  res.status(200).json({ candidates: resolveCommodityCandidates(body.text, category) });
}
