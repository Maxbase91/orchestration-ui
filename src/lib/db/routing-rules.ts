import { db } from '@/lib/db-client';
import type { RoutingRule } from '@/data/types';
import { mapDbToRoutingRule, mapRoutingRuleToDb } from './mappers';

const TABLE = 'routing_rules';

export async function listRoutingRules(): Promise<RoutingRule[]> {
  const { data, error } = await db.from(TABLE).select('*').order('id');
  if (error) throw error;
  return (data ?? []).map(mapDbToRoutingRule);
}

export async function getRoutingRule(id: string): Promise<RoutingRule | null> {
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToRoutingRule(data) : null;
}

export async function saveRoutingRule(record: RoutingRule): Promise<RoutingRule> {
  const { data, error } = await db
    .from(TABLE)
    .upsert(mapRoutingRuleToDb(record), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToRoutingRule(data);
}

export async function deleteRoutingRule(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
