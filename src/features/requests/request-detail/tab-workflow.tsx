import { useState, useRef, useCallback, useEffect } from 'react';
import type { ProcurementRequest, RequestStatus, StageHistoryEntry } from '@/data/types';
import { useStageHistoryByRequest } from '@/lib/db/hooks/use-stage-history';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useIntegrationsByRequest } from '@/lib/db/hooks/use-system-integrations';
import { useWorkflowStepDetailsForRequest } from '@/lib/db/hooks/use-workflow-step-details';
import { useWorkflowTemplate } from '@/lib/db/hooks/use-workflow-templates';
import { useApprovalLookup } from '@/lib/db/hooks/use-approvals';
import { isStageSkippedForChannel } from '@/lib/workflow/buying-channel-stages';
import { openItemForRequest, type OpenSlaState } from '@/lib/workflow/open-items';
import { isGatedStage, nodeToStatus, type TemplateNode } from '@/lib/workflow/node-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, UserPlus } from 'lucide-react';
import { ReferBackDialog } from './components/refer-back-dialog';
import { ReassignDialog } from './components/reassign-dialog';
import { StepDetailCard } from './components/step-detail-card';
import { StageCommentComposer } from './components/stage-comment-composer';
import { useCommentsByRequest } from '@/lib/db/hooks/use-comments';
import { SystemIntegrationTimeline } from '@/components/shared/system-integration-timeline';
import { formatDate } from '@/lib/format';

interface TabWorkflowProps {
  request: ProcurementRequest;
  /** When set (from the top stepper), scroll to and highlight this stage. */
  focusStageId?: string | null;
}

const LIFECYCLE_STAGES: { id: RequestStatus; label: string }[] = [
  { id: 'intake', label: 'Intake' },
  { id: 'validation', label: 'Validation' },
  // Conditional: entered only when the intake triage required an assessment and
  // no reusable one matched. Rendered as skipped otherwise, not omitted.
  { id: 'risk', label: 'Risk Assessment' },
  { id: 'onboarding', label: 'Vendor Onboarding' },
  { id: 'approval', label: 'Approval' },
  { id: 'sourcing', label: 'Sourcing' },
  { id: 'contracting', label: 'Contracting' },
  { id: 'po', label: 'Purchase Order' },
  { id: 'receipt', label: 'Goods Receipt' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'payment', label: 'Payment' },
];

/** Compact SLA state for the open stage. `none` renders nothing — an absent
 *  target is not the same as being on track, so it must not look reassuring. */
function SlaPill({ state }: { state: OpenSlaState }) {
  if (state === 'none') return <span className="text-muted-foreground">No SLA set</span>;
  const styles: Record<Exclude<OpenSlaState, 'none'>, string> = {
    'on-track': 'bg-green-100 text-green-700',
    'at-risk': 'bg-amber-100 text-amber-700',
    breached: 'bg-red-100 text-red-700',
  };
  const labels: Record<Exclude<OpenSlaState, 'none'>, string> = {
    'on-track': 'On track',
    'at-risk': 'Due soon',
    breached: 'Overdue',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${styles[state]}`}>{labels[state]}</span>
  );
}

export function TabWorkflow({ request, focusStageId }: TabWorkflowProps) {
  useUsers();
  const lookupUser = useUserLookup();
  const { data: history = [] } = useStageHistoryByRequest(request.id);
  const { data: stepDetails = [] } = useWorkflowStepDetailsForRequest(request.id);
  const { data: workflowTemplate } = useWorkflowTemplate(request.workflowTemplateId);
  const { byRequest: approvalsByRequest } = useApprovalLookup();
  const approvals = approvalsByRequest(request.id);
  const { data: allComments = [] } = useCommentsByRequest(request.id);
  const { data: integrations = [] } = useIntegrationsByRequest(request.id);
  const owner = lookupUser(request.ownerId);


  const [referBackOpen, setReferBackOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => {
    // Default: expand the current stage
    const initial = new Set<string>();
    if (
      request.status !== 'completed' &&
      request.status !== 'cancelled' &&
      request.status !== 'draft'
    ) {
      initial.add(request.status);
    }
    return initial;
  });
  const [highlightedStage, setHighlightedStage] = useState<string | null>(null);

  // Refs for scrolling
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Build stage data
  const completedStages = new Set<string>();
  const stageEntries = new Map<string, StageHistoryEntry>();

  for (const entry of history) {
    if (entry.stage === 'draft' || entry.stage === 'referred-back' || entry.stage === 'completed')
      continue;
    if (entry.completedAt) {
      completedStages.add(entry.stage);
    }
    stageEntries.set(entry.stage, entry);
  }

  // The template node the request is sitting on carries the stage's owner role,
  // its SLA and its exit criteria — the things this tab could never show.
  const currentNode: TemplateNode | undefined = workflowTemplate?.nodes.find(
    (n) => n.type === 'stage' && nodeToStatus(n.label) === request.status,
  );
  const currentEntry = stageEntries.get(request.status);
  const openItem = openItemForRequest(
    request,
    currentNode,
    approvals,
    currentEntry?.enteredAt,
  );

  const isCancelled = request.status === 'cancelled';
  const isCompleted = request.status === 'completed';

  // Handle stepper click
  const handleStepClick = useCallback(
    (stepId: string) => {
      setExpandedStages((prev) => {
        const next = new Set(prev);
        next.add(stepId);
        return next;
      });
      setHighlightedStage(stepId);

      // Scroll to card
      requestAnimationFrame(() => {
        const el = cardRefs.current[stepId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      // Clear highlight after a moment
      setTimeout(() => setHighlightedStage(null), 2000);
    },
    [],
  );

  // When the parent (top-level page) asks us to focus a stage (from the
  // always-visible stepper), reuse the same click handler. The effect
  // runs whenever the parent sets a new focusStageId, even if the user
  // has stayed on the same tab.
  useEffect(() => {
    if (!focusStageId) return;
    // Wait a frame so the card refs exist after the Workflow tab mounts.
    const t = requestAnimationFrame(() => handleStepClick(focusStageId));
    return () => cancelAnimationFrame(t);
  }, [focusStageId, handleStepClick]);

  const toggleStage = useCallback((stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }, []);

  // Detail lookup by stage
  const getDetailForStage = (stageId: string) => {
    return stepDetails.find((d) => d.stage === stageId);
  };

  // Determine which stages to show cards for
  const visibleStages = LIFECYCLE_STAGES.map((stage) => {
    const entry = stageEntries.get(stage.id);
    const isStageCompleted = completedStages.has(stage.id);
    const isCurrent = request.status === stage.id;

    let cardStatus: 'completed' | 'current' | 'future' | 'skipped' | 'blocked';
    const channelSkipsThisStage = isStageSkippedForChannel(request.buyingChannel, stage.id);
    if (isCancelled) {
      cardStatus = isStageCompleted ? 'completed' : 'skipped';
    } else if (channelSkipsThisStage) {
      cardStatus = isStageCompleted ? 'completed' : 'skipped';
    } else if (isCompleted) {
      cardStatus = 'completed';
    } else if (isCurrent) {
      cardStatus = request.isOverdue ? 'blocked' : 'current';
    } else if (request.status === 'referred-back' && entry && !entry.completedAt) {
      cardStatus = 'blocked';
    } else if (isStageCompleted) {
      cardStatus = 'completed';
    } else {
      cardStatus = 'future';
    }

    // Stage-level events projected from live data sources:
    //   refer-back / escalated → stage_history rows with matching action
    //   info-requested         → approval_entries (only on 'approval' stage)
    const referBackEntry = history.find(
      (h) => h.stage === stage.id && h.action === 'referred-back',
    );
    const escalatedEntry = history.find(
      (h) => h.stage === stage.id && h.action === 'escalated',
    );
    const infoRequested =
      stage.id === 'approval'
        ? approvals.find((a) => a.status === 'info-requested')
        : undefined;
    const stageEvents = {
      referBack: referBackEntry
        ? {
            notes: referBackEntry.notes,
            at: referBackEntry.enteredAt,
            by: lookupUser(referBackEntry.ownerId)?.name,
          }
        : undefined,
      escalated: escalatedEntry
        ? {
            notes: escalatedEntry.notes,
            at: escalatedEntry.enteredAt,
            by: lookupUser(escalatedEntry.ownerId)?.name,
          }
        : undefined,
      infoRequested: infoRequested
        ? {
            comments: infoRequested.comments,
            at: infoRequested.respondedAt ?? infoRequested.requestedAt,
            by: infoRequested.approverName,
          }
        : undefined,
    };

    return {
      ...stage,
      status: cardStatus,
      entry,
      detail: getDetailForStage(stage.id),
      events: stageEvents,
    };
  });

  return (
    <div className="space-y-6">
      {/* The page header's LifecycleStepper already shows the full timeline on
          every tab and deep-links here via focusStageId — this tab does not
          repeat it, only the per-stage detail below. */}

      {/* The attached template, showing each stage's configured owner, SLA and
          gate. It used to render flat grey pills of node labels only, which is
          all a node carried; the runtime now reads all three from here. */}
      {workflowTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attached Template — {workflowTemplate.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              {workflowTemplate.description || 'Admin-configured workflow template attached to this request.'}
              {' '}Type: <code>{workflowTemplate.type || 'default'}</code>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Stage</th>
                    <th className="py-1.5 pr-3 font-medium">Owner role</th>
                    <th className="py-1.5 pr-3 font-medium">SLA</th>
                    <th className="py-1.5 font-medium">Leaving the stage</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowTemplate.nodes
                    .filter((n) => n.type === 'stage')
                    .map((n) => {
                      const isCurrent = nodeToStatus(n.label) === request.status;
                      return (
                        <tr key={n.id} className={isCurrent ? 'bg-blue-50/60' : ''}>
                          <td className="py-1.5 pr-3 font-medium text-gray-900">
                            {n.label}
                            {isCurrent && <span className="ml-1.5 text-[10px] text-blue-700">current</span>}
                          </td>
                          <td className="py-1.5 pr-3">
                            {n.role ?? <span className="text-gray-400">not set</span>}
                          </td>
                          <td className="py-1.5 pr-3">
                            {n.slaDays != null
                              ? `${n.slaDays}d`
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-1.5 text-muted-foreground">
                            {isGatedStage(n, nodeToStatus(n.label))
                              ? (n.purpose ?? 'Needs the owner to complete it')
                              : 'Advances automatically'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Detail Panels + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {visibleStages.map((stage) => (
            <div
              key={stage.id}
              ref={(el) => {
                cardRefs.current[stage.id] = el;
              }}
            >
              <StepDetailCard
                stage={stage.id}
                stageLabel={stage.label}
                status={stage.status}
                detail={stage.detail}
                stageHistory={stage.entry}
                isExpanded={expandedStages.has(stage.id)}
                onToggle={() => toggleStage(stage.id)}
                isHighlighted={highlightedStage === stage.id}
                requestId={request.id}
                requestCategory={request.category}
                events={stage.events}
              />
              {/* Stage-scoped comments + composer (current stage only). One
                  thread per stage: real comments (useCommentsByRequest) plus
                  this stage's legacy historical entries (WorkflowStepDetail
                  .comments — read-only seed data nothing ever writes to,
                  previously shown a second time in its own box inside
                  StepDetailCard), merged and sorted together. */}
              {expandedStages.has(stage.id) && (
                <div className="mt-3 space-y-2">
                  {[
                    ...allComments
                      .filter((c) => c.stage === stage.id)
                      .map((c) => ({
                        key: c.id,
                        authorName: c.authorName,
                        authorInitials: c.authorInitials || c.authorName.slice(0, 2).toUpperCase(),
                        timestamp: c.timestamp,
                        isInternal: c.isInternal,
                        content: c.content,
                      })),
                    ...(stage.detail?.comments ?? []).map((c, ci) => ({
                      key: `legacy-${stage.id}-${ci}`,
                      authorName: c.author,
                      authorInitials: c.author.slice(0, 2).toUpperCase(),
                      timestamp: c.timestamp,
                      isInternal: c.isInternal,
                      content: c.content,
                    })),
                  ]
                    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                    .map((c) => (
                      <div
                        key={c.key}
                        className="flex items-start gap-2 rounded-md border border-gray-200 bg-white p-3"
                      >
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-700">
                          {c.authorInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-gray-800">{c.authorName}</span>
                            {' · '}
                            {formatDate(c.timestamp)}
                            {c.isInternal && ' · internal'}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  {/* Composer only on the CURRENT stage (per UX decision). */}
                  {request.status === stage.id && !isCompleted && !isCancelled && (
                    <StageCommentComposer
                      requestId={request.id}
                      stage={stage.id}
                      stageLabel={stage.label}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What is open</CardTitle>
            </CardHeader>
            {/* Previously this showed only a name and a day count, which said
                nothing about what the request was actually waiting for. The open
                item names the stage, the action, and the criteria for taking it. */}
            <CardContent className="space-y-3">
              {openItem ? (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{openItem.action}</p>
                    {openItem.exitCriteria && (
                      <p className="mt-1 text-xs text-muted-foreground">{openItem.exitCriteria}</p>
                    )}
                  </div>
                  <div className="border-t pt-2">
                    <p className="text-xs text-muted-foreground">Owner</p>
                    <p className="text-sm font-medium text-gray-900">
                      {owner?.name ?? (openItem.ownerRole ? `Unassigned (${openItem.ownerRole})` : 'Unassigned')}
                    </p>
                    {owner?.role && <p className="text-xs text-muted-foreground">{owner.role}</p>}
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">{request.daysInStage} day(s) held</span>
                    <SlaPill state={openItem.slaState} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing outstanding — this request is {request.status}.
                </p>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => setReferBackOpen(true)}
            >
              <RotateCcw className="size-3.5" />
              Refer Back
            </Button>
            <Button variant="outline" onClick={() => setReassignOpen(true)}>
              <UserPlus className="size-3.5" />
              Reassign
            </Button>
          </div>
        </div>
      </div>

      {/* System Integrations Timeline */}
      {integrations.length > 0 && (
        <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">System Integrations</h3>
          <SystemIntegrationTimeline integrations={integrations} />
        </div>
      )}

      <ReferBackDialog open={referBackOpen} onOpenChange={setReferBackOpen} request={request} />
      <ReassignDialog open={reassignOpen} onOpenChange={setReassignOpen} request={request} />
    </div>
  );
}
