// Ticket detail and working actions, opened from the inbox queue.
//
// A drawer rather than a route: agents triage in sequence, and a full page
// navigation per ticket loses the queue's scroll position and filters every
// time.
//
// Order matters here. References sit near the top because the first question an
// agent asks is "what is this about"; the actions sit above the thread because
// assigning and replying is the work, and the thread is the evidence.

import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { Lock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useTicketResponses } from '@/lib/db/hooks/use-tickets';
import { useAuthStore } from '@/stores/auth-store';
import type { Ticket } from '@/data/types';
import { TicketPriorityBadge, TicketStatusBadge } from './ticket-badges';
import { TicketActions } from './ticket-actions';
import { TicketLinksPanel } from './ticket-links-panel';

interface TicketDrawerProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  );
}

export function TicketDrawer({ ticket, open, onOpenChange }: TicketDrawerProps) {
  // Agent-side view, so internal notes are included. The requester-facing list
  // on Contact Support calls the same hook without this flag.
  const { data: responses = [], isLoading } = useTicketResponses(ticket?.id, true);
  const currentUser = useAuthStore((s) => s.currentUser);

  if (!ticket) return null;

  const actor = { id: currentUser.id, name: currentUser.name };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-3">{ticket.id}</span>
            <TicketStatusBadge status={ticket.status} />
            {ticket.priority && <TicketPriorityBadge priority={ticket.priority} />}
          </div>
          <SheetTitle className="text-left text-base">{ticket.summary}</SheetTitle>
          <SheetDescription className="text-left">
            Raised by {ticket.createdBy} ·{' '}
            {formatDistanceToNow(parseISO(ticket.createdAt), { addSuffix: true })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Owner">
              {ticket.ownerName ?? <span className="text-ink-3">Unassigned</span>}
            </Field>
            <Field label="Category">
              {ticket.category ? (
                <span className="capitalize">{ticket.category.replace(/-/g, ' ')}</span>
              ) : (
                <span className="text-ink-3">—</span>
              )}
            </Field>
            <Field label="Raised via">
              <span className="capitalize">{ticket.source ?? 'form'}</span>
            </Field>
            <Field label="Created">
              {format(parseISO(ticket.createdAt), 'dd MMM yyyy, HH:mm')}
            </Field>
            {ticket.resolvedAt && (
              <Field label="Resolved">
                {format(parseISO(ticket.resolvedAt), 'dd MMM yyyy, HH:mm')}
              </Field>
            )}
          </div>

          <TicketLinksPanel ticketId={ticket.id} actor={actor} />

          <div className="rounded-lg border bg-card-2/60 p-3">
            <TicketActions ticket={ticket} actor={actor} />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Description
            </p>
            <p className="whitespace-pre-wrap rounded border bg-card-2 p-3 text-sm leading-relaxed text-ink-2">
              {ticket.context}
            </p>
          </div>

          {ticket.resolution && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Resolution
              </p>
              <p className="whitespace-pre-wrap rounded border border-ok-line bg-ok-soft p-3 text-sm leading-relaxed text-ink-2">
                {ticket.resolution}
              </p>
            </div>
          )}

          {ticket.transcript && (
            <details className="rounded border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Assistant conversation
              </summary>
              {/* Verbatim, not the model's summary — the detail that matters is
                  usually several turns before the user asked for a human. */}
              <p className="whitespace-pre-wrap border-t px-3 py-2 text-sm leading-relaxed text-ink-2">
                {ticket.transcript}
              </p>
            </details>
          )}

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Correspondence
            </p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No replies yet.</p>
            ) : (
              <div className="space-y-3">
                {responses.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded border p-3 ${
                      r.isInternal ? 'border-warn-line bg-warn-soft' : 'bg-card'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-ink-2">
                        {r.authorName ?? 'Unknown'}
                      </span>
                      {r.isInternal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
                          <Lock className="size-2.5" />
                          Internal note
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-ink-3">
                        {format(parseISO(r.createdAt), 'dd MMM, HH:mm')}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                      {r.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
