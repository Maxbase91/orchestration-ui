import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseQuery } from '../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const { request_id } = req.query;
  if (!request_id || typeof request_id !== 'string') {
    return res.status(400).json({ error: 'Missing request_id query param' });
  }

  const { data, error } = await supabaseQuery(
    'comments',
    {
      filters: `request_id=eq.${request_id}`,
      order: 'created_at.asc',
    },
  );

  if (error) return res.status(500).json({ error });
  return res.status(200).json(data);
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const body = req.body;
  if (!body || !body.request_id || !body.content) {
    return res.status(400).json({ error: 'Missing required fields: request_id, content' });
  }

  const entry = {
    request_id: body.request_id,
    author_id: body.author_id ?? null,
    author_name: body.author_name,
    content: body.content,
    is_internal: body.is_internal ?? false,
  };

  const { data, error } = await supabaseQuery(
    'comments',
    { method: 'POST', body: entry, single: true },
  );

  if (error) return res.status(500).json({ error });
  return res.status(201).json(data);
}
