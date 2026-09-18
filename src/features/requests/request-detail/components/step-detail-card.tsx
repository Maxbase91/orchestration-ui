import { forwardRef, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type { WorkflowStepDetail } from '@/data/workflow-step-details';
import type { StageHistoryEntry } from '@/data/types';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useSupplierLookup } from '@/lib/db/hooks/use-suppliers';
import { requestPrePopulateValues } from '@/lib/procurement/form-prepopulate';
import { outstandingForms } from '@/lib/forms/form-triggers';
import { useFormTriggerContext } from '@/lib/forms/use-form-trigger-context';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { formatDate } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  FileText,
  Server,
  ClipboardList,
  Timer,
  Shield,
  PenLine,
  RotateCcw,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react';
import { systemColors, systemLabels } from '@/data/system-integrations';
import type { ExternalSystem } from '@/data/system-integrations';
import {
  useSubmissionLookup,
  useFormSubmissions,
  useCreateFormSubmission,
} from '@/lib/db/hooks/use-form-submissions';
import {
  useFormTemplates,
  useFormTemplateLookup,
} from '@/lib/db/hooks/use-form-templates';
import type { FormTemplate } from '@/data/form-templates';
import type { FormSubmission } from '@/data/form-submissions';
import { FormSubmissionView } from '@/components/shared/form-submission-view';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { useServiceDescription } from '@/lib/db/hooks/use-service-descriptions';
import { sectionValuesOf, sowPrePopulateValues } from '@/lib/procurement/service-description-seed';
import type { ProcurementRequest } from '@/data/types';
import { useAuthStore } from '@/stores/auth-store';

interface StepDetailCardProps {
  stage: string;
  stageLabel: string;
  status: 'completed' | 'current' | 'future' | 'skipped' | 'blocked';
  detail?: WorkflowStepDetail;
  stageHistory?: StageHistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
  isHighlighted?: boolean;
  requestId?: string;
  requestCategory?: string;
  /**
   * The whole request, so a form can pre-fill from it.
   *
   * FormsSection previously had only `requestId` and `requestCategory` — two
   * scalars destructured off this very object one level up — which is why the
   * Form Builder's request tokens (cost centre, value, supplier) resolved to
   * nothing while the service-description ones worked.
   */
  request?: ProcurementRequest;
  /** Stage-level events surfaced as coloured markers above the detail. */
  events?: {
    referBack?: { notes?: string; at: string; by?: string };
    escalated?: { notes?: string; at: string; by?: string };
    infoRequested?: { comments?: string; at: string; by?: string };
  };
}

const statusConfig: Record<string, { borderClass: string; badgeClass: string; label: string }> = {
  completed: { borderClass: 'border-l-green-500', badgeClass: 'bg-ok-soft text-ok', label: 'Completed' },
  current: { borderClass: 'border-l-amber-500', badgeClass: 'bg-warn-soft text-warn', label: 'In Progress' },
  future: { borderClass: 'border-l-gray-300', badgeClass: 'bg-idle-soft text-ink-3', label: 'Pending' },
  skipped: { borderClass: 'border-l-gray-300', badgeClass: 'bg-idle-soft text-ink-3', label: 'Skipped' },
  blocked: { borderClass: 'border-l-red-500', badgeClass: 'bg-stop-soft text-stop', label: 'Blocked' },
};

const outcomeConfig: Record<string, { className: string; label: string }> = {
  approved: { className: 'bg-ok-soft text-ok', label: 'Approved' },
  rejected: { className: 'bg-stop-soft text-stop', label: 'Rejected' },
  'referred-back': { className: 'bg-warn-soft text-warn', label: 'Referred Back' },
  escalated: { className: 'bg-accent-soft text-accent-solid', label: 'Escalated' },
  completed: { className: 'bg-accent-soft text-accent-solid', label: 'Completed' },
};

const slaConfig: Record<string, { className: string; label: string }> = {
  'on-track': { className: 'bg-ok-soft text-ok', label: 'On Track' },
  'at-risk': { className: 'bg-warn-soft text-warn', label: 'At Risk' },
  breached: { className: 'bg-stop-soft text-stop', label: 'SLA Breached' },
};

function getDurationLabel(enteredAt: string, completedAt?: string): string {
  const start = formatDate(enteredAt);
  if (completedAt) {
    const end = formatDate(completedAt);
    return `${start} → ${end}`;
  }
  return `${start} → ongoing`;
}

export const StepDetailCard = forwardRef<HTMLDivElement, StepDetailCardProps>(
  function StepDetailCard(
    { stage, stageLabel, status, detail, stageHistory, isExpanded, onToggle, isHighlighted, requestId, requestCategory, request, events },
    ref,
  ) {
    useUsers();
    const lookupUser = useUserLookup();
    const config = statusConfig[status];
    const isFuture = status === 'future' || status === 'skipped';

    // Determine handler info from detail or stage history
    const handler = detail?.handler;
    const historyUser = stageHistory?.ownerId ? lookupUser(stageHistory.ownerId) : undefined;
    const handlerName = handler?.name ?? historyUser?.name ?? 'Unassigned';
    const handlerRole = handler?.role ?? historyUser?.role;

    // Action summary
    const actionSummary = detail?.action ?? stageHistory?.notes ?? stageHistory?.action ?? '';

    // Duration info
    const enteredAt = detail?.duration.enteredAt ?? stageHistory?.enteredAt;
    const completedAt = detail?.duration.completedAt ?? stageHistory?.completedAt;
    const daysInStep = detail?.duration.daysInStep ?? (
      enteredAt && completedAt
        ? Math.round((new Date(completedAt).getTime() - new Date(enteredAt).getTime()) / (1000 * 60 * 60 * 24))
        : undefined
    );

    // System involvement
    const sysInv = detail?.systemInvolvement;
    const sysKey = sysInv?.system as ExternalSystem | undefined;

    if (isFuture) {
      return (
        <div ref={ref}>
          <Card className={cn('border-l-4 opacity-50', config.borderClass)}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-ink-3">{stageLabel}</p>
                  <Badge variant="outline" className={config.badgeClass}>
                    {config.label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div ref={ref}>
        <Card
          className={cn(
            'border-l-4 transition-shadow',
            config.borderClass,
            status === 'current' && 'ring-1 ring-warn-line',
            isHighlighted && 'ring-2 ring-accent-solid shadow-md',
          )}
        >
          {/* Collapsed header - always visible */}
          <button
            type="button"
            onClick={onToggle}
            className="w-full text-left px-4 py-3 hover:bg-card-2/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink">{stageLabel}</p>
                    <Badge variant="outline" className={config.badgeClass}>
                      {config.label}
                    </Badge>
                    {sysInv && sysKey && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          systemColors[sysKey] ?? 'bg-idle-soft text-ink-2 border-line',
                        )}
                      >
                        {systemLabels[sysKey] ?? sysInv.systemLabel}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3" />
                      {handlerName}
                      {handlerRole && <span className="text-ink-3">({handlerRole})</span>}
                    </span>
                    {daysInStep !== undefined && enteredAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {daysInStep} day(s)
                        {completedAt && (
                          <span className="text-ink-3">
                            ({getDurationLabel(enteredAt, completedAt)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {actionSummary && (
                    <p className="mt-1 text-xs text-ink-2 truncate">{actionSummary}</p>
                  )}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="size-4 text-ink-3 shrink-0" />
              ) : (
                <ChevronDown className="size-4 text-ink-3 shrink-0" />
              )}
            </div>
          </button>

          {/* Expanded detail */}
          {isExpanded && (
            <CardContent className="pt-0 pb-4 px-4 space-y-4">
              <Separator />

              {/* Stage event markers: refer-back, escalated, info-requested.
                  Rendered first so they catch the user's eye when the card
                  opens. */}
              {events?.referBack && (
                <div className="flex items-start gap-2 rounded-md border border-warn-line bg-warn-soft p-3">
                  <RotateCcw className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-warn">Referred back</p>
                    <p className="text-xs text-warn/80">
                      {events.referBack.notes ?? 'No reason provided'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-warn/80">
                      {events.referBack.by ? `by ${events.referBack.by} · ` : ''}
                      {formatDate(events.referBack.at)}
                    </p>
                  </div>
                </div>
              )}
              {events?.escalated && (
                <div className="flex items-start gap-2 rounded-md border border-stop-line bg-stop-soft p-3">
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-stop" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stop">Escalated</p>
                    <p className="text-xs text-stop/80">
                      {events.escalated.notes ?? 'No reason provided'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stop/80">
                      {events.escalated.by ? `by ${events.escalated.by} · ` : ''}
                      {formatDate(events.escalated.at)}
                    </p>
                  </div>
                </div>
              )}
              {events?.infoRequested && (
                <div className="flex items-start gap-2 rounded-md border border-warn-line bg-warn-soft p-3">
                  <HelpCircle className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-warn">Additional information requested</p>
                    <p className="text-xs text-warn/80">
                      {events.infoRequested.comments ?? 'No details provided'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-warn/80">
                      {events.infoRequested.by ? `by ${events.infoRequested.by} · ` : ''}
                      {formatDate(events.infoRequested.at)}
                    </p>
                  </div>
                </div>
              )}

              {/* Handler section */}
              {handler && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-3 uppercase tracking-wide">
                    <User className="size-3.5" />
                    Handler
                  </div>
                  <div className="flex items-center gap-3 pl-5">
                    <div className="flex size-8 items-center justify-center rounded-full bg-idle-soft text-xs font-medium text-ink-2">
                      {handler.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{handler.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {handler.role} &middot; {handler.department}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision section */}
              {detail?.decision && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-3 uppercase tracking-wide">
                    <Shield className="size-3.5" />
                    Decision
                  </div>
                  <div className="pl-5 space-y-2">
                    <Badge
                      variant="outline"
                      className={
                        outcomeConfig[detail.decision.outcome]?.className ??
                        'bg-idle-soft text-ink-2'
                      }
                    >
                      {outcomeConfig[detail.decision.outcome]?.label ?? detail.decision.outcome}
                    </Badge>
                    {detail.decision.reason && (
                      <p className="text-sm text-ink-2">{detail.decision.reason}</p>
                    )}
                    {detail.decision.conditions && detail.decision.conditions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-ink-3 mb-1">Conditions:</p>
                        <ul className="list-disc list-inside text-sm text-ink-2 space-y-0.5">
                          {detail.decision.conditions.map((cond, i) => (
                            <li key={i}>{cond}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* System Integration */}
              {sysInv && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-3 uppercase tracking-wide">
                    <Server className="size-3.5" />
                    System Integration
                  </div>
                  <div className="pl-5 rounded-md bg-card-2 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {sysInv.systemLabel}
                      </span>
                      {sysInv.referenceId && (
                        <Badge variant="outline" className="text-[10px] bg-card">
                          {sysInv.referenceId}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-ink-2">Status: {sysInv.status}</p>
                    <p className="text-xs text-ink-2">{sysInv.detail}</p>
                  </div>
                </div>
              )}

              {/* What is actually being validated or approved. The description
                  was written at intake and then read nowhere in the lifecycle —
                  a validator and an approver acted on a title and a number. */}
              <ServiceDescriptionSummary stage={stage} requestId={requestId} />

              {/* Forms Completed - Enhanced with FormSubmission data */}
              <FormsSection
                stage={stage}
                status={status}
                detail={detail}
                requestId={requestId}
                requestCategory={requestCategory}
                request={request}
              />

              {/* Documents live only on the Documents tab now — one home,
                  not a per-stage copy of the same documentsAdded list. */}

              {/* Comments live only in the stage-scoped comment thread this
                  tab renders below (tab-workflow.tsx), which now also
                  includes this stage's historical entries — no second,
                  separate comment list here. */}

              {/* Duration & SLA */}
              {detail?.duration && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-3 uppercase tracking-wide">
                    <Timer className="size-3.5" />
                    Duration & SLA
                  </div>
                  <div className="pl-5 flex items-center gap-4 text-sm text-ink-2">
                    <span>
                      {getDurationLabel(
                        detail.duration.enteredAt,
                        detail.duration.completedAt,
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {detail.duration.daysInStep} day(s)
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        slaConfig[detail.slaStatus]?.className ?? 'bg-idle-soft text-ink-2'
                      }
                    >
                      {slaConfig[detail.slaStatus]?.label ?? detail.slaStatus}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Fallback for stage history notes without detail */}
              {!detail && stageHistory?.notes && (
                <div className="pl-0">
                  <p className="text-xs font-medium text-ink-3 mb-1">Notes</p>
                  <p className="text-sm text-ink-2">{stageHistory.notes}</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    );
  },
);

// ── Forms Section ───────────────────────────────────────────────────

/** Stages where a reader is deciding about the demand itself. */
const DESCRIPTION_STAGES = new Set(['validation', 'risk', 'approval', 'sourcing', 'contracting']);

/**
 * The compact narrative and the quality gate, on the stages where somebody is
 * deciding something about this demand.
 *
 * Deliberately the narrative and not the nine sections: the point is to give a
 * validator or an approver the substance of what they are signing without
 * turning the timeline into a document viewer. The full text is on the Overview
 * tab, which is one click away and already renders it.
 */
function ServiceDescriptionSummary({ stage, requestId }: { stage: string; requestId?: string }) {
  const { data: sd } = useServiceDescription(requestId);
  if (!requestId || !DESCRIPTION_STAGES.has(stage)) return null;
  const narrative = sd?.narrative?.trim();
  if (!narrative) return null;

  const score = sd?.qualityScore;
  const required = sd?.requiredSections ?? [];
  const missing = required.filter(
    (id) => !(sectionValuesOf(sd)[id] ?? '').trim(),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-3 uppercase tracking-wide">
        <FileText className="size-3.5" />
        Service description
        {typeof score === 'number' && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              score >= 80 ? 'bg-ok-soft text-ok'
                : score >= 60 ? 'bg-warn-soft text-warn'
                : 'bg-stop-soft text-stop',
            )}
          >
            {score}/100
          </span>
        )}
      </div>
      <p className="pl-5 text-sm leading-relaxed text-ink-2 whitespace-pre-line">{narrative}</p>
      {missing.length > 0 && (
        <p className="pl-5 text-xs text-warn">
          Missing {missing.length} section{missing.length === 1 ? '' : 's'} this demand&apos;s
          materiality and sourcing require: {missing.join(', ')}
        </p>
      )}
    </div>
  );
}

function FormsSection({
  stage,
  status,
  detail,
  requestId,
  requestCategory,
  request,
}: {
  stage: string;
  status: string;
  detail?: WorkflowStepDetail;
  request?: ProcurementRequest;
  requestId?: string;
  requestCategory?: string;
}) {
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  useFormSubmissions();
  useFormTemplates();
  const { forStage } = useSubmissionLookup();
  const { byId: lookupTemplate, forStage: templatesForStage } = useFormTemplateLookup();
  const currentUser = useAuthStore((s) => s.currentUser);
  const createFormSubmission = useCreateFormSubmission();

  // Pre-populate any form field an admin mapped to a service-description
  // section. DynamicForm has always accepted a prePopulateContext and nothing
  // ever passed one, so the mapping was inert — a risk form on the risk stage
  // asked for scope and deliverables the requester had already given at intake.
  const { data: serviceDescription } = useServiceDescription(requestId);
  // The lookup returns the supplier record; the form wants its name.
  const supplier = useSupplierLookup()(request?.supplierId);

  // Shared with the blocking gate in action-buttons.tsx. It was built inline
  // here and not at all there, which is how the two gates came to disagree
  // about which forms a stage is asking for.
  const triggerContext = useFormTriggerContext(request, requestCategory);
  const policyConfig = usePolicyConfig();
  const prePopulateContext = useMemo(
    () => ({
      // The request half. Every token the Form Builder offers now has a
      // producer — before this only the `sow.` ones did, so an admin could pick
      // "Cost Centre" and get an empty field.
      ...requestPrePopulateValues(request, { supplierName: supplier?.name, sraStatus: supplier?.sraStatus }),
      // The service-description half wins on a key collision: it is the more
      // specific answer, captured for this request at intake.
      ...(serviceDescription
        // Narrowed, not cast: the record also carries a quality score, arrays
        // and objects, and walking those as strings threw at runtime.
        ? sowPrePopulateValues(sectionValuesOf(serviceDescription), serviceDescription.narrative)
        : {}),
    }),
    [serviceDescription, request, supplier],
  );

  // Get actual form submissions for this stage
  const submissions = forStage(requestId, stage);

  // For current steps, the forms this stage is still asking for.
  //
  // One predicate, shared with the advance action's blocking gate — see
  // src/lib/forms/form-triggers.ts. This loop used to evaluate conditions
  // while that gate did not, so a conditional AND blocking template would
  // strand every request in its stage: never rendered, never unlockable.
  const triggeredForms: FormTemplate[] =
    status === 'current'
      ? outstandingForms(
        templatesForStage(stage),
        new Set(submissions.map((s) => s.formTemplateId)),
        stage,
        triggerContext,
        policyConfig,
      )
      : [];

  const handleFormSubmit = useCallback(
    async (form: FormTemplate, values: Record<string, string | string[] | boolean>) => {
      if (!requestId) return;
      const record: FormSubmission = {
        id: `FSUB-${Date.now()}`,
        formTemplateId: form.id,
        formName: form.name,
        requestId,
        stage,
        submittedBy: currentUser.id,
        submittedAt: new Date().toISOString(),
        values,
        status: 'completed',
      };
      try {
        await createFormSubmission.mutateAsync(record);
        setExpandedFormId(null);
        toast.success('Form submitted');
      } catch (err) {
        toast.error(`Could not submit the form: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    },
    [requestId, stage, currentUser.id, createFormSubmission],
  );

  const hasSubmissions = submissions.length > 0;
  const hasTriggeredForms = triggeredForms.length > 0;
  const hasLegacyForms = detail?.formsCompleted && detail.formsCompleted.length > 0;

  if (!hasSubmissions && !hasTriggeredForms && !hasLegacyForms) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-3 uppercase tracking-wide">
        <ClipboardList className="size-3.5" />
        {status === 'current' && hasTriggeredForms ? 'Forms' : 'Forms Completed'}
      </div>

      {/* Actual form submissions (preferred over legacy) */}
      {submissions.map((sub) => {
        const template = lookupTemplate(sub.formTemplateId);
        return (
          <div key={sub.id} className="pl-5">
            <FormSubmissionView submission={sub} template={template} compact />
          </div>
        );
      })}

      {/* Legacy forms (only show if no real submission for this stage) */}
      {!hasSubmissions && hasLegacyForms && detail?.formsCompleted?.map((form, fi) => (
        <div key={fi} className="pl-5 space-y-1">
          <p className="text-sm font-medium text-ink">{form.formName}</p>
          <p className="text-[11px] text-muted-foreground">
            Completed {formatDate(form.completedAt)}
          </p>
          <div className="mt-1 rounded-md border border-line overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {form.fields.map((field, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-card-2' : 'bg-card'}>
                    <td className="px-3 py-1.5 font-medium text-ink-2 w-1/3">
                      {field.label}
                    </td>
                    <td className="px-3 py-1.5 text-ink">{field.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Triggered forms for current step that need completion */}
      {triggeredForms.map((form) => (
        <div key={form.id} className="pl-5 space-y-2">
          <div className="rounded-md border border-warn-line bg-warn-soft/50 p-3">
            <p className="text-sm font-medium text-ink">{form.name}</p>
            <p className="mt-0.5 text-xs text-ink-3">{form.description}</p>
            {expandedFormId === form.id ? (
              <div className="mt-3">
                <DynamicForm
                  template={form}
                  prePopulateContext={prePopulateContext}
                  onSubmit={(values) => handleFormSubmit(form, values)}
                  onCancel={() => setExpandedFormId(null)}
                />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 text-xs"
                onClick={() => setExpandedFormId(form.id)}
              >
                <PenLine className="size-3" />
                Fill Out Form
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
