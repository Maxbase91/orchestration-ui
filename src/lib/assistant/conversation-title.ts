// What an assistant conversation is called in the history lists: the question
// that started it. Every thread read "New conversation" — the title was set
// only when the conversation already existed before the first message, and
// the first message is what creates it.

/** The title a conversation carries until its first message names it. */
export const NEW_CONVERSATION_TITLE = 'New conversation';

const MAX = 60;

/** The first line of the opening message, cut at a word near 60 characters. */
export function conversationTitle(firstMessage: string): string {
  const line = firstMessage.trim().split('\n')[0].replace(/\s+/g, ' ');
  if (!line) return NEW_CONVERSATION_TITLE;
  if (line.length <= MAX) return line;
  const cut = line.slice(0, MAX);
  const space = cut.lastIndexOf(' ');
  return `${(space > MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}
