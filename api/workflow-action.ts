import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseQuery } from '../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { requestId, action, newStatus, ownerId, notes } = req.body ?? {};

  if (!requestId || !action || !newStatus) {
    return res.status(400).json({ error: 'Missing required fields: requestId, action, newStatus' });
  }

  // Get current request to find old status
  const { data: existing, error: fetchError } = await supabaseQuery<{ status: string; owner_id: string; refer_back_count: number }>(
    'requests',
    { filters: `id=eq.${requestId}`, single: true, select: 'status,owner_id,refer_back_count' },
  );

  if (fetchError) return res.status(500).json({ error: fetchError });
  if (!existing) return res.status(404).json({ error: 'Request not found' });

  const oldStatus = existing.status;

  // Update request status
  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    days_in_stage: 0,
  };
  if (ownerId) updates.owner_id = ownerId;
  if (action === 'referred-back') {
    updates.refer_back_count = (existing.refer_back_count ?? 0) + 1;
  }

  const { data: updated, error: updateError } = await supabaseQuery(
    'requests',
    {
      method: 'PATCH',
      filters: `id=eq.${requestId}`,
      body: updates,
      single: true,
    },
  );

  if (updateError) return res.status(500).json({ error: updateError });

  // Complete previous stage_history entry
  if (oldStatus !== newStatus) {
    await supabaseQuery('stage_history', {
      method: 'PATCH',
      filters: `request_id=eq.${requestId}&stage=eq.${oldStatus}&completed_at=is.null`,
      body: { completed_at: new Date().toISOString() },
    });

    // Add new stage_history entry
    await supabaseQuery('stage_history', {
      method: 'POST',
      body: {
        request_id: requestId,
        stage: newStatus,
        entered_at: new Date().toISOString(),
        owner_id: ownerId ?? existing.owner_id ?? null,
        action,
        notes: notes ?? null,
      },
    });
  }

  return res.status(200).json(updated);
}
