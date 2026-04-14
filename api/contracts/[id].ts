import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseQuery } from '../../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing contract id' });
  }

  const { data, error } = await supabaseQuery('contracts', {
    filters: `id=eq.${id}`,
    single: true,
  });

  if (error) return res.status(500).json({ error });
  if (!data) return res.status(404).json({ error: 'Contract not found' });
  return res.status(200).json(data);
}
