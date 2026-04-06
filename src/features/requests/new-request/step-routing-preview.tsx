import { Clock, Users as UsersIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { WorkflowPreview } from './components/workflow-preview';

const AVAILABLE_REVIEWERS = [
  { id: 'r1', name: 'Thomas Weber', role: 'Finance Director' },
  { id: 'r2', name: 'Anna Muller', role: 'Legal Counsel' },
  { id: 'r3', name: 'Robert Fischer', role: 'IT Director' },
  { id: 'r4', name: 'Dr. Katrin Bauer', role: 'Compliance Officer' },
  { id: 'r5', name: 'Markus Braun', role: 'Category Manager' },
];

interface StepRoutingPreviewProps {
  category: string;
  estimatedValue: number;
  additionalReviewers: string[];
  notes: string;
  onUpdate: (data: { additionalReviewers: string[]; notes: string }) => void;
}

function getWorkflowSteps(category: string, value: number) {
  const steps = [
    { label: 'Intake Review', owner: 'System', parallel: false },
    { label: 'Validation', owner: 'Category Manager', parallel: false },
  ];

  if (value > 100000) {
    steps.push({ label: 'VP Approval', owner: 'VP Procurement', parallel: false });
  }

  steps.push({ label: 'Budget Approval', owner: 'Finance', parallel: value > 100000 });

  if (category === 'consulting' || category === 'services') {
    steps.push({ label: 'Sourcing', owner: 'Procurement Lead', parallel: false });
  }

  steps.push({ label: 'Contracting', owner: 'Legal', parallel: false });
  steps.push({ label: 'PO Creation', owner: 'System', parallel: false });

  return steps;
}

function getApprovers(_category: string, value: number) {
  const approvers: { name: string; role: string; type: 'sequential' | 'parallel' }[] = [
    { name: 'James Chen', role: 'Category Manager', type: 'sequential' },
  ];

  if (value > 25000) {
    approvers.push({ name: 'Sarah Mitchell', role: 'Budget Owner', type: 'parallel' });
  }

  if (value > 100000) {
    approvers.push({ name: 'Dr. Klaus Richter', role: 'VP Procurement', type: 'sequential' });
  }

  if (value > 500000) {
    approvers.push({ name: 'Maria Hoffmann', role: 'CFO', type: 'sequential' });
  }

  return approvers;
}

function getEstimatedTimeline(category: string, value: number): number {
  let days = 5;
  if (category === 'consulting') days += 5;
  if (category === 'services') days += 3;
  if (value > 100000) days += 4;
  if (value > 500000) days += 3;
  return days;
}

export function StepRoutingPreview({
  category,
  estimatedValue,
  additionalReviewers,
  notes,
  onUpdate,
}: StepRoutingPreviewProps) {
  const workflowSteps = getWorkflowSteps(category, estimatedValue);
  const approvers = getApprovers(category, estimatedValue);
  const estimatedDays = getEstimatedTimeline(category, estimatedValue);

  const toggleReviewer = (id: string) => {
    const updated = additionalReviewers.includes(id)
      ? additionalReviewers.filter((r) => r !== id)
      : [...additionalReviewers, id];
    onUpdate({ additionalReviewers: updated, notes });
  };

  return (
    <div className="space-y-6">
      {/* Workflow Preview */}
      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">Workflow Preview</p>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <WorkflowPreview steps={workflowSteps} />
        </div>
      </div>

      {/* Required Approvals */}
      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">Required Approvals</p>
        <div className="space-y-2">
          {approvers.map((approver) => (
            <div
              key={approver.name}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                  {approver.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{approver.name}</p>
                  <p className="text-xs text-gray-500">{approver.role}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {approver.type}
              </Badge>
            </div>
          ))}
        </div>
        {approvers.some((a) => a.type === 'parallel') && (
          <p className="mt-2 text-xs text-gray-500">
            Parallel approvals run simultaneously, reducing overall cycle time.
          </p>
        )}
      </div>

      {/* Estimated Timeline */}
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
        <Clock className="size-5 text-blue-500" />
        <div>
          <p className="text-sm font-medium text-gray-900">Estimated Timeline</p>
          <p className="text-sm text-gray-600">
            Based on similar requests, approximately{' '}
            <span className="font-semibold text-blue-700">{estimatedDays} business days</span>
          </p>
        </div>
      </div>

      {/* Additional Reviewers */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <UsersIcon className="size-4 text-gray-500" />
          <p className="text-sm font-medium text-gray-700">Add Reviewers / Watchers</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_REVIEWERS.map((reviewer) => {
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
                <span className="text-gray-400">{reviewer.role}</span>
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
