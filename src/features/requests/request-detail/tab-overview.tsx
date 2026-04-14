import { useState } from 'react';
import { FileText, Copy, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { ProcurementRequest } from '@/data/types';
import { getUserById } from '@/data/users';
import { getSupplierById } from '@/data/suppliers';
import { formatCurrency, formatDate } from '@/lib/format';
import { getAISummary } from '@/lib/mock-ai';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { ComplianceReportCard } from '@/components/shared/compliance-report-card';
import { getComplianceReport } from '@/data/compliance-reports';
import { getServiceDescription } from '@/data/service-descriptions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const BUYING_CHANNEL_LABELS: Record<string, string> = {
  'procurement-led': 'Procurement-Led',
  'business-led': 'Business-Led',
  'direct-po': 'Direct PO',
  'framework-call-off': 'Framework Call-Off',
  'catalogue': 'Catalogue',
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

interface TabOverviewProps {
  request: ProcurementRequest;
}

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 last:border-b-0">
      <dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900">{value ?? '-'}</dd>
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
  const requestor = getUserById(request.requestorId);
  const owner = getUserById(request.ownerId);
  const supplier = request.supplierId ? getSupplierById(request.supplierId) : undefined;
  const summary = getAISummary('request', request.id);
  const complianceReport = getComplianceReport(request.id);
  const svcDesc = getServiceDescription(request.id);
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
                <DetailRow label="Supplier" value={supplier?.name} />
                <DetailRow label="Value" value={formatCurrency(request.value, request.currency)} />
                <DetailRow label="Buying Channel" value={BUYING_CHANNEL_LABELS[request.buyingChannel] ?? request.buyingChannel} />
                <DetailRow label="Commodity Code" value={`${request.commodityCode} - ${request.commodityCodeLabel}`} />
                <DetailRow label="Cost Centre" value={request.costCentre} />
                <DetailRow label="Budget Owner" value={request.budgetOwner} />
                <DetailRow label="Requestor" value={requestor?.name} />
                <DetailRow label="Current Owner" value={owner?.name} />
                <DetailRow label="Delivery Date" value={formatDate(request.deliveryDate)} />
                <DetailRow label="Created" value={formatDate(request.createdAt)} />
                <DetailRow label="Last Updated" value={formatDate(request.updatedAt)} />
                <DetailRow label="Days in Stage" value={String(request.daysInStage)} />
              </dl>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-muted-foreground mb-1">Business Justification</p>
                <p className="text-sm text-gray-700">{request.businessJustification}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <AISuggestionCard title="Request Summary" confidence={0.92}>
            <p>{summary}</p>
          </AISuggestionCard>
          {complianceReport && (
            <div className="mt-4">
              <ComplianceReportCard report={complianceReport} />
            </div>
          )}
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
                <FileText className="size-4 text-[#2D5F8A]" />
                <CardTitle className="text-base">Service Description</CardTitle>
                {sowExpanded ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
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
                  const value = svcDesc[key as keyof typeof svcDesc];
                  if (!value || key === 'narrative') return null;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="size-3.5 text-green-500 shrink-0" />
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed pl-5">{value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Narrative Summary */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Narrative Summary</p>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{svcDesc.narrative}</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
