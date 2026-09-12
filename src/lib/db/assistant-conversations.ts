// Data access for the `assistant_conversations` table — the AI assistant's
// per-user chat threads.
//
// This relation and `chat_feedback` were the only two in the /api/db allowlist
// with no module here, so three call sites (the conversation store, the
// analytics page, the message pane) each reached for the raw client and wrote
// their own queries. That is the second data path the project rule exists to
// prevent, in miniature: the store's update filtered on user_id, the title
// update did not, and nothing made that difference deliberate.
import { db } from '@/lib/db-client';
import type { ChatMessageData } from '@/data/types';

const TABLE = 'assistant_conversations';

export interface AssistantConversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessageData[];
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): AssistantConversation {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    messages: (row.messages as ChatMessageData[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** A user's threads, newest first. */
export async function listConversations(userId: string): Promise<AssistantConversation[]> {
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createConversation(userId: string): Promise<{ id: string; createdAt: string; updatedAt: string }> {
  const { data, error } = await db
    .from(TABLE)
    .insert({ user_id: userId, title: 'New conversation', messages: [] })
    .select('id, created_at, updated_at')
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

/**
 * Replace a thread's messages.
 *
 * Scoped by `user_id` as well as `id`: a thread belongs to one person, and
 * without authentication the id is the only thing standing between two users'
 * histories. Cheap, and it costs nothing to keep.
 */
export async function saveConversationMessages(
  conversationId: string,
  userId: string,
  messages: ChatMessageData[],
  updatedAt: string,
): Promise<void> {
  const { error } = await db
    .from(TABLE)
    .update({ messages, updated_at: updatedAt })
    .eq('id', conversationId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function renameConversation(conversationId: string, userId: string, title: string): Promise<void> {
  const { error } = await db.from(TABLE).update({ title }).eq('id', conversationId).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', conversationId).eq('user_id', userId);
  if (error) throw error;
}

/** Every thread, for the admin analytics view. */
export async function listAllConversations(): Promise<AssistantConversation[]> {
  const { data, error } = await db.from(TABLE).select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}
