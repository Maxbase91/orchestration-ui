// Sourcing event detail page: overview, per-supplier response tracking and the
// Q&A board for one RFx event.
//
// Reads the live event through useSourcingEvent(). It previously resolved the
// id against an in-file fixture map, so navigating to a real event — the only
// kind the New Event wizard produces — rendered "Sourcing event not found".
//
// Supplier tracking reads real invitations from sourcing_responses — the row is
// both the invitation and the response, so "invited but not viewed" is a state
// the buyer can actually see. The Q&A board remains a mock (labelled as such).
//
// The "Publish Amendment" and "Send Reminder" buttons are gone rather than left
// inert. A button that does nothing is the same lie as a hardcoded array — it
// just fails later, in front of someone who trusted it.
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, formatCurrency } from '@/lib/format';
import { Link } from 'react-router-dom';
import { useSourcingEvent } from '@/lib/db/hooks/use-sourcing-events';
import { useUserLookup } from '@/lib/db/hooks/use-users';
import {
  useApplyAwardToRequest,
  useResponsesForEvent,
} from '@/lib/db/hooks/use-sourcing-responses';
import { toAwardCandidate } from '@/lib/db/sourcing-responses';
import { useRequest } from '@/lib/db/hooks/use-requests';
import { EVALUATABLE_EVENT_STATUSES } from '@/lib/procurement/sourcing-award';
import { useAuthStore } from '@/stores/auth-store';
import { QABoard } from './components/qa-board';

/** Renders a value, or an em-dash placeholder when it is not set. */
function OrDash({ value }: { value: string | null | undefined }) {
  return value ? <>{value}</> : <span className="text-gray-400">—</span>;
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lookupUser = useUserLookup();
  const { data: event, isLoading } = useSourcingEvent(id);
  const { data: responses = [] } = useResponsesForEvent(id);
  const { data: linkedRequest } = useRequest(event?.requestId);
  const currentUser = useAuthStore((s) => s.currentUser);
  const applyAward = useApplyAwardToRequest();

  if (isLoading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading event…</p>;
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-sm text-muted-foreground">Sourcing event not found.</p>
        <Button variant="outline" onClick={() => navigate('/sourcing')}>
          <ArrowLeft className="size-4" />
          Back to Events
        </Button>
      </div>
    );
  }

  const ownerName = lookupUser(event.ownerId)?.name;
  const respondedCount = responses.filter((r) => r.status === 'responded').length;
  const canEvaluate = EVALUATABLE_EVENT_STATUSES.includes(event.status) && respondedCount > 0;

  // The award write-back spans three tables with no transaction, so it can land
  // half-applied. When the event says it was awarded but the request disagrees,
  // offer the repair rather than leaving the two silently out of step.
  const awardedResponse = responses.find((r) => r.awarded);
  const needsReapply = Boolean(
    event.awardedSupplierId &&
    linkedRequest &&
    linkedRequest.supplierId !== event.awardedSupplierId,
  );

  async function handleReapply() {
    if (!event?.requestId || !awardedResponse) return;
    try {
      await applyAward.mutateAsync({
        requestId: event.requestId,
        winner: toAwardCandidate(awardedResponse),
        actor: { id: currentUser.id, name: currentUser.name },
      });
      toast.success(`Award re-applied to ${event.requestId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not re-apply the award');
    }
  }

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate('/sourcing')}
      >
        <ArrowLeft className="size-3.5" />
        Back to Events
      </Button>

      <PageHeader
        title={event.title}
        subtitle={event.description || undefined}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={event.status} />
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {event.type}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {canEvaluate && (
              <Button size="sm" onClick={() => navigate(`/sourcing/${event.id}/evaluation`)}>
                <Award className="size-3.5" />
                Evaluate &amp; award
              </Button>
            )}
            {needsReapply && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={handleReapply}
                disabled={applyAward.isPending}
              >
                <RotateCcw className="size-3.5" />
                Re-apply award to request
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Tracking</TabsTrigger>
          <TabsTrigger value="qa">Q&A Board</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Key Dates</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Published</span><span><OrDash value={event.publishDate && formatDate(event.publishDate)} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span className="font-medium"><OrDash value={event.deadline && formatDate(event.deadline)} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Evaluation</span><span><OrDash value={event.evaluationDate && formatDate(event.evaluationDate)} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Award</span><span><OrDash value={event.awardDate && formatDate(event.awardDate)} /></span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Supplier Responses</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Invited</span><span className="font-medium">{responses.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Responded</span><span className="font-medium text-green-700">{respondedCount}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Response rate</span>
                  <span className="font-medium">
                    {responses.length > 0 ? `${Math.round((respondedCount / responses.length) * 100)}%` : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Budget &amp; Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium"><OrDash value={event.budget != null ? formatCurrency(event.budget) : null} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span><OrDash value={event.category} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span><OrDash value={ownerName} /></span></div>
                {/* The originating demand. An event raised from the sourcing stage
                    carries requestId; a standing category event has none. */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raised from</span>
                  <span>
                    {event.requestId ? (
                      <Link to={`/requests/${event.requestId}`} className="text-blue-600 hover:underline">
                        {event.requestId}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Supplier Tracking</CardTitle></CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No suppliers invited yet.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium text-muted-foreground">Supplier</th>
                      <th className="py-2 text-left font-medium text-muted-foreground">Status</th>
                      <th className="py-2 text-left font-medium text-muted-foreground">Price</th>
                      <th className="py-2 text-left font-medium text-muted-foreground">Responded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">
                          {r.supplierName}
                          {r.awarded && (
                            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
                              Awarded
                            </span>
                          )}
                        </td>
                        <td className="py-2"><StatusBadge status={r.status} size="sm" /></td>
                        <td className="py-2 tabular-nums">
                          {r.price != null ? formatCurrency(r.price) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {r.responseDate ? formatDate(r.responseDate) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qa" className="mt-4">
          <QABoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
