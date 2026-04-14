import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseQuery } from '../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { risk_rating, sra_status } = req.query;

  const filterParts: string[] = [];
  if (risk_rating && typeof risk_rating === 'string') filterParts.push(`risk_rating=eq.${risk_rating}`);
  if (sra_status && typeof sra_status === 'string') filterParts.push(`sra_status=eq.${sra_status}`);

  const { data, error } = await supabaseQuery('suppliers', {
    filters: filterParts.length > 0 ? filterParts.join('&') : undefined,
    select: '*',
    order: 'name.asc',
  });

  if (error) return res.status(500).json({ error });
  return res.status(200).json(data);
}
