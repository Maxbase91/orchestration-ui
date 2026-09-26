// Reading the routing rules with a given client, so the browser and submit's
// second decision evaluate the same rules in the same order. routing-rules.ts
// reads through here. Relative '.js' specifiers only: api/ imports this.
import type { NeonCompatibleClient } from '../neon-compatible-client.js';
import type { RoutingRule } from '../../data/types.js';
import { mapDbToRoutingRule } from './mappers.js';

// Priority, then id: the evaluator takes the first rule that matches, so the
// order is part of the decision.
export async function listRoutingRulesWith(client: NeonCompatibleClient): Promise<RoutingRule[]> {
  const { data, error } = await client.from('routing_rules').select('*').order('priority').order('id');
  if (error) throw error;
  return (data ?? []).map(mapDbToRoutingRule);
}
