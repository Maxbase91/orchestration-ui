import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseQuery } from '../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  if (req.method === 'PATCH') {
    return handlePatch(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const { request_id } = req.query;
  if (!request_id || typeof request_id !== 'string') {
    return res.status(400).json({ error: 'Missing request_id query param' });
  }

  const { data, error } = await supabaseQuery(
    'ai_conversations',
    {
      filters: `request_id=eq.${request_id}`,
      order: 'created_at.desc',
    },
  );

  if (error) return res.status(500).json({ error });
  return res.status(200).json(data);
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const body = req.body;
  if (!body || !body.request_id) {
    return res.status(400).json({ error: 'Missing required field: request_id' });
  }

  const entry = {
    request_id: body.request_id,
    messages: body.messages ?? [],
    extracted_data: body.extracted_data ?? null,
    category: body.category ?? null,
    status: body.status ?? 'in-progress',
  };

  const { data, error } = await supabaseQuery(
    'ai_conversations',
    { method: 'POST', body: entry, single: true },
  );

  if (error) return res.status(500).json({ error });
  return res.status(201).json(data);
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing id query param' });
  }

  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'No update fields provided' });
  }

  const updates = { ...body, updated_at: new Date().toISOString() };

  const { data, error } = await supabaseQuery(
    'ai_conversations',
    {
      method: 'PATCH',
      filters: `id=eq.${id}`,
      body: updates,
      single: true,
    },
  );

  if (error) return res.status(500).json({ error });
  return res.status(200).json(data);
}
