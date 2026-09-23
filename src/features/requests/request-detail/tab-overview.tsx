import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Copy, CheckCircle, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { ProcurementRequest } from '@/data/types';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useSupplierLookup, useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { formatCurrency, formatDate } from '@/lib/format';
import { getAISummary } from '@/lib/mock-ai';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { useServiceDescription } from '@/lib/db/hooks/use-service-descriptions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const BUYING_CHANNEL_LABELS: Record<string, string> = {
  'procurement-led': 'Procurement-Led',
  'business-led': 'Business-Led',
  'direct-po': 'Direct PO',
  'framework-call-off': 'Framework Call-Off',
  'catalogue': 'Catalogue',
  'p-card': 'P-card route',
};

const CATEGORY_LABELS: Record<string, string> = {
  goods: 'Goods',
  services: 'Services',
  software: 'Software',
  consulting: 'Consulting',
  'contingent-labour': 'Contingent Labour',
  'contract-renewal': 'Contract Renewal',
  'supplier-onboarding': 'Supplier Onboarding',
};

// The sourcing route determined at intake. Requests created before this was
// persisted have no value, so the row renders '-' rather than being hidden —
// consistent with every other DetailRow.
const SOURCING_TYPE_LABELS: Record<string, string> = {
  'new-event': 'New Event',
  renewal: 'Renewal',
  benchmarking: 'Benchmarking',
  none: 'None',
};

interface TabOverviewProps {
  request: ProcurementRequest;
}

function DetailRow({
  label,
  value,
  to,
}: {
  label: string;
  value: string | undefined;
  /** When set and `value` is present, renders the value as a link (e.g. to the
   *  supplier's full 360 profile) instead of plain text. */
  to?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-line-2 last:border-b-0">
      <dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-ink">
        {value && to ? (
          <Link to={to} className="text-accent-solid hover:underline">
            {value}
          </Link>
        ) : (
          value ?? '-'
        )}
      </dd>
    </div>
  );
}

const SOW_LABELS: Record<string, string> = {
  objective: 'Objective',
  scope: 'Scope of Work',
  deliverables: 'Deliverables',
  timeline: 'Timeline',
  resources: 'Resources',
  acceptanceCriteria: 'Acceptance Criteria',
  pricingModel: 'Pricing Model',
  location: 'Location',
  dependencies: 'Dependencies',
};

export function TabOverview({ request }: TabOverviewProps) {
  const suppliersQuery = useSuppliers();
  useUsers();
  const lookupSupplier = useSupplierLookup();
  const lookupUser = useUserLookup();
  const requestor = lookupUser(request.requestorId);
  const owner = lookupUser(request.ownerId);
  const supplier = lookupSupplier(request.supplierId);
  const summary = getAISummary('request', request.id);
  const { data: svcDesc } = useServiceDescription(request.id);
  const [sowExpanded, setSowExpanded] = useState(true);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-0">
                <DetailRow label="Category" value={CATEGORY_LABELS[request.category] ?? request.category} />
                <DetailRow
                  label="Supplier"
                  value={supplier?.name ?? (suppliersQuery.isLoading && request.supplierId ? 'Loading supplier…' : undefined)}
                  to={supplier ? `/suppliers/${supplier.id}` : undefined}
                />
                <DetailRow label="Value" value={formatCurrency(request.value, request.currency)} />
                <DetailRow label="Buying Channel" value={BUYING_CHANNEL_LABELS[request.buyingChannel] ?? request.buyingChannel} />
                <DetailRow
                  label="Sourcing Type"
                  value={
                    request.sourcingType
                      ? SOURCING_TYPE_LABELS[request.sourcingType] ?? request.sourcingType
                      : undefined
                  }
                />
                <DetailRow label="Commodity / service family" value={`${request.commodityCode} - ${request.commodityCodeLabel}`} />
                <DetailRow label="Cost Centre" value={request.costCentre} />
                <DetailRow label="Budget Owner" value={request.budgetOwner} />
                <DetailRow label="Requestor" value={requestor?.name} />
                {request.requesterCountry && (
                  <DetailRow label="Requester Location" value={request.requesterCountry} />
                )}
                <DetailRow
                  label="Buying For"
                  value={
                    request.beneficiaryId && request.beneficiaryId !== request.requestorId
                      ? `${request.beneficiaryName ?? 'Someone else'}${request.beneficiaryCountry ? ` · ${request.beneficiaryCountry}` : ''}`
                      : `${requestor?.name ?? 'Requestor'} (self)`
                  }
                />
                <DetailRow label="Current Owner" value={owner?.name} />
                <DetailRow label="Delivery Date" value={formatDate(request.deliveryDate)} />
                <DetailRow label="Created" value={formatDate(request.createdAt)} />
                <DetailRow label="Last Updated" value={formatDate(request.updatedAt)} />
                <DetailRow label="Days in Stage" value={String(request.daysInStage)} />
              </dl>
              {!svcDesc?.narrative && request.businessJustification && <div className="mt-4 pt-4 border-t border-line-2"><p className="text-sm font-medium text-muted-foreground mb-1">Request description</p><p className="text-sm text-ink-2">{request.businessJustification}</p></div>}
            </CardContent>
          </Card>
        </div>
        <div>
          <AISuggestionCard title="Request Summary">
            <p>{summary}</p>
          </AISuggestionCard>
          {/* Compliance report moved to the Workflow tab's approval
              stage card to avoid duplicating content across tabs. */}
        </div>
      </div>

      {/* Service Description / SOW */}
      {svcDesc && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSowExpanded(!sowExpanded)}
                className="flex items-center gap-2 text-left"
              >
                <FileText className="size-4 text-accent" />
                <CardTitle className="text-base">Service Description</CardTitle>
                {(svcDesc as unknown as Record<string, unknown>).quality_score !== undefined && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ml-1 ${
                    ((svcDesc as unknown as Record<string, unknown>).quality_score as number) >= 80 ? 'bg-ok-soft text-ok' :
                    ((svcDesc as unknown as Record<string, unknown>).quality_score as number) >= 60 ? 'bg-warn-soft text-warn' :
                    'bg-stop-soft text-stop'
                  }`}>
                    <ShieldCheck className="size-3" />
                    {((svcDesc as unknown as Record<string, unknown>).quality_score as number)}/100
                  </span>
                )}
                {sowExpanded ? <ChevronUp className="size-4 text-ink-3" /> : <ChevronDown className="size-4 text-ink-3" />}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(svcDesc.narrative);
                  toast.success('Narrative copied to clipboard');
                }}
              >
                <Copy className="size-3.5" />
                Copy Summary
              </Button>
            </div>
          </CardHeader>
          {sowExpanded && (
            <CardContent className="space-y-4">
              {/* Structured Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(SOW_LABELS).map(([key, label]) => {
                  // SOW_LABELS names only the text sections; the record also
                  // carries the quality gate and the signals, which are not
                  // section bodies and must not be rendered as one.
                  const value = svcDesc[key as keyof typeof svcDesc];
                  if (typeof value !== 'string' || !value || key === 'narrative') return null;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="size-3.5 text-ok shrink-0" />
                        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">{label}</p>
                      </div>
                      <p className="text-sm text-ink-2 leading-relaxed pl-5">{value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Narrative Summary */}
              <div className="pt-4 border-t border-line-2">
                <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">Narrative Summary</p>
                <div className="rounded-lg bg-card-2 border border-line p-4">
                  <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">{svcDesc.narrative}</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
