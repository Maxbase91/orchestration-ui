import { CheckCircle2, ArrowRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

interface StepConfirmationProps {
  requestId: string;
  /**
   * The steps the determination actually produced, so this screen names the
   * real path rather than a fixed sentence. Same source as the Review step.
   */
  nextSteps?: { label: string; system: string; status: string }[];
  data: {
    title: string;
    category: string;
    supplier: string;
    estimatedValue: number;
    currency: string;
    costCentre: string;
    deliveryDate: string;
    isUrgent: boolean;
    buyingChannelResult: string;
    commodityCodeLabel: string;
  };
  onReset: () => void;
}

export function StepConfirmation({ requestId, data, nextSteps = [], onReset }: StepConfirmationProps) {
  const navigate = useNavigate();

  const summaryItems = [
    { label: 'Request ID', value: requestId },
    { label: 'Title', value: data.title },
    // One row, not two. `Classification` and `Commodity` were both bound to
    // `commodityCodeLabel`, so the same value was listed twice under different
    // names. Broad category values remain internal routing metadata (ADR-0005);
    // the requester sees the specific commodity/service family.
    { label: 'Classification', value: data.commodityCodeLabel || 'Being confirmed' },
    { label: 'Supplier', value: data.supplier || 'Not specified' },
    { label: 'Estimated Value', value: formatCurrency(data.estimatedValue, data.currency) },
    { label: 'Cost Centre', value: data.costCentre || 'Not specified' },
    { label: 'Delivery Date', value: data.deliveryDate || 'Not specified' },
    { label: 'Urgent', value: data.isUrgent ? 'Yes' : 'No' },
    { label: 'Buying Channel', value: data.buyingChannelResult || 'TBD' },
  ];

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="flex flex-col items-center py-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-ok-soft">
          <CheckCircle2 className="size-8 text-ok" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-ink">Request Submitted Successfully</h2>
        <p className="mt-1 text-sm text-ink-3">
          Your request <span className="font-medium text-ink-2">{requestId}</span> has been submitted for review.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border border-line bg-card">
        <div className="border-b border-line-2 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Submission Summary</h3>
        </div>
        <div className="divide-y divide-line-2">
          {summaryItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-ink-3">{item.label}</span>
              <span className="text-sm font-medium text-ink">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What happens next.
          Three sentences were removed here, each of which was untrue:
            - "reviewed by Anna Müller" — a seed persona hardcoded into
              requester-facing copy. The reviewer is whoever the workflow
              assigns, and naming a person the product does not know breaks the
              white-label rule as well as being wrong.
            - "within 2 business days" — a fixed SLA, while the real one comes
              from the category configuration.
            - "You will receive email notifications at each stage transition" —
              nothing sends email anywhere in the product, and no notification
              is created on a stage transition either. A requester who believes
              it stops checking.
          What replaces them is the determination's own handoff steps: the same
          list the Review step showed, so the two screens cannot disagree. */}
      <div className="rounded-lg border border-line bg-card-2 p-4">
        <h3 className="text-sm font-semibold text-ink">What happens next?</h3>
        {nextSteps.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
            {nextSteps.map((step) => (
              <li key={step.label}>
                <span className="font-medium text-ink">{step.label}</span>
                {' — '}{step.system}
                {step.status === 'required' && <span className="text-ink-3"> · required</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            Your request enters its first workflow stage and the assigned owner picks it up.
          </p>
        )}
        <p className="mt-3 text-sm text-ink-2">
          Track progress on the request itself — there is no email alert, so check back here or from
          your dashboard.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <Button
          variant="default"
          onClick={() => navigate(`/requests/${requestId}`)}
        >
          Track this Request
          <ArrowRight className="ml-1 size-4" />
        </Button>
        <Button variant="outline" onClick={onReset}>
          <Plus className="size-4" />
          Submit Another Request
        </Button>
      </div>
    </div>
  );
}
