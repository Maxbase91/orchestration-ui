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
import { resolveApprover } from '@/lib/workflow/approver-resolution';
import { composeWorkflowSteps, selectApprovalChainForValue } from '@/lib/workflow/workflow-steps';

interface StepRoutingPreviewProps {
  category: string;
  estimatedValue: number;
  /** The workflow template attached to the request (derived from the input). */
  workflowTemplateId: string;
  /** Determination signals that overlay conditional lifecycle steps. */
  riskAssessmentRequired: boolean;
  supplierOnboardingRequired: boolean;
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
  additionalReviewers,
  notes,
  onUpdate,
}: StepRoutingPreviewProps) {
  const { data: template } = useWorkflowTemplate(workflowTemplateId || undefined);
  const { data: chains = [] } = useApprovalChains();
  const { data: categories = [] } = useProcurementCategories();
  const { data: users = [] } = useUsers();

  // Lifecycle ← the attached template's stage nodes + conditional Risk / Onboarding.
  const workflowSteps = useMemo(
    () => composeWorkflowSteps(template?.nodes ?? [], { riskAssessmentRequired, supplierOnboardingRequired }),
    [template, riskAssessmentRequired, supplierOnboardingRequired],
  );

  // Approvers ← the approval chain whose value band covers this spend, each
  // step's functional role resolved to its actionable persona. Duplicate
  // personas (a person wearing two role hats) are merged.
  const approvalChain = useMemo(
    () => selectApprovalChainForValue(chains, estimatedValue),
    [chains, estimatedValue],
  );
  const approvers = useMemo(() => {
    const out: { id: string; name: string; roles: string[] }[] = [];
    for (const step of approvalChain?.steps ?? []) {
      const resolved = resolveApprover(step.role);
      const existing = out.find((a) => a.id === resolved.id);
      if (existing) existing.roles.push(step.role);
      else out.push({ id: resolved.id, name: resolved.name, roles: [step.role] });
    }
    return out;
  }, [approvalChain]);

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
          <p className="text-sm font-medium text-gray-700">Workflow Preview</p>
          {template && <p className="text-[11px] text-gray-400">from “{template.name}”</p>}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {workflowSteps.length > 0 ? (
            <WorkflowPreview steps={workflowSteps} />
          ) : (
            <p className="text-sm text-gray-400">
              The lifecycle will display once the workflow template is attached.
            </p>
          )}
        </div>
        {(riskAssessmentRequired || supplierOnboardingRequired) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
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
          <p className="text-sm font-medium text-gray-700">Required Approvals</p>
          {approvalChain && (
            <p className="text-[11px] text-gray-400">
              {approvalChain.name} chain · {approvalChain.threshold}
            </p>
          )}
        </div>
        {approvers.length > 0 ? (
          <div className="space-y-2">
            {approvers.map((approver, i) => (
              <div
                key={approver.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {approver.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{approver.name}</p>
                    <p className="text-xs text-gray-500">{approver.roles.join(' · ')}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  Step {i + 1}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            No approvals required for this value band.
          </p>
        )}
        {approvers.length > 1 && (
          <p className="mt-2 text-xs text-gray-500">
            Approvals in this chain run in sequence.
          </p>
        )}
      </div>

      {/* Estimated Timeline — the category's configured SLA. */}
      {matchedCategory && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <Clock className="size-5 text-blue-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">Estimated Timeline</p>
            <p className="text-sm text-gray-600">
              {matchedCategory.label} requests target approximately{' '}
              <span className="font-semibold text-blue-700">{matchedCategory.timelineDays} business days</span>
            </p>
          </div>
        </div>
      )}

      {/* Additional Reviewers — from the user directory. */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <UsersIcon className="size-4 text-gray-500" />
          <p className="text-sm font-medium text-gray-700">Add Reviewers / Watchers</p>
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
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {reviewer.name}
                <span className="text-gray-400">{reviewer.department || reviewer.role}</span>
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
