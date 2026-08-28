// Data access for the admin-managed knowledge base.
//
// Entries here override and supplement the built-in KB and are the first thing
// the assistant's retrieval consults. The admin screen used to talk to Supabase
// directly through a hand-rolled `useEffect` + `useState` fetch; this module and
// its hooks put it on the same footing as every other entity (see CLAUDE.md:
// `lib/db/<entity>.ts` plus `lib/db/hooks/use-<entity>.ts`).

import { supabase } from '@/lib/supabase-client';

export interface KBEntry {
  id: string;
  title: string;
  body: string;
  source: string;
  tags: string[];
}

export async function listKnowledgeBase(): Promise<KBEntry[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, title, body, source, tags')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as KBEntry[];
}

/**
 * Upsert on `id`, so saving an edited entry whose id has not changed updates it
 * rather than failing on the primary key.
 */
export async function saveKnowledgeBaseEntry(entry: KBEntry): Promise<void> {
  const { error } = await supabase
    .from('knowledge_base')
    .upsert({ ...entry, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteKnowledgeBaseEntry(id: string): Promise<void> {
  const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
  if (error) throw error;
}
