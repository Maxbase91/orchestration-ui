import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import {
  useCommentsMentioning,
  useReadCommentIds,
  useMarkCommentRead,
} from '@/lib/db/hooks/use-comments';
import { formatDate } from '@/lib/format';

export function WidgetMentions() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { data: mentions = [] } = useCommentsMentioning(currentUser.id);
  const { data: readIds = new Set<string>() } = useReadCommentIds(currentUser.id);
  const markRead = useMarkCommentRead();

  // Up to 5 most-recent mentions. Unread first, then most recent.
  const display = useMemo(() => {
    return [...mentions]
      .sort((a, b) => {
        const aRead = readIds.has(a.id);
        const bRead = readIds.has(b.id);
        if (aRead !== bRead) return aRead ? 1 : -1;
        return b.timestamp.localeCompare(a.timestamp);
      })
      .slice(0, 5);
  }, [mentions, readIds]);

  if (display.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No mentions — nobody has @{currentUser.id}’d you yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {display.map((c) => {
        const unread = !readIds.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              if (unread) {
                void markRead.mutate({ commentId: c.id, userId: currentUser.id });
              }
              navigate(`/requests/${c.requestId}#stage=${c.stage ?? 'overview'}`);
            }}
            className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="mt-0.5 relative">
              <div className="flex size-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-700">
                {c.authorInitials || c.authorName.slice(0, 2).toUpperCase()}
              </div>
              {unread && (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-blue-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">
                <span className={unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}>
                  {c.authorName}
                </span>
                {' · '}
                <span className="font-mono">{c.requestId}</span>
                {c.stage && (
                  <span className="ml-1 inline-flex items-center rounded bg-gray-100 px-1 py-0 text-[10px] text-gray-600">
                    {c.stage}
                  </span>
                )}
                {' · '}
                {formatDate(c.timestamp)}
              </p>
              <p className={`mt-0.5 truncate text-sm ${unread ? 'text-gray-900' : 'text-gray-600'}`}>
                <AtSign className="inline size-3 text-blue-500" /> {c.content}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
