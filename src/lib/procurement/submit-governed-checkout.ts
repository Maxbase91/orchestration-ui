// Application seam for request -> requisition -> conditional internal PO.
// Callers must run evaluateGovernedCheckout first; no upstream system is called.
import type { PurchaseOrder, PurchaseRequisition, RequestLine } from '@/data/types';
import { createRequest, updateRequest } from '@/lib/db/requests';
import { createPurchaseRequisition, getPurchaseRequisitionByRequest, updatePurchaseRequisition } from '@/lib/db/purchase-requisitions';
import { createRequestLines } from '@/lib/db/request-lines';
import { createPurchaseOrder } from '@/lib/db/purchase-orders';
import type { GovernedCheckoutDecision, GovernedCheckoutInput } from './governed-checkout';

export interface SubmitGovernedCheckoutInput {
  request: Parameters<typeof createRequest>[0];
  requestId: string;
  requisitionId: string;
  decision: GovernedCheckoutDecision;
  checkout: GovernedCheckoutInput;
  lines: RequestLine[];
  poId?: string;
}

export interface SubmitGovernedCheckoutResult {
  requestId: string;
  requisition: PurchaseRequisition;
  lines: RequestLine[];
  purchaseOrder?: PurchaseOrder;
}

/** Persist a governed checkout idempotently and create a PO only after gates pass. */
export async function submitGovernedCheckout(input: SubmitGovernedCheckoutInput): Promise<SubmitGovernedCheckoutResult> {
  if (!input.decision.ok) throw new Error(input.decision.errors.join(' '));
  const existing = await getPurchaseRequisitionByRequest(input.requestId);
  if (existing) return { requestId: input.requestId, requisition: existing, lines: [] };
  const now = new Date().toISOString();
  const initialStatus = input.decision.status;
  const request = await createRequest({
    ...input.request,
    id: input.requestId,
    supplierId: input.decision.resolved.supplierId,
    contractId: input.decision.resolved.contractId,
    requisitionId: input.requisitionId,
    riskAssessmentId: input.decision.resolved.riskAssessmentId,
    fulfilmentStatus: initialStatus,
    value: input.decision.totalValue,
    currency: input.decision.currency,
  });
  const requisition: PurchaseRequisition = {
    id: input.requisitionId,
    requestId: request.id,
    route: input.checkout.route,
    status: initialStatus,
    supplierId: input.decision.resolved.supplierId,
    contractId: input.decision.resolved.contractId,
    riskAssessmentId: input.decision.resolved.riskAssessmentId,
    totalValue: input.decision.totalValue,
    currency: input.decision.currency,
    needByDate: input.checkout.needByDate,
    serviceStartDate: input.checkout.serviceStartDate,
    serviceEndDate: input.checkout.serviceEndDate,
    purpose: input.checkout.purpose.trim(),
    costCentre: input.decision.resolved.costCentre,
    budgetOwner: input.decision.resolved.budgetOwner,
    accountType: input.decision.resolved.accountType,
    shipToLocationId: input.decision.resolved.shipToLocationId,
    beneficiaryId: input.decision.resolved.beneficiaryId,
    approvalRequired: input.decision.approvalRequired,
    riskReviewRequired: input.decision.riskReviewRequired,
    contractAmendmentRequired: input.decision.contractAmendmentRequired,
    idempotencyKey: input.checkout.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };
  const savedRequisition = await createPurchaseRequisition(requisition);
  const savedLines = await createRequestLines(input.lines.map((line) => ({ ...line, requestId: request.id, requisitionId: savedRequisition.id })));
  let purchaseOrder: PurchaseOrder | undefined;
  if (input.decision.status === 'approved') {
    purchaseOrder = await createPurchaseOrder({
      id: input.poId ?? `PO-${request.id}`,
      supplierId: savedRequisition.supplierId,
      supplierName: input.checkout.supplier.name,
      value: savedRequisition.totalValue,
      status: 'submitted',
      createdAt: now,
      deliveryDate: savedRequisition.needByDate ?? '',
      contractId: savedRequisition.contractId,
      requestId: request.id,
      requisitionId: savedRequisition.id,
      riskAssessmentId: savedRequisition.riskAssessmentId,
      costCentre: savedRequisition.costCentre,
      budgetOwner: savedRequisition.budgetOwner,
      accountType: savedRequisition.accountType,
      shipToLocationId: savedRequisition.shipToLocationId,
      beneficiaryId: savedRequisition.beneficiaryId,
      lineItems: savedLines.map((line) => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, received: 0 })),
    });
    await updateRequest(request.id, { poId: purchaseOrder.id, fulfilmentStatus: 'po-created' });
    const released = await updatePurchaseRequisition(savedRequisition.id, { status: 'po-created', updatedAt: now });
    return { requestId: request.id, requisition: released, lines: savedLines, purchaseOrder };
  }
  return { requestId: request.id, requisition: savedRequisition, lines: savedLines, purchaseOrder };
}
