import { supabase } from '@/lib/supabase-client';
import type { StageHistoryEntry } from '@/data/types';
import { mapDbToStageHistory } from './mappers';

const TABLE = 'stage_history';

export async function listStageHistory(): Promise<StageHistoryEntry[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('entered_at');
  if (error) throw error;
  return (data ?? []).map(mapDbToStageHistory);
}

export async function listStageHistoryByRequest(requestId: string): Promise<StageHistoryEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId)
    .order('entered_at');
  if (error) throw error;
  return (data ?? []).map(mapDbToStageHistory);
}

/**
 * Insert a stage_history row without transitioning the request's status.
 * Used for non-transitional events like escalations that should show up
 * on the stage's timeline but not change the lifecycle position.
 */
export async function appendStageHistoryEvent(entry: {
  requestId: string;
  stage: string;
  action: string;
  notes?: string;
  ownerId?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from(TABLE).insert({
    request_id: entry.requestId,
    stage: entry.stage,
    entered_at: now,
    completed_at: now, // event, not a stage transition
    owner_id: entry.ownerId ?? null,
    action: entry.action,
    notes: entry.notes ?? null,
  });
  if (error) throw error;
}
