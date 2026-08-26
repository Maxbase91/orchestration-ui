// Sourcing event detail page: overview, per-supplier response tracking and the
// Q&A board for one RFx event.
//
// Reads the live event through useSourcingEvent(). It previously resolved the
// id against an in-file fixture map, so navigating to a real event — the only
// kind the New Event wizard produces — rendered "Sourcing event not found".
//
// Supplier tracking is still empty: nothing writes to sourcing_responses until
// the invitation work lands. The tab says so rather than showing a fabricated
// roster, and the Q&A board remains a mock (labelled as such).
//
// The "Publish Amendment" and "Send Reminder" buttons are gone rather than left
// inert. A button that does nothing is the same lie as a hardcoded array — it
// just fails later, in front of someone who trusted it.
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, formatCurrency } from '@/lib/format';
import { useSourcingEvent } from '@/lib/db/hooks/use-sourcing-events';
import { useUserLookup } from '@/lib/db/hooks/use-users';
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
                <div className="flex justify-between"><span className="text-muted-foreground">Invited</span><span className="font-medium">—</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Responded</span><span className="font-medium">—</span></div>
                <p className="pt-1 text-xs text-muted-foreground">Invitations are not recorded yet.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Budget &amp; Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium"><OrDash value={event.budget != null ? formatCurrency(event.budget) : null} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span><OrDash value={event.category} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span><OrDash value={ownerName} /></span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Supplier Tracking</CardTitle></CardHeader>
            <CardContent>
              <p className="py-6 text-center text-sm text-muted-foreground">
                No suppliers invited yet.
              </p>
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
