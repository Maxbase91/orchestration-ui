import { useMemo } from 'react';
import { Clock, Users as UsersIcon, ShieldCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { WorkflowPreview } from './components/workflow-preview';
import { useWorkflowTemplate } from '@/lib/db/hooks/use-workflow-templates';
import { useApprovalChains } from '@/lib/db/hooks/use-approval-chains';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { useUsers } from '@/lib/db/hooks/use-users';
import { useDerivedApprovers } from '@/lib/db/hooks/use-derived-approvers';
import {
  composeWorkflowSteps,
  selectApprovalChainForValue,
} from '@/lib/workflow/workflow-steps';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { initialsOf } from '@/lib/format';

interface StepRoutingPreviewProps {
  category: string;
  estimatedValue: number;
  /** The workflow template attached to the request (derived from the input). */
  workflowTemplateId: string;
  /** Determination signals that overlay conditional lifecycle steps. */
  riskAssessmentRequired: boolean;
  supplierOnboardingRequired: boolean;
  /** The chosen supplier is outside the category's preferred list. */
  supplierOverride?: boolean;
  additionalReviewers: string[];
  notes: string;
  onUpdate: (data: { additionalReviewers: string[]; notes: string }) => void;
}

/**
 * The Routing step is a PRESENTATION of the determination's config-driven
 * outputs — it holds no policy of its own. The lifecycle comes from the attached
 * workflow template (admin Workflow Designer) plus determination-driven Risk /
 * Onboarding steps; approvals from the admin approval chains banded by value;
 * the SLA from the category configuration; reviewers from the user directory.
 * Nothing here is hardcoded.
 */
export function StepRoutingPreview({
  category,
  estimatedValue,
  workflowTemplateId,
  riskAssessmentRequired,
  supplierOnboardingRequired,
  supplierOverride = false,
  additionalReviewers,
  notes,
  onUpdate,
}: StepRoutingPreviewProps) {
  const { preferredSupplierOverrideNeedsApproval } = usePolicyConfig();
  const { data: detailTemplate } = useWorkflowTemplate(workflowTemplateId || undefined);
  const { data: chains = [] } = useApprovalChains();
  const policyConfig = usePolicyConfig();
  const { data: categories = [] } = useProcurementCategories();
  const { data: users = [] } = useUsers();

  // The template that claims the determined channel (the page resolves it with
  // the rule submit uses). There is no category fallback: the category picked
  // the standard procurement template for nearly everything.
  const template = detailTemplate;

  // Lifecycle ← the attached template's stage nodes + conditional Risk / Onboarding.
  const workflowSteps = useMemo(
    () => composeWorkflowSteps(template?.nodes ?? [], { riskAssessmentRequired, supplierOnboardingRequired }),
    [template, riskAssessmentRequired, supplierOnboardingRequired],
  );

  // Approvers ← the approval chain whose value band covers this spend, each
  // step's functional role resolved to its actionable persona. Duplicate
  // personas (a person wearing two role hats) are merged.
  const approvalChain = useMemo(
    () => selectApprovalChainForValue(chains, estimatedValue, policyConfig),
    [chains, estimatedValue, policyConfig],
  );
  // The approvers this request will actually be given, from the same derivation
  // the write path uses. This used to resolve each step to one of six personas
  // and then dedupe by persona, so a chain whose roles all map to
  // procurement-manager collapsed to a single name — a promise the request did
  // not keep, and the reason the screen could name someone nobody could act as.
  const { data: derived = [] } = useDerivedApprovers(
    // The same derivation submit runs, override step included, so the preview is the promise.
    { requestId: 'preview', category, supplierOverride: supplierOverride && preferredSupplierOverrideNeedsApproval },
    approvalChain?.id,
  );
  const approvers = useMemo(
    () => derived.map((entry) => ({
      id: entry.approverId ?? `role:${entry.role}`,
      name: entry.approverName,
      roles: [entry.role],
    })),
    [derived],
  );

  // Timeline ← the category's configured SLA (admin-editable).
  const matchedCategory = useMemo(
    () => categories.find((c) => c.id === category || c.label.toLowerCase() === category.toLowerCase()),
    [categories, category],
  );

  // Reviewers ← the internal user directory (suppliers excluded).
  const reviewers = useMemo(() => users.filter((u) => u.role !== 'supplier'), [users]);

  const toggleReviewer = (id: string) => {
    const updated = additionalReviewers.includes(id)
      ? additionalReviewers.filter((r) => r !== id)
      : [...additionalReviewers, id];
    onUpdate({ additionalReviewers: updated, notes });
  };

  return (
    <div className="space-y-6">
      {/* Workflow Preview — the lifecycle from the attached template. */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink-2">Workflow Preview</p>
          {template && <p className="text-[11px] text-ink-3">from “{template.name}”</p>}
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          {workflowSteps.length > 0 ? (
            <WorkflowPreview steps={workflowSteps} />
          ) : (
            <p className="text-sm text-ink-3">
              The lifecycle will display once the workflow template is attached.
            </p>
          )}
        </div>
        {(riskAssessmentRequired || supplierOnboardingRequired) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
            <ShieldCheck className="size-3.5" />
            {riskAssessmentRequired && supplierOnboardingRequired
              ? 'A risk assessment and vendor onboarding have been added to the lifecycle.'
              : riskAssessmentRequired
                ? 'A risk assessment has been added to the lifecycle.'
                : 'Vendor onboarding has been added to the lifecycle.'}
          </p>
        )}
      </div>

      {/* Required Approvals — the value-banded approval chain. */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink-2">Required Approvals</p>
          {approvalChain && (
            <p className="text-[11px] text-ink-3">
              {approvalChain.name} chain · {approvalChain.threshold}
            </p>
          )}
        </div>
        {approvers.length > 0 ? (
          <div className="space-y-2">
            {approvers.map((approver, i) => (
              <div
                key={approver.id}
                className="flex items-center justify-between rounded-lg border border-line bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-idle-soft text-xs font-medium text-ink-2">
                    {initialsOf(approver.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{approver.name}</p>
                    <p className="text-xs text-ink-3">{approver.roles.join(' · ')}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  Step {i + 1}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-card-2 px-4 py-3 text-sm text-ink-3">
            No approvals required for this value band.
          </p>
        )}
        {approvers.length > 1 && (
          <p className="mt-2 text-xs text-ink-3">
            Approvals in this chain run in sequence.
          </p>
        )}
      </div>

      {/* Estimated Timeline — the category's configured SLA. */}
      {matchedCategory && (
        <div className="flex items-center gap-3 rounded-lg border border-accent-line bg-accent-soft/60 p-4">
          <Clock className="size-5 text-accent-solid" />
          <div>
            <p className="text-sm font-medium text-ink">Estimated Timeline</p>
            <p className="text-sm text-ink-2">
              {matchedCategory.label} requests target approximately{' '}
              <span className="font-semibold text-accent-solid">{matchedCategory.timelineDays} business days</span>
            </p>
          </div>
        </div>
      )}

      {/* Additional Reviewers — from the user directory. */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <UsersIcon className="size-4 text-ink-3" />
          <p className="text-sm font-medium text-ink-2">Add Reviewers / Watchers</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {reviewers.map((reviewer) => {
            const selected = additionalReviewers.includes(reviewer.id);
            return (
              <button
                key={reviewer.id}
                type="button"
                onClick={() => toggleReviewer(reviewer.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  selected
                    ? 'border-accent-line bg-accent-soft text-accent-solid'
                    : 'border-line bg-card text-ink-2 hover:bg-card-2'
                }`}
              >
                {reviewer.name}
                <span className="text-ink-3">{reviewer.department || reviewer.role}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="approver-notes">Notes for Approvers</Label>
        <Textarea
          id="approver-notes"
          rows={3}
          value={notes}
          onChange={(e) => onUpdate({ additionalReviewers, notes: e.target.value })}
          placeholder="Any additional context for the approval team..."
        />
      </div>
    </div>
  );
}
