// Agent-side support queue: triage, then work a ticket in the drawer.
//
// Route-guarded to the agent roles (see canWorkTickets). The guard is a
// convenience, not the boundary: the entitlement that matters is applied in
// listTickets, because RLS is currently permissive.
//
// SLA state is computed client-side from due_at rather than stored, so a ticket
// that crosses its deadline while the queue is open reads as breached without a
// refresh or a server round-trip.

import { useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Inbox, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { useTickets } from '@/lib/db/hooks/use-tickets';
import { useAuthStore } from '@/stores/auth-store';
import { TERMINAL_TICKET_STATUSES, type Ticket } from '@/data/types';
import { slaState, ticketSlaMetrics } from '@/lib/procurement/ticket-sla';
import { TicketDrawer } from './ticket-drawer';
import { TicketPriorityBadge, TicketStatusBadge, TicketSlaBadge } from './ticket-badges';

/**
 * Standing views. `unassigned` leads because an unowned ticket is the only state
 * where nobody has picked the work up — that is what a queue is for. `breaching`
 * sits beside it because a breached ticket is the other thing that needs a
 * person now, whoever owns it.
 */
type View = 'unassigned' | 'breaching' | 'mine' | 'open' | 'all';

const VIEWS: { id: View; label: string }[] = [
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'breaching', label: 'Breaching' },
  { id: 'mine', label: 'Mine' },
  { id: 'open', label: 'All open' },
  { id: 'all', label: 'All' },
];

function matchesView(ticket: Ticket, view: View, currentUserId: string): boolean {
  switch (view) {
    case 'unassigned':
      // Terminal tickets without an owner are history, not outstanding work.
      return !ticket.ownerId && !TERMINAL_TICKET_STATUSES.includes(ticket.status);
    case 'breaching': {
      const state = slaState(ticket);
      return state === 'breached' || state === 'at-risk';
    }
    case 'mine':
      return ticket.ownerId === currentUserId;
    case 'open':
      return !TERMINAL_TICKET_STATUSES.includes(ticket.status);
    case 'all':
      return true;
  }
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div className="rounded-lg border bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

export function TicketInboxPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const { data: tickets = [], isLoading } = useTickets(currentUser.name, {
    allTickets: true,
    limit: 200,
  });

  const [view, setView] = useState<View>('unassigned');
  const [priority, setPriority] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Ticket | null>(null);

  // Derived from the data rather than hardcoded, so a category added through the
  // Contact Support form appears here without a code change.
  const categories = useMemo(
    () => [...new Set(tickets.map((t) => t.category).filter(Boolean))].sort() as string[],
    [tickets],
  );

  const metrics = useMemo(() => ticketSlaMetrics(tickets), [tickets]);

  const counts = useMemo(() => {
    const out = {} as Record<View, number>;
    for (const v of VIEWS) out[v.id] = tickets.filter((t) => matchesView(t, v.id, currentUser.id)).length;
    return out;
  }, [tickets, currentUser.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets
      .filter((t) => matchesView(t, view, currentUser.id))
      .filter((t) => priority === 'all' || t.priority === priority)
      .filter((t) => category === 'all' || t.category === category)
      .filter((t) =>
        !q ||
        [t.id, t.summary, t.context, t.createdBy, t.ownerName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
  }, [tickets, view, priority, category, search, currentUser.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ticket Inbox"
        subtitle="Support requests raised from Contact Support and the AI assistant"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open" value={metrics.open} />
        <Stat label="Breached" value={metrics.breached} tone={metrics.breached > 0 ? 'bad' : 'neutral'} />
        <Stat label="At risk" value={metrics.atRisk} tone={metrics.atRisk > 0 ? 'warn' : 'neutral'} />
        <Stat
          label="Median to resolve"
          value={metrics.medianHoursToResolve === null ? '—' : `${metrics.medianHoursToResolve.toFixed(1)}h`}
        />
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          {VIEWS.map((v) => (
            <TabsTrigger key={v.id} value={v.id} className="gap-1.5">
              {v.label}
              <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-medium text-gray-700">
                {counts[v.id] ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search id, subject, requester…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c.replace(/-/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading tickets…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Inbox className="size-8 text-gray-300" />
          <p className="text-sm text-muted-foreground">
            {tickets.length === 0 ? 'No tickets have been raised yet' : 'No tickets match these filters'}
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-white">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{t.id}</span>
                  <TicketStatusBadge status={t.status} />
                  {t.priority && <TicketPriorityBadge priority={t.priority} />}
                  {!t.ownerId && !TERMINAL_TICKET_STATUSES.includes(t.status) && (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                      Unassigned
                    </span>
                  )}
                  <TicketSlaBadge ticket={t} />
                </div>
                <p className="truncate text-sm text-gray-800">{t.summary}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {t.createdBy}
                  {t.ownerName && <span> · owned by {t.ownerName}</span>}
                  <span> · {formatDistanceToNow(parseISO(t.createdAt), { addSuffix: true })}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <TicketDrawer
        ticket={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
