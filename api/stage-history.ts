import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseQuery } from '../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;
  if (!body || !body.request_id || !body.stage) {
    return res.status(400).json({ error: 'Missing required fields: request_id, stage' });
  }

  const entry = {
    request_id: body.request_id,
    stage: body.stage,
    entered_at: body.entered_at ?? new Date().toISOString(),
    completed_at: body.completed_at ?? null,
    owner_id: body.owner_id ?? null,
    action: body.action ?? null,
    notes: body.notes ?? null,
  };

  const { data, error } = await supabaseQuery(
    'stage_history',
    { method: 'POST', body: entry, single: true },
  );

  if (error) return res.status(500).json({ error });
  return res.status(201).json(data);
}
