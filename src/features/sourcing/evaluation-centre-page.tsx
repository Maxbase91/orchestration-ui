// Evaluation Centre picker: the nav-level entry point to bid evaluation, which
// has no event in scope. It lists the events that can still be evaluated and
// hands off to /sourcing/:id/evaluation, where the scoring and award live.
//
// This page previously *was* the evaluation screen, scoring a hardcoded trio of
// suppliers against hardcoded criteria under a hardcoded event id, with a
// "Proceed to Award" button that had no handler. It kept its route because the
// route is in navigation.ts and the assistant deep-links it.
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate } from '@/lib/format';
import { useSourcingEvents } from '@/lib/db/hooks/use-sourcing-events';
import { useAllSourcingResponses } from '@/lib/db/hooks/use-sourcing-responses';
import { EVALUATABLE_EVENT_STATUSES } from '@/lib/procurement/sourcing-award';

export function EvaluationCentrePage() {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useSourcingEvents();
  const { data: responses = [] } = useAllSourcingResponses();

  const open = events.filter((e) => EVALUATABLE_EVENT_STATUSES.includes(e.status));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Evaluation Centre"
        subtitle="Score submitted bids and award an event"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading events…</p>
      ) : open.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No events are open for evaluation. An event becomes evaluable once it is published.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {open.map((e) => {
            const forEvent = responses.filter((r) => r.eventId === e.id);
            const responded = forEvent.filter((r) => r.status === 'responded').length;
            return (
              <Card
                key={e.id}
                className="cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => navigate(`/sourcing/${e.id}/evaluation`)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.id} · {e.type} · {responded} of {forEvent.length} responded
                      {e.deadline && ` · closes ${formatDate(e.deadline)}`}
                    </p>
                  </div>
                  <StatusBadge status={e.status} size="sm" />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
