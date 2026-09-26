// Data access for the admin-managed knowledge base — what the assistant, the
// Home box and the Help pages answer from.
//
// Entries here REPLACE the built-in KB — not merge with it, so an entry an admin
// deleted stops answering — and they are what the assistant's retrieval ranks
// over, in the browser (`capabilities/knowledge.ts`) and on the server
// (`api/chat.ts`) alike. That was already this comment's claim and was true of
// neither: the browser ranked the built-in fixture and nothing read this table,
// while mock was both the default provider and the fallback on every failure,
// so an admin's edit was invisible in the normal configuration.
//
// The admin screen used to talk to the database directly through a hand-rolled
// `useEffect` + `useState` fetch; this module and its hooks put it on the same
// footing as every other entity (see AGENTS.md: `lib/db/<entity>.ts` plus
// `lib/db/hooks/use-<entity>.ts`).

import { db } from '../db-client.js';
import type { KnowledgeEntry } from '../../data/types.js';

/** One type for an entry, stored or built in — this was a second copy of it. */
export type KBEntry = KnowledgeEntry;

function mapRow(row: Record<string, unknown>): KBEntry {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    source: String(row.source ?? ''),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    topic: String(row.topic ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/** In reading order: the Help page groups by topic in this order. */
export async function listKnowledgeBase(): Promise<KBEntry[]> {
  const { data, error } = await db
    .from('knowledge_base')
    .select('id, title, body, source, tags, topic, sort_order')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Upsert on `id`, so saving an edited entry whose id has not changed updates it
 * rather than failing on the primary key.
 */
export async function saveKnowledgeBaseEntry(entry: KBEntry): Promise<void> {
  const { sortOrder, ...rest } = entry;
  const { error } = await db
    .from('knowledge_base')
    .upsert({ ...rest, sort_order: sortOrder, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteKnowledgeBaseEntry(id: string): Promise<void> {
  const { error } = await db.from('knowledge_base').delete().eq('id', id);
  if (error) throw error;
}
