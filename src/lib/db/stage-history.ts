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
