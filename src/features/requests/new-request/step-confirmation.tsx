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
    catalogueItems?: { itemId: string; name: string; quantity: number; unitPrice: number; supplierId: string }[];
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
        <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="size-8 text-green-600" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Request Submitted Successfully</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your request <span className="font-medium text-gray-700">{requestId}</span> has been submitted for review.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Submission Summary</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {summaryItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-500">{item.label}</span>
              <span className="text-sm font-medium text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Catalogue items breakdown */}
      {data.catalogueItems && data.catalogueItems.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Catalogue Items ({data.catalogueItems.length})</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {data.catalogueItems.map((item) => (
              <div key={item.itemId} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  <span className="text-xs text-gray-400 ml-2">x{item.quantity}</span>
                </div>
                <span className="text-sm text-gray-700">
                  {'\u20AC'}{(item.quantity * item.unitPrice).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">What happens next?</h3>
        {nextSteps.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
            {nextSteps.map((step) => (
              <li key={step.label}>
                <span className="font-medium text-gray-800">{step.label}</span>
                {' — '}{step.system}
                {step.status === 'required' && <span className="text-gray-400"> · required</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            Your request enters its first workflow stage and the assigned owner picks it up.
          </p>
        )}
        <p className="mt-3 text-sm text-gray-600">
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
