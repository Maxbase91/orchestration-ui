// Purchase order detail page: lifecycle stepper, line items with received
// quantities, inline goods-receipt capture and links back to the originating
// contract/request. The compliance report card surfaces the request's checks.
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
import { useCreateGoodsReceipt } from '@/lib/db/hooks/use-goods-receipts';
import { useRequisitionForRequest } from '@/lib/db/hooks/use-purchase-requisitions';
import { useRequestLinesForRequest } from '@/lib/db/hooks/use-request-lines';
import { useUserLookup } from '@/lib/db/hooks/use-users';
import { orderReadiness } from '@/lib/procurement/order-readiness';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

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
  const currentUser = useAuthStore((state) => state.currentUser);
  const createReceipt = useCreateGoodsReceipt();
  const { data: lines = [] } = useRequestLinesForRequest(po?.requestId);
  const { data: requisition } = useRequisitionForRequest(po?.requestId);
  const owner = useUserLookup()(po?.ownerId);
  const readiness = orderReadiness(
    {
      currency: requisition?.currency,
      supplierId: po?.supplierId,
      costCentre: requisition?.costCentre ?? po?.costCentre,
      shipToLocationId: requisition?.shipToLocationId ?? po?.shipToLocationId,
    },
    lines.map((line) => ({
      lineNumber: line.lineNumber,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      supplierPartId: line.supplierPartId,
      unitOfMeasureCode: line.unitOfMeasureCode,
      commodityCode: line.commodityCode,
    })),
  );

  /**
   * Record what actually arrived.
   *
   * A receipt covering every ordered quantity is complete and moves the request
   * out of `po`; anything less leaves it there and marks the PO partially
   * received. The quantities already say which it is, so nobody is asked.
   */
  async function handleReceipt(received: number[]) {
    if (!po) return;
    const lineItems = po.lineItems.map((line, index) => ({
      ...line,
      received: received[index] ?? line.received,
    }));
    const complete = lineItems.every((line) => Number(line.received) >= Number(line.quantity));
    try {
      await createReceipt.mutateAsync({
        poId: po.id,
        requestId: po.requestId,
        receivedBy: currentUser.name,
        receivedAt: new Date().toISOString(),
        notes: '',
        lineItems,
        status: complete ? 'complete' : 'partial',
      });
      toast.success(complete
        ? `Receipt recorded in full${po.requestId ? ` — ${po.requestId} has moved on.` : '.'}`
        : 'Partial receipt recorded. The request stays open until the rest arrives.');
    } catch (error) {
      toast.error(`Could not record the receipt: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

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

  // The stepper has no partial stage; a partially received PO sits on the
  // 'received' step (the badge above still shows the exact status).
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
                    <span className={li.received >= li.quantity ? 'text-ok' : li.received > 0 ? 'text-warn' : 'text-muted-foreground'}>
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

      {/* Whether this order could actually be handed off. A downstream system
          rejects a line without a part number, a unit-of-measure code or a
          classification, and the first anyone knew of that was at the boundary. */}
      {!readiness.ready && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-warn">Not ready to hand off</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {readiness.gaps.map((gap, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">
                  {gap.line === null ? 'Order' : `Line ${gap.line}`}
                </span>
                <span><span className="font-medium">{gap.field}</span> — {gap.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {po.status !== 'closed' && (
        <GoodsReceiptForm
          lineItems={po.lineItems}
          saving={createReceipt.isPending}
          onConfirm={handleReceipt}
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(po.createdAt)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Delivery Date</span><span>{formatDate(po.deliveryDate)}</span></div>
          {po.contractId && <div className="flex justify-between"><span className="text-muted-foreground">Contract</span><span className="text-accent-solid cursor-pointer" onClick={() => navigate(`/contracts/${po.contractId}`)}>{po.contractId}</span></div>}
          {po.requestId && <div className="flex justify-between"><span className="text-muted-foreground">Request</span><span>{po.requestId}</span></div>}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Owner</span>
            <span>{owner?.name ?? po.ownerName ?? <span className="text-muted-foreground">Unassigned</span>}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
