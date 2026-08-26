// Sourcing events inside the supplier portal: the invitations this supplier has
// actually received, split into open and closed.
//
// Previously a hardcoded array with its own `EVT-*` id scheme, unrelated to the
// events the internal module creates — the supplier saw a fiction. Now it reads
// sourcing_responses, which is both the invitation and the response record, so a
// supplier only ever sees events they were genuinely asked to bid on.
//
// "Open" means the event is live AND the deadline has not passed. A supplier
// cannot act on an event past its deadline, so showing it as actionable would be
// a false promise.
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate } from '@/lib/format';
import { useInvitationsForSupplier } from '@/lib/db/hooks/use-sourcing-responses';
import { useSourcingEvents } from '@/lib/db/hooks/use-sourcing-events';
import { usePortalSupplierId } from './portal-identity';
import type { SourcingResponse } from '@/lib/db/sourcing-responses';
import type { SourcingEvent } from '@/lib/db/sourcing-events';

interface Invitation {
  response: SourcingResponse;
  event: SourcingEvent;
}

const LIVE_EVENT_STATUSES = ['published', 'in-evaluation', 'award-pending'];

function isOpen(inv: Invitation): boolean {
  if (!LIVE_EVENT_STATUSES.includes(inv.event.status)) return false;
  if (!inv.event.deadline) return true;
  return new Date(inv.event.deadline).getTime() >= Date.now();
}

function InvitationCard({ invitation, isPast }: { invitation: Invitation; isPast?: boolean }) {
  const { response, event } = invitation;
  const responded = response.status === 'responded';

  return (
    <Card className="py-4">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{event.title}</h3>
              <Badge variant="secondary" className="text-xs">{event.type}</Badge>
            </div>
            {event.description && (
              <p className="mt-1.5 text-xs text-muted-foreground">{event.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {event.deadline ? `Deadline: ${formatDate(event.deadline)}` : 'No deadline set'}
              </span>
              <StatusBadge status={response.status} size="sm" />
              {responded && response.responseDate && (
                <span>Submitted {formatDate(response.responseDate)}</span>
              )}
            </div>
          </div>

          {response.awarded ? (
            <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="size-3.5" />
              Awarded
            </div>
          ) : isPast ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {responded ? 'Not selected' : 'Closed'}
            </span>
          ) : (
            <Button size="sm" className="shrink-0" asChild>
              <Link to={`/portal/sourcing/${event.id}`}>
                <Clock className="size-3.5" />
                {responded ? 'View response' : 'Respond'}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PortalSourcing() {
  const supplierId = usePortalSupplierId();
  const { data: responses = [], isLoading } = useInvitationsForSupplier(supplierId);
  // The list view needs each event's title and deadline. Reading the register
  // once and joining in memory beats a query per invitation.
  const { data: events = [] } = useSourcingEvents();

  const invitations: Invitation[] = responses
    .map((response) => {
      const event = events.find((e) => e.id === response.eventId);
      return event ? { response, event } : null;
    })
    .filter((i): i is Invitation => i !== null);

  const open = invitations.filter(isOpen);
  const past = invitations.filter((i) => !isOpen(i));

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading invitations…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Sourcing Events</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Events you have been invited to bid on
        </p>
      </div>

      {invitations.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Inbox className="size-8 text-gray-300" />
          <p className="text-sm text-muted-foreground">
            You have not been invited to any sourcing events yet.
          </p>
        </div>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Open ({open.length})</h2>
          {open.map((i) => <InvitationCard key={i.response.id} invitation={i} />)}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Closed ({past.length})</h2>
          {past.map((i) => <InvitationCard key={i.response.id} invitation={i} isPast />)}
        </section>
      )}
    </div>
  );
}
