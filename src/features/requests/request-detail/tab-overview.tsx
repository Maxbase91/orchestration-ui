import type { ProcurementRequest } from '@/data/types';
import { getUserById } from '@/data/users';
import { getSupplierById } from '@/data/suppliers';
import { formatCurrency, formatDate } from '@/lib/format';
import { getAISummary } from '@/lib/mock-ai';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { ComplianceReportCard } from '@/components/shared/compliance-report-card';
import { getComplianceReport } from '@/data/compliance-reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DEUBA_LABELS: Record<string, string> = {
  'gp-led': 'GP-Led',
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

export function TabOverview({ request }: TabOverviewProps) {
  const requestor = getUserById(request.requestorId);
  const owner = getUserById(request.ownerId);
  const supplier = request.supplierId ? getSupplierById(request.supplierId) : undefined;
  const summary = getAISummary('request', request.id);
  const complianceReport = getComplianceReport(request.id);

  return (
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
              <DetailRow label="DEUBA / Buying Channel" value={DEUBA_LABELS[request.deuba] ?? request.deuba} />
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
  );
}
