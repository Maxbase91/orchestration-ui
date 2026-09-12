// Data access for the `chat_feedback` table — thumbs up/down on an assistant
// answer, written by the message pane and read by the AI analytics page.
//
// Split out of those two components, which each reached for the raw client.
// See assistant-conversations.ts for why these two relations needed modules.
//
// The table records only which message was rated and how: there is no user or
// conversation column, so feedback cannot be attributed or grouped by thread.
// That is the table's shape, not an omission here — worth knowing before the
// analytics page is asked for anything per-user.
import { db } from '@/lib/db-client';

const TABLE = 'chat_feedback';

export type FeedbackPolarity = 'up' | 'down';

export interface ChatFeedback {
  id: string;
  messageId: string;
  polarity: FeedbackPolarity;
  createdAt: string;
}

export async function recordChatFeedback(messageId: string, polarity: FeedbackPolarity): Promise<void> {
  // `created_at` defaults to now() in the schema; sending it from the browser
  // recorded the client's clock instead of the database's.
  const { error } = await db.from(TABLE).insert({ message_id: messageId, polarity });
  if (error) throw error;
}

export async function listChatFeedback(): Promise<ChatFeedback[]> {
  const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    messageId: row.message_id as string,
    polarity: row.polarity as FeedbackPolarity,
    createdAt: row.created_at as string,
  }));
}
