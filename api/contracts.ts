import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseQuery } from '../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, status, supplier_id } = req.query;

  // Single contract by ID
  if (id && typeof id === 'string') {
    const { data, error } = await supabaseQuery('contracts', {
      filters: `id=eq.${id}`,
      single: true,
    });
    if (error) return res.status(500).json({ error });
    if (!data) return res.status(404).json({ error: 'Contract not found' });
    return res.status(200).json(data);
  }

  // List with optional filters
  const filterParts: string[] = [];
  if (status && typeof status === 'string') filterParts.push(`status=eq.${status}`);
  if (supplier_id && typeof supplier_id === 'string') filterParts.push(`supplier_id=eq.${supplier_id}`);

  const { data, error } = await supabaseQuery('contracts', {
    filters: filterParts.length > 0 ? filterParts.join('&') : undefined,
    select: '*',
    order: 'created_at.desc',
  });

  if (error) return res.status(500).json({ error });
  return res.status(200).json(data);
}
