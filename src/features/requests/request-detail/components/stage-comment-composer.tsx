import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Send, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddComment } from '@/lib/db/hooks/use-comments';
import { useUsers } from '@/lib/db/hooks/use-users';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import type { User } from '@/data/types';

interface StageCommentComposerProps {
  requestId: string;
  stage: string;
  stageLabel: string;
}

// Returns the text segment after the last '@' if the caret is still on
// that word (no whitespace after the '@'). Returns null otherwise.
function getActiveMentionQuery(text: string, caret: number): { token: string; start: number } | null {
  if (caret <= 0) return null;
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '@') return { token: text.slice(i + 1, caret), start: i };
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

function handleToUserId(users: User[], handle: string): string | null {
  const q = handle.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!q) return null;
  const byId = users.find((u) => u.id.toLowerCase() === q);
  if (byId) return byId.id;
  const byName = users.find((u) =>
    u.name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(q),
  );
  if (byName) return byName.id;
  return null;
}

/**
 * Extract @handles from committed comment text and resolve to user IDs.
 * Conservative: each @token must match a user's id prefix or name prefix;
 * unresolved @tokens are ignored (they stay in the text as plain text).
 */
function extractMentions(text: string, users: User[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const regex = /@([a-zA-Z0-9._-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const id = handleToUserId(users, m[1]);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function StageCommentComposer({ requestId, stage, stageLabel }: StageCommentComposerProps) {
  const { data: users = [] } = useUsers();
  const currentUser = useAuthStore((s) => s.currentUser);
  const addComment = useAddComment();
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const suggestions = useMemo(() => {
    if (!showMentionPicker) return [];
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.id !== currentUser.id)
      .filter((u) =>
        q === ''
          ? true
          : u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [showMentionPicker, mentionQuery, users, currentUser.id]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [mentionQuery]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      const caret = e.target.selectionStart;
      const active = getActiveMentionQuery(value, caret);
      if (active) {
        setShowMentionPicker(true);
        setMentionQuery(active.token);
        setMentionStart(active.start);
      } else {
        setShowMentionPicker(false);
      }
    },
    [],
  );

  const insertMention = useCallback(
    (user: User) => {
      const before = content.slice(0, mentionStart);
      const after = content.slice(mentionStart + 1 + mentionQuery.length);
      const handle = `@${user.id}`;
      const next = `${before}${handle} ${after}`;
      setContent(next);
      setShowMentionPicker(false);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const pos = (before + handle + ' ').length;
        textareaRef.current?.setSelectionRange(pos, pos);
      });
    },
    [content, mentionStart, mentionQuery],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showMentionPicker && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertMention(suggestions[highlightIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowMentionPicker(false);
          return;
        }
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void submit();
      }
    },
    [showMentionPicker, suggestions, highlightIndex, insertMention], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function submit() {
    const text = content.trim();
    if (!text) return;
    const mentions = extractMentions(text, users);
    try {
      await addComment.mutateAsync({
        requestId,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorInitials: currentUser.initials,
        content: text,
        isInternal,
        stage,
        mentions,
      });
      setContent('');
      if (mentions.length > 0) {
        toast.success(`Comment posted on ${stageLabel} · @mentioned ${mentions.length}`);
      } else {
        toast.success(`Comment posted on ${stageLabel}`);
      }
    } catch (err) {
      toast.error(`Post failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <div className="relative rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-start gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700">
          {currentUser.initials || currentUser.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={`Comment on the ${stageLabel.toLowerCase()} step — type @ to mention someone…`}
            className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows={2}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="flex items-center gap-1 text-[11px] text-gray-500">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="size-3"
              />
              Internal only
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                <AtSign className="inline size-3" /> to mention · ⌘+Enter to send
              </span>
              <Button size="sm" onClick={submit} disabled={!content.trim() || addComment.isPending}>
                <Send className="size-3.5" />
                {addComment.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mention picker — absolute, positioned above the textarea */}
      {showMentionPicker && suggestions.length > 0 && (
        <div className="absolute bottom-14 left-12 z-10 w-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md">
          <ul className="max-h-48 overflow-y-auto py-1">
            {suggestions.map((u, i) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === highlightIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-800 hover:bg-gray-50'}`}
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-700">
                    {u.initials || u.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">
                    {u.name}
                    <span className="ml-1 text-[11px] text-gray-400">@{u.id}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
