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
  const { status, category, owner_id } = req.query;

  const filterParts: string[] = [];
  if (status && typeof status === 'string') filterParts.push(`status=eq.${status}`);
  if (category && typeof category === 'string') filterParts.push(`category=eq.${category}`);
  if (owner_id && typeof owner_id === 'string') filterParts.push(`owner_id=eq.${owner_id}`);

  const { data, error } = await supabaseQuery(
    'requests',
    {
      filters: filterParts.length > 0 ? filterParts.join('&') : undefined,
      select: '*',
      order: 'created_at.desc',
    },
  );

  if (error) return res.status(500).json({ error });
  return res.status(200).json(data);
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const body = req.body;
  if (!body || !body.title || !body.category) {
    return res.status(400).json({ error: 'Missing required fields: title, category' });
  }

  const { data, error } = await supabaseQuery(
    'requests',
    {
      method: 'POST',
      body,
      single: true,
    },
  );

  if (error) return res.status(500).json({ error });
  return res.status(201).json(data);
}
