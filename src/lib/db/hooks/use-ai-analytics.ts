// TanStack Query hooks for the assistant analytics screen.
//
// `/admin/ai-analytics` read its data with a one-shot `useEffect` + `useState`
// fetch — `void (async () => { … })()` with no catch. Three consequences, all
// of them live:
//
//  * An unhandled rejection. Any read failure surfaced as an uncaught page
//    error, which is what `test:e2e-ui` reports on this route.
//  * `setLoading(false)` sat after the awaits, so a failure left the screen on
//    "Loading analytics…" for as long as it stayed open.
//  * No cache and no refetch: the data was as old as the moment the component
//    mounted, and navigating away and back re-read everything.
//
// Everything else in `src/lib/db` goes through hooks (see AGENTS.md). This is
// that page joining them.
import { useQuery } from '@tanstack/react-query';
import { listAllConversations } from '../assistant-conversations';
import { listChatFeedback } from '../chat-feedback';

const KEYS = {
  conversations: ['assistant-conversations', 'all'] as const,
  feedback: ['chat-feedback', 'list'] as const,
};

/**
 * Every assistant conversation.
 *
 * Deliberately unfiltered: the page needs both the 14-day window and the
 * all-time total, and a second query for a count would be a second read of the
 * same table to learn the length of a list it already has.
 */
export function useAllConversations() {
  return useQuery({ queryKey: KEYS.conversations, queryFn: listAllConversations });
}

export function useChatFeedback() {
  return useQuery({ queryKey: KEYS.feedback, queryFn: listChatFeedback });
}
