import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseQuery } from '../../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing request id' });
  }

  if (req.method === 'GET') {
    return handleGet(id, res);
  }
  if (req.method === 'PATCH') {
    return handlePatch(id, req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(id: string, res: VercelResponse) {
  // Fetch request
  const { data: request, error: reqError } = await supabaseQuery(
    'requests',
    { filters: `id=eq.${id}`, single: true },
  );

  if (reqError) return res.status(500).json({ error: reqError });
  if (!request) return res.status(404).json({ error: 'Request not found' });

  // Fetch related data in parallel
  const [stageRes, sowRes, commentsRes, approvalsRes] = await Promise.all([
    supabaseQuery('stage_history', {
      filters: `request_id=eq.${id}`,
      order: 'entered_at.asc',
    }),
    supabaseQuery('service_descriptions', {
      filters: `request_id=eq.${id}`,
      single: true,
    }),
    supabaseQuery('comments', {
      filters: `request_id=eq.${id}`,
      order: 'created_at.asc',
    }),
    supabaseQuery('approval_entries', {
      filters: `request_id=eq.${id}`,
      order: 'requested_at.asc',
    }),
  ]);

  return res.status(200).json({
    ...request as Record<string, unknown>,
    stage_history: stageRes.data ?? [],
    service_description: sowRes.data ?? null,
    comments: commentsRes.data ?? [],
    approval_entries: approvalsRes.data ?? [],
  });
}

async function handlePatch(id: string, req: VercelRequest, res: VercelResponse) {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'No update fields provided' });
  }

  // Check if status is changing — if so, add stage_history entry
  const statusChanged = body.status !== undefined;
  let oldStatus: string | null = null;

  if (statusChanged) {
    const { data: existing } = await supabaseQuery<{ status: string }>(
      'requests',
      { filters: `id=eq.${id}`, single: true, select: 'status' },
    );
    if (existing) {
      oldStatus = existing.status;
    }
  }

  // Update request
  const updates = { ...body, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseQuery(
    'requests',
    {
      method: 'PATCH',
      filters: `id=eq.${id}`,
      body: updates,
      single: true,
    },
  );

  if (error) return res.status(500).json({ error });

  // Add stage_history entry if status changed
  if (statusChanged && oldStatus && oldStatus !== body.status) {
    // Complete the previous stage
    await supabaseQuery('stage_history', {
      method: 'PATCH',
      filters: `request_id=eq.${id}&stage=eq.${oldStatus}&completed_at=is.null`,
      body: { completed_at: new Date().toISOString() },
    });

    // Add new stage entry
    await supabaseQuery('stage_history', {
      method: 'POST',
      body: {
        request_id: id,
        stage: body.status,
        entered_at: new Date().toISOString(),
        owner_id: body.owner_id ?? null,
        action: body.action ?? null,
        notes: body.notes ?? null,
      },
    });
  }

  return res.status(200).json(data);
}
