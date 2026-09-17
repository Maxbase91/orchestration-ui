// Data access for the admin-managed knowledge base.
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
// footing as every other entity (see CLAUDE.md: `lib/db/<entity>.ts` plus
// `lib/db/hooks/use-<entity>.ts`).

import { db } from '../db-client.js';

export interface KBEntry {
  id: string;
  title: string;
  body: string;
  source: string;
  tags: string[];
}

export async function listKnowledgeBase(): Promise<KBEntry[]> {
  const { data, error } = await db
    .from('knowledge_base')
    .select('id, title, body, source, tags')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as KBEntry[];
}

/**
 * Upsert on `id`, so saving an edited entry whose id has not changed updates it
 * rather than failing on the primary key.
 */
export async function saveKnowledgeBaseEntry(entry: KBEntry): Promise<void> {
  const { error } = await db
    .from('knowledge_base')
    .upsert({ ...entry, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteKnowledgeBaseEntry(id: string): Promise<void> {
  const { error } = await db.from('knowledge_base').delete().eq('id', id);
  if (error) throw error;
}
