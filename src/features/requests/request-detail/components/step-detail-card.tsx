import { forwardRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { WorkflowStepDetail } from '@/data/workflow-step-details';
import type { StageHistoryEntry } from '@/data/types';
import { getUserById } from '@/data/users';
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
  MessageSquare,
  Server,
  ClipboardList,
  Timer,
  Shield,
  PenLine,
} from 'lucide-react';
import { systemColors, systemLabels } from '@/data/system-integrations';
import type { ExternalSystem } from '@/data/system-integrations';
import { getSubmissionForStage } from '@/data/form-submissions';
import { getFormTemplate, getFormsForStage } from '@/data/form-templates';
import type { FormTemplate } from '@/data/form-templates';
import { FormSubmissionView } from '@/components/shared/form-submission-view';
import { DynamicForm } from '@/components/shared/dynamic-form';

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
}

const statusConfig: Record<string, { borderClass: string; badgeClass: string; label: string }> = {
  completed: { borderClass: 'border-l-green-500', badgeClass: 'bg-green-100 text-green-700', label: 'Completed' },
  current: { borderClass: 'border-l-amber-500', badgeClass: 'bg-amber-100 text-amber-700', label: 'In Progress' },
  future: { borderClass: 'border-l-gray-300', badgeClass: 'bg-gray-100 text-gray-500', label: 'Pending' },
  skipped: { borderClass: 'border-l-gray-300', badgeClass: 'bg-gray-100 text-gray-400', label: 'Skipped' },
  blocked: { borderClass: 'border-l-red-500', badgeClass: 'bg-red-100 text-red-700', label: 'Blocked' },
};

const outcomeConfig: Record<string, { className: string; label: string }> = {
  approved: { className: 'bg-green-100 text-green-700', label: 'Approved' },
  rejected: { className: 'bg-red-100 text-red-700', label: 'Rejected' },
  'referred-back': { className: 'bg-amber-100 text-amber-700', label: 'Referred Back' },
  escalated: { className: 'bg-purple-100 text-purple-700', label: 'Escalated' },
  completed: { className: 'bg-blue-100 text-blue-700', label: 'Completed' },
};

const slaConfig: Record<string, { className: string; label: string }> = {
  'on-track': { className: 'bg-green-100 text-green-700', label: 'On Track' },
  'at-risk': { className: 'bg-amber-100 text-amber-700', label: 'At Risk' },
  breached: { className: 'bg-red-100 text-red-700', label: 'SLA Breached' },
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
    { stage, stageLabel, status, detail, stageHistory, isExpanded, onToggle, isHighlighted, requestId, requestCategory },
    ref,
  ) {
    const config = statusConfig[status];
    const isFuture = status === 'future' || status === 'skipped';

    // Determine handler info from detail or stage history
    const handler = detail?.handler;
    const historyUser = stageHistory?.ownerId ? getUserById(stageHistory.ownerId) : undefined;
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
                  <p className="text-sm font-medium text-gray-400">{stageLabel}</p>
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
            status === 'current' && 'ring-1 ring-amber-200',
            isHighlighted && 'ring-2 ring-blue-400 shadow-md',
          )}
        >
          {/* Collapsed header - always visible */}
          <button
            type="button"
            onClick={onToggle}
            className="w-full text-left px-4 py-3 hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{stageLabel}</p>
                    <Badge variant="outline" className={config.badgeClass}>
                      {config.label}
                    </Badge>
                    {sysInv && sysKey && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          systemColors[sysKey] ?? 'bg-gray-100 text-gray-700 border-gray-200',
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
                      {handlerRole && <span className="text-gray-400">({handlerRole})</span>}
                    </span>
                    {daysInStep !== undefined && enteredAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {daysInStep} day(s)
                        {completedAt && (
                          <span className="text-gray-400">
                            ({getDurationLabel(enteredAt, completedAt)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {actionSummary && (
                    <p className="mt-1 text-xs text-gray-600 truncate">{actionSummary}</p>
                  )}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="size-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="size-4 text-gray-400 shrink-0" />
              )}
            </div>
          </button>

          {/* Expanded detail */}
          {isExpanded && (
            <CardContent className="pt-0 pb-4 px-4 space-y-4">
              <Separator />

              {/* Handler section */}
              {handler && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <User className="size-3.5" />
                    Handler
                  </div>
                  <div className="flex items-center gap-3 pl-5">
                    <div className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                      {handler.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{handler.name}</p>
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
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Shield className="size-3.5" />
                    Decision
                  </div>
                  <div className="pl-5 space-y-2">
                    <Badge
                      variant="outline"
                      className={
                        outcomeConfig[detail.decision.outcome]?.className ??
                        'bg-gray-100 text-gray-700'
                      }
                    >
                      {outcomeConfig[detail.decision.outcome]?.label ?? detail.decision.outcome}
                    </Badge>
                    {detail.decision.reason && (
                      <p className="text-sm text-gray-700">{detail.decision.reason}</p>
                    )}
                    {detail.decision.conditions && detail.decision.conditions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Conditions:</p>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
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
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Server className="size-3.5" />
                    System Integration
                  </div>
                  <div className="pl-5 rounded-md bg-gray-50 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {sysInv.systemLabel}
                      </span>
                      {sysInv.referenceId && (
                        <Badge variant="outline" className="text-[10px] bg-white">
                          {sysInv.referenceId}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">Status: {sysInv.status}</p>
                    <p className="text-xs text-gray-600">{sysInv.detail}</p>
                  </div>
                </div>
              )}

              {/* Forms Completed - Enhanced with FormSubmission data */}
              <FormsSection
                stage={stage}
                status={status}
                detail={detail}
                requestId={requestId}
                requestCategory={requestCategory}
              />

              {/* Documents Added */}
              {detail?.documentsAdded && detail.documentsAdded.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <FileText className="size-3.5" />
                    Documents Added
                  </div>
                  <div className="pl-5 space-y-1.5">
                    {detail.documentsAdded.map((doc, di) => (
                      <div
                        key={di}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <FileText className="size-3.5 text-gray-400 shrink-0" />
                        <span className="font-medium">{doc.name}</span>
                        <Badge variant="outline" className="text-[10px] bg-gray-50">
                          {doc.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {doc.addedBy} &middot; {formatDate(doc.addedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              {detail?.comments && detail.comments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <MessageSquare className="size-3.5" />
                    Comments
                  </div>
                  <div className="pl-5 space-y-2">
                    {detail.comments.map((comment, ci) => (
                      <div
                        key={ci}
                        className={cn(
                          'rounded-md p-3 text-sm',
                          comment.isInternal
                            ? 'bg-amber-50 border border-amber-100'
                            : 'bg-gray-50 border border-gray-100',
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{comment.author}</span>
                          {comment.isInternal && (
                            <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                              Internal
                            </Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground ml-auto">
                            {formatDate(comment.timestamp)}
                          </span>
                        </div>
                        <p className="text-gray-700">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duration & SLA */}
              {detail?.duration && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Timer className="size-3.5" />
                    Duration & SLA
                  </div>
                  <div className="pl-5 flex items-center gap-4 text-sm text-gray-700">
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
                        slaConfig[detail.slaStatus]?.className ?? 'bg-gray-100 text-gray-700'
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
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{stageHistory.notes}</p>
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

function FormsSection({
  stage,
  status,
  detail,
  requestId,
  requestCategory,
}: {
  stage: string;
  status: string;
  detail?: WorkflowStepDetail;
  requestId?: string;
  requestCategory?: string;
}) {
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [submittedForms, setSubmittedForms] = useState<Set<string>>(new Set());

  // Get actual form submissions for this stage
  const submissions = requestId ? getSubmissionForStage(requestId, stage) : [];

  // For current steps, check for triggered forms that haven't been submitted
  const triggeredForms: FormTemplate[] = [];
  if (status === 'current') {
    const allFormsForStage = getFormsForStage(stage);
    for (const form of allFormsForStage) {
      // Check trigger conditions
      if (form.triggerConditions && form.triggerConditions.length > 0) {
        const conditionMet = form.triggerConditions.some((cond) => {
          if (cond.field === 'category' && cond.operator === 'equals') {
            return requestCategory === cond.value;
          }
          return true;
        });
        if (!conditionMet) continue;
      }
      // Check if already submitted
      const alreadySubmitted = submissions.some((s) => s.formTemplateId === form.id);
      if (!alreadySubmitted && !submittedForms.has(form.id)) {
        triggeredForms.push(form);
      }
    }
  }

  const handleFormSubmit = useCallback(
    (formId: string) => {
      setSubmittedForms((prev) => new Set([...prev, formId]));
      setExpandedFormId(null);
      toast.success('Form submitted');
    },
    [],
  );

  const hasSubmissions = submissions.length > 0;
  const hasTriggeredForms = triggeredForms.length > 0;
  const hasLegacyForms = detail?.formsCompleted && detail.formsCompleted.length > 0;

  if (!hasSubmissions && !hasTriggeredForms && !hasLegacyForms) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <ClipboardList className="size-3.5" />
        {status === 'current' && hasTriggeredForms ? 'Forms' : 'Forms Completed'}
      </div>

      {/* Actual form submissions (preferred over legacy) */}
      {submissions.map((sub) => {
        const template = getFormTemplate(sub.formTemplateId);
        return (
          <div key={sub.id} className="pl-5">
            <FormSubmissionView submission={sub} template={template} compact />
          </div>
        );
      })}

      {/* Legacy forms (only show if no real submission for this stage) */}
      {!hasSubmissions && hasLegacyForms && detail?.formsCompleted?.map((form, fi) => (
        <div key={fi} className="pl-5 space-y-1">
          <p className="text-sm font-medium text-gray-800">{form.formName}</p>
          <p className="text-[11px] text-muted-foreground">
            Completed {formatDate(form.completedAt)}
          </p>
          <div className="mt-1 rounded-md border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {form.fields.map((field, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-1.5 font-medium text-gray-600 w-1/3">
                      {field.label}
                    </td>
                    <td className="px-3 py-1.5 text-gray-900">{field.value}</td>
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
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
            <p className="text-sm font-medium text-gray-800">{form.name}</p>
            <p className="mt-0.5 text-xs text-gray-500">{form.description}</p>
            {expandedFormId === form.id ? (
              <div className="mt-3">
                <DynamicForm
                  template={form}
                  onSubmit={() => handleFormSubmit(form.id)}
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
