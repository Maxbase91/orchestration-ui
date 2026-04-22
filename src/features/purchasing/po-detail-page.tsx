import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { ProcessStepper, type Step } from '@/components/shared/process-stepper';
import { usePurchaseOrder } from '@/lib/db/hooks/use-purchase-orders';
import { formatCurrency, formatDate } from '@/lib/format';
import { GoodsReceiptForm } from './components/goods-receipt-form';
import { useComplianceReport } from '@/lib/db/hooks/use-compliance-reports';
import { ComplianceReportCard } from '@/components/shared/compliance-report-card';

const poStages = ['draft', 'submitted', 'acknowledged', 'received', 'closed'] as const;

function getSteps(currentStatus: string): Step[] {
  const stageIndex = poStages.indexOf(currentStatus as typeof poStages[number]);
  return poStages.map((stage, i) => ({
    id: stage,
    label: stage.charAt(0).toUpperCase() + stage.slice(1),
    status: i < stageIndex ? 'completed' : i === stageIndex ? 'current' : 'future',
  }));
}

export function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: po } = usePurchaseOrder(id);
  const { data: complianceReport } = useComplianceReport(po?.requestId);

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-muted-foreground">Purchase order not found.</p>
        <Button variant="outline" onClick={() => navigate('/purchasing/orders')}>
          <ArrowLeft className="size-4" />
          Back to POs
        </Button>
      </div>
    );
  }

  const effectiveStatus = po.status === 'partially-received' ? 'received' : po.status;
  const steps = getSteps(effectiveStatus);

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate('/purchasing/orders')}
      >
        <ArrowLeft className="size-3.5" />
        Back to Purchase Orders
      </Button>

      <PageHeader
        title={po.id}
        subtitle={po.supplierName}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={po.status} />
            <span className="text-sm text-muted-foreground">{formatCurrency(po.value)}</span>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <ProcessStepper steps={steps} />
        </CardContent>
      </Card>

      {complianceReport && (
        <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <ComplianceReportCard report={complianceReport} defaultExpanded />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="py-2 text-center font-medium text-muted-foreground w-20">Qty</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-28">Unit Price</th>
                <th className="py-2 text-center font-medium text-muted-foreground w-24">Received</th>
                <th className="py-2 text-right font-medium text-muted-foreground w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.lineItems.map((li, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{li.description}</td>
                  <td className="py-2 text-center">{li.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(li.unitPrice)}</td>
                  <td className="py-2 text-center">
                    <span className={li.received >= li.quantity ? 'text-green-700' : li.received > 0 ? 'text-amber-700' : 'text-muted-foreground'}>
                      {li.received}/{li.quantity}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium">{formatCurrency(li.quantity * li.unitPrice)}</td>
                </tr>
              ))}
              <tr className="border-t-2">
                <td className="py-2 font-semibold" colSpan={4}>Total</td>
                <td className="py-2 text-right font-semibold">{formatCurrency(po.value)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {po.status !== 'closed' && (
        <GoodsReceiptForm lineItems={po.lineItems} />
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(po.createdAt)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Delivery Date</span><span>{formatDate(po.deliveryDate)}</span></div>
          {po.contractId && <div className="flex justify-between"><span className="text-muted-foreground">Contract</span><span className="text-blue-600 cursor-pointer" onClick={() => navigate(`/contracts/${po.contractId}`)}>{po.contractId}</span></div>}
          {po.requestId && <div className="flex justify-between"><span className="text-muted-foreground">Request</span><span>{po.requestId}</span></div>}
        </CardContent>
      </Card>
    </div>
  );
}
