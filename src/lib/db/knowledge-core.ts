// Reading what the knowledge base links to, with a caller-supplied client.
//
// Same shape as policy-core.ts: the browser passes the /api/db singleton and
// api/chat.ts its privileged client, so a policy answer renders the same
// figures whichever side composes it. Relative '.js' specifiers only — Vercel
// cannot resolve the '@/' alias at runtime.
import type { NeonCompatibleClient, DbRow } from '../neon-compatible-client.js';
import { loadPolicyConfigWith } from './policy-core.js';
import type { KnowledgeContext, KnowledgeChain } from '../procurement/knowledge-links.js';

async function rows(client: NeonCompatibleClient, table: string, columns: string): Promise<DbRow[]> {
  // One unreadable table must not cost the whole answer: its tokens then
  // render as "none", which the answer states, rather than the question failing.
  try {
    const { data } = await client.from(table).select(columns);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

export async function loadKnowledgeContextWith(client: NeonCompatibleClient): Promise<KnowledgeContext> {
  const [policy, chains, preferred, suppliers, categories] = await Promise.all([
    loadPolicyConfigWith(client),
    rows(client, 'approval_chains', 'id, name, min_value, max_value, steps'),
    rows(client, 'category_preferred_suppliers', 'category_id, supplier_id'),
    rows(client, 'suppliers', 'id, name'),
    rows(client, 'procurement_categories', 'id, label'),
  ]);

  const supplierName = new Map(suppliers.map((s) => [String(s.id), String(s.name)]));
  const preferredSuppliers: Record<string, string[]> = {};
  for (const row of preferred) {
    const category = String(row.category_id);
    const name = supplierName.get(String(row.supplier_id));
    if (!name) continue;
    (preferredSuppliers[category] ??= []).push(name);
  }
  for (const names of Object.values(preferredSuppliers)) names.sort((a, b) => a.localeCompare(b));

  const approvalChains: KnowledgeChain[] = chains.map((c) => ({
    id: String(c.id),
    name: String(c.name),
    minValue: (c.min_value as string | null) ?? null,
    maxValue: (c.max_value as string | null) ?? null,
    steps: Array.isArray(c.steps) ? (c.steps as Array<{ role?: unknown }>).map((s) => ({ role: String(s.role ?? '') })) : [],
  }));

  return {
    policy,
    approvalChains,
    preferredSuppliers,
    categoryLabels: Object.fromEntries(categories.map((c) => [String(c.id), String(c.label)])),
  };
}
