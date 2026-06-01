import { supabase } from '@/lib/supabase-client';

export interface SlaTarget {
  stage: string;
  channel: string;
  days: number;
}

const TABLE = 'sla_targets';

export async function listSlaTargets(): Promise<SlaTarget[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('stage');
  if (error) throw error;
  return (data ?? []) as SlaTarget[];
}

export async function upsertSlaTarget(target: SlaTarget): Promise<SlaTarget> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(target, { onConflict: 'stage,channel' })
    .select('*')
    .single();
  if (error) throw error;
  return data as SlaTarget;
}

/** Returns SLA days for a given stage (falls back to 5). */
export function resolveSla(targets: SlaTarget[], stage: string, channel = 'default'): number {
  return (
    targets.find((t) => t.stage === stage && t.channel === channel)?.days ??
    targets.find((t) => t.stage === stage && t.channel === 'default')?.days ??
    5
  );
}
