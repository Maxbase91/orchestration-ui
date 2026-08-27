// Event evaluation page: weighted bid scoring for ONE sourcing event, ending in
// the award. This is the endpoint of the sourcing loop — the award writes the
// winning supplier back onto the originating request and resumes the workflow
// instance that the sourcing stage gate suspended.
//
// Scores and the shortlist persist to sourcing_responses as they are edited;
// they used to live in component state on a fixture, so an evaluation was lost
// on navigation and could never lead to an award.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';
import { useSourcingEvent } from '@/lib/db/hooks/use-sourcing-events';
import {
  useAwardResponse,
  useResponsesForEvent,
  useSaveResponseScores,
  useSetShortlisted,
} from '@/lib/db/hooks/use-sourcing-responses';
import { toAwardCandidate } from '@/lib/db/sourcing-responses';
import { calcWeightedTotal, canAward, rankResponses } from '@/lib/procurement/sourcing-award';
import { useAuthStore } from '@/stores/auth-store';
import { ScoringMatrix, type SupplierScore } from './components/scoring-matrix';

/** Score edits fire per keystroke; hold the write until typing settles. */
const SCORE_WRITE_DEBOUNCE_MS = 600;

export function EventEvaluationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);

  const { data: event, isLoading } = useSourcingEvent(id);
  const { data: responses = [] } = useResponsesForEvent(id);
  const saveScores = useSaveResponseScores();
  const setShortlisted = useSetShortlisted();
  const award = useAwardResponse();

  const [confirmOpen, setConfirmOpen] = useState(false);
  // Optimistic score overlay: the debounced write means the server copy lags
  // the keystrokes, and rendering the server copy alone would fight the typist.
  const [draftScores, setDraftScores] = useState<Record<string, Record<string, number>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const criteria = useMemo(() => event?.criteria ?? [], [event]);

  const rows: SupplierScore[] = useMemo(
    () =>
      responses.map((r) => ({
        id: r.id,
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        scores: draftScores[r.id] ?? r.scores,
        shortlisted: r.shortlisted,
        status: r.status,
        ...(r.price != null ? { price: r.price } : {}),
      })),
    [responses, draftScores],
  );

  // Rank on the same rule the award uses, and on the draft scores so the
  // recommendation tracks what the evaluator is looking at.
  const ranked = useMemo(
    () =>
      rankResponses(
        responses.map((r) => {
          const scores = draftScores[r.id] ?? r.scores;
          return { ...toAwardCandidate(r), weightedTotal: calcWeightedTotal(scores, criteria) };
        }),
      ),
    [responses, draftScores, criteria],
  );
  const leader = ranked[0];

  const awardCheck = useMemo(
    () =>
      event && leader
        ? canAward(event, responses.map(toAwardCandidate), leader.id)
        : { allowed: false, reason: 'No shortlisted supplier has submitted a response' },
    [event, leader, responses],
  );

  const handleScoreChange = useCallback(
    (responseId: string, criterionId: string, score: number) => {
      // Computed outside setDraftScores: scheduling the write inside the updater
      // would double-schedule it, since React may run an updater more than once.
      const current = draftScores[responseId] ?? responses.find((r) => r.id === responseId)?.scores ?? {};
      const next = { ...current, [criterionId]: score };
      setDraftScores((prev) => ({ ...prev, [responseId]: next }));

      clearTimeout(timers.current[responseId]);
      timers.current[responseId] = setTimeout(() => {
        saveScores.mutate({
          id: responseId,
          scores: next,
          // Recomputed here rather than trusted from the grid, so the stored
          // total can never disagree with the criteria it was derived from.
          weightedTotal: calcWeightedTotal(next, criteria),
        });
      }, SCORE_WRITE_DEBOUNCE_MS);
    },
    [draftScores, responses, criteria, saveScores],
  );

  const handleShortlistToggle = useCallback(
    (responseId: string, shortlisted: boolean) => {
      setShortlisted.mutate({ id: responseId, shortlisted });
    },
    [setShortlisted],
  );

  async function handleAward() {
    if (!event || !leader) return;
    try {
      await award.mutateAsync({
        event,
        responses,
        responseId: leader.id,
        actor: { id: currentUser.id, name: currentUser.name },
      });
      toast.success(`${event.id} awarded to ${leader.supplierName}`);
      setConfirmOpen(false);
      navigate(`/sourcing/${event.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Award failed');
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading evaluation…</p>;
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Sourcing event {id} was not found.</p>
        <Button variant="outline" onClick={() => navigate('/sourcing')}>
          Back to Events
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate(`/sourcing/${event.id}`)}
      >
        <ArrowLeft className="size-3.5" />
        Back to Event
      </Button>

      <PageHeader
        title="Evaluation Centre"
        subtitle={`${event.id}: ${event.title}`}
        badge={<StatusBadge status={event.status} />}
      />

      {criteria.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            This event has no evaluation criteria, so responses cannot be scored.
            Criteria are set when the event is created.
          </CardContent>
        </Card>
      ) : responses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No suppliers have been invited to this event yet.
          </CardContent>
        </Card>
      ) : (
        <ScoringMatrix
          criteria={criteria}
          suppliers={rows}
          onScoreChange={handleScoreChange}
          onShortlistToggle={handleShortlistToggle}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="size-4" />
            Award Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {leader ? (
            <p className="text-sm text-gray-700">
              Based on weighted scoring, the recommended award is to{' '}
              <strong>{leader.supplierName}</strong>
              {leader.price != null && <> at {formatCurrency(leader.price, event.currency)}</>}
              {ranked[1] && <>, with {ranked[1].supplierName} as backup</>}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No shortlisted supplier has submitted a response, so there is nothing to award yet.
            </p>
          )}

          {event.awardedSupplierId ? (
            <p className="text-sm text-muted-foreground">
              This event was already awarded to {event.awardedSupplierId}.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <Button size="sm" disabled={!awardCheck.allowed} onClick={() => setConfirmOpen(true)}>
                <Award className="size-3.5" />
                Proceed to Award
              </Button>
              {!awardCheck.allowed && awardCheck.reason && (
                <span className="text-xs text-muted-foreground">{awardCheck.reason}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award {event.id}</DialogTitle>
            <DialogDescription>
              {leader && (
                <>
                  This awards the event to <strong>{leader.supplierName}</strong> and closes it.
                  {event.requestId
                    ? ` ${leader.supplierName} will be written back to ${event.requestId} as the
                        supplier, and the request will move on from sourcing.`
                    : ' This event is not linked to a request, so nothing is written back.'}
                  {' '}An award cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Go Back
            </Button>
            <Button onClick={handleAward} disabled={award.isPending}>
              {award.isPending ? 'Awarding…' : 'Confirm Award'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
