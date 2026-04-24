import { useMemo, useState } from 'react';
import type { ProcurementRequest } from '@/data/types';
import { useStageHistoryByRequest } from '@/lib/db/hooks/use-stage-history';
import { useCommentsByRequest } from '@/lib/db/hooks/use-comments';
import { useAuditEntries } from '@/lib/db/hooks/use-audit-entries';
import { useNotifications } from '@/lib/db/hooks/use-notifications';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, GitBranch, ShieldCheck, Bell, AtSign } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';

type ActivityKind = 'comment' | 'stage' | 'audit' | 'notification';

interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  timestamp: string;
  actor?: string;
  title: string;
  detail?: string;
  stage?: string;
  mentionsMe?: boolean;
}

interface TabActivityProps {
  request: ProcurementRequest;
}

const KIND_CONFIG: Record<ActivityKind, { label: string; icon: typeof MessageSquare; color: string }> = {
  comment:      { label: 'Comment',      icon: MessageSquare, color: 'text-blue-600' },
  stage:        { label: 'Stage event',  icon: GitBranch,     color: 'text-emerald-600' },
  audit:        { label: 'Audit',        icon: ShieldCheck,   color: 'text-gray-500' },
  notification: { label: 'Notification', icon: Bell,          color: 'text-amber-600' },
};

type Filter = 'all' | 'comments' | 'events' | 'mine';

export function TabActivity({ request }: TabActivityProps) {
  useUsers();
  const lookupUser = useUserLookup();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { data: history = [] } = useStageHistoryByRequest(request.id);
  const { data: comments = [] } = useCommentsByRequest(request.id);
  const { data: auditEntries = [] } = useAuditEntries();
  const { data: notifications = [] } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');

  const entries: ActivityEntry[] = useMemo(() => {
    const out: ActivityEntry[] = [];

    for (const c of comments) {
      out.push({
        id: `comment-${c.id}`,
        kind: 'comment',
        timestamp: c.timestamp,
        actor: c.authorName,
        title: c.content,
        stage: c.stage,
        mentionsMe: c.mentions?.includes(currentUser.id) ?? false,
      });
    }

    for (const h of history) {
      const user = lookupUser(h.ownerId);
      out.push({
        id: `stage-${h.requestId}-${h.stage}-${h.enteredAt}`,
        kind: 'stage',
        timestamp: h.enteredAt,
        actor: user?.name,
        title: `${getStatusLabel(h.action ?? h.stage)} — ${getStatusLabel(h.stage)}`,
        detail: h.notes ?? undefined,
        stage: h.stage,
      });
    }

    for (const a of auditEntries) {
      if (a.requestId !== request.id) continue;
      out.push({
        id: `audit-${a.id}`,
        kind: 'audit',
        timestamp: a.timestamp,
        actor: a.userName,
        title: `${a.action} · ${a.objectType} ${a.objectId}`,
        detail: a.detail,
      });
    }

    for (const n of notifications) {
      if (n.relatedId !== request.id) continue;
      out.push({
        id: `notif-${n.id}`,
        kind: 'notification',
        timestamp: n.timestamp,
        title: n.title,
        detail: n.description,
      });
    }

    return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [comments, history, auditEntries, notifications, request.id, currentUser.id, lookupUser]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'comments':
        return entries.filter((e) => e.kind === 'comment');
      case 'events':
        return entries.filter((e) => e.kind !== 'comment');
      case 'mine':
        return entries.filter(
          (e) =>
            e.actor === currentUser.name ||
            e.mentionsMe ||
            (e.kind === 'audit' && e.actor === currentUser.name),
        );
      default:
        return entries;
    }
  }, [entries, filter, currentUser.name]);

  const filterChips: { id: Filter; label: string; count: number }[] = [
    { id: 'all',      label: 'All',        count: entries.length },
    { id: 'comments', label: 'Comments',   count: entries.filter((e) => e.kind === 'comment').length },
    { id: 'events',   label: 'Events',     count: entries.filter((e) => e.kind !== 'comment').length },
    { id: 'mine',     label: 'My actions', count: entries.filter((e) => e.actor === currentUser.name || e.mentionsMe).length },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Activity ({filtered.length})</CardTitle>
          <div className="flex items-center gap-1">
            {filterChips.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  filter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label} · {f.count}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity for this filter yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {filtered.map((e) => {
              const cfg = KIND_CONFIG[e.kind];
              const Icon = cfg.icon;
              return (
                <li key={e.id} className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-0">
                  <div className={`mt-0.5 ${cfg.color}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{cfg.label}</span>
                      {e.stage && (
                        <Badge variant="outline" className="text-[10px]">{getStatusLabel(e.stage)}</Badge>
                      )}
                      {e.mentionsMe && (
                        <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700 text-[10px]">
                          <AtSign className="size-3" /> mentioned you
                        </Badge>
                      )}
                      {e.actor && <span className="text-xs text-gray-600">{e.actor}</span>}
                      <span className="text-[11px] text-gray-400 ml-auto">{formatDate(e.timestamp)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{e.title}</p>
                    {e.detail && e.detail !== e.title && (
                      <p className="mt-0.5 text-xs text-gray-600">{e.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
