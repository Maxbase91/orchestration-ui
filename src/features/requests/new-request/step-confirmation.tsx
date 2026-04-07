import { CheckCircle2, ArrowRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { formatCurrency } from '@/lib/format';

interface StepConfirmationProps {
  requestId: string;
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

const CATEGORY_LABELS: Record<string, string> = {
  goods: 'Goods',
  services: 'Services',
  software: 'Software / IT',
  consulting: 'Consulting',
  'contingent-labour': 'Contingent Labour',
  'contract-renewal': 'Contract Renewal',
  'supplier-onboarding': 'Supplier Onboarding',
  'catalogue': 'Catalogue Purchase',
};

export function StepConfirmation({ requestId, data, onReset }: StepConfirmationProps) {
  const navigate = useNavigate();

  const summaryItems = [
    { label: 'Request ID', value: requestId },
    { label: 'Title', value: data.title },
    { label: 'Category', value: CATEGORY_LABELS[data.category] ?? data.category },
    { label: 'Supplier', value: data.supplier || 'Not specified' },
    { label: 'Estimated Value', value: formatCurrency(data.estimatedValue, data.currency) },
    { label: 'Cost Centre', value: data.costCentre || 'Not specified' },
    { label: 'Delivery Date', value: data.deliveryDate || 'Not specified' },
    { label: 'Urgent', value: data.isUrgent ? 'Yes' : 'No' },
    { label: 'Buying Channel', value: data.buyingChannelResult || 'TBD' },
    { label: 'Commodity', value: data.commodityCodeLabel || 'Not specified' },
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

      {/* Next steps */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">What happens next?</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
          <li>
            Your request will be reviewed by <span className="font-medium">James Chen</span> within{' '}
            <span className="font-medium">2 business days</span>.
          </li>
          <li>You will receive email notifications at each stage transition.</li>
          <li>You can track progress from your dashboard or the request detail page.</li>
        </ul>
      </div>

      {/* AI follow-up */}
      <AISuggestionCard
        title="Stay informed"
        confidence={96}
        onAccept={() => {
          // Mock accept - in real app would set up notification
        }}
        onDismiss={() => {}}
      >
        <p>
          Would you like me to notify you when this request reaches the approval stage? I can also
          alert you if any compliance issues arise during processing.
        </p>
      </AISuggestionCard>

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
