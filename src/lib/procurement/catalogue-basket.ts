// A catalogue basket, as the orders it becomes.
//
// An order — request, requisition, purchase order — has one supplier and one
// contract, so a basket that spans them is placed as one order per supplier and
// contract. Approval is judged on the BASKET total, not each order's own
// (`approvalBasisValue` in governed-checkout.ts): a €1,500 basket split into
// €800 and €700 is still a €1,500 decision, or the split would be a way round
// the auto-approval threshold.
//
// Pure — the page supplies the data and the ids — so test:catalogue-basket
// drives it directly. Relative imports only.

import type { CatalogueItem } from '../../data/catalogue-items.js';
import type { Contract, ProcurementProfile, ProcurementRequest, RequestLine, RiskAssessment, Supplier } from '../../data/types.js';
import {
  evaluateGovernedCheckout,
  resolveCheckoutContract,
  resolveCheckoutRiskAssessment,
  type GovernedCheckoutDecision,
  type GovernedCheckoutInput,
} from './governed-checkout.js';
import type { PolicyConfig } from './policy-config.js';

export interface BasketLine {
  itemId: string;
  quantity: number;
}

export interface BasketOrder {
  /** `supplierId|contractId` — what makes two lines one order. */
  key: string;
  supplier: Supplier;
  contract: Contract;
  riskAssessment?: RiskAssessment;
  lines: Array<{ item: CatalogueItem; quantity: number }>;
  total: number;
}

export interface BasketProblem {
  itemId: string;
  name: string;
  reason: string;
}

export interface BasketPlan {
  orders: BasketOrder[];
  /** What the approval threshold is judged on. */
  total: number;
  /** Lines that cannot be ordered, and why — shown, never dropped silently. */
  problems: BasketProblem[];
}

export interface BasketData {
  items: CatalogueItem[];
  suppliers: Supplier[];
  contracts: Contract[];
  riskAssessments: RiskAssessment[];
}

export function planBasket(lines: BasketLine[], data: BasketData, now = new Date()): BasketPlan {
  const byKey = new Map<string, BasketOrder>();
  const problems: BasketProblem[] = [];
  for (const line of lines) {
    if (!(line.quantity > 0)) continue;
    const item = data.items.find((candidate) => candidate.id === line.itemId);
    if (!item) { problems.push({ itemId: line.itemId, name: line.itemId, reason: 'It is no longer in the catalogue.' }); continue; }
    if (item.available === false) { problems.push({ itemId: item.id, name: item.name, reason: 'It is not available right now.' }); continue; }
    const supplier = data.suppliers.find((candidate) => candidate.id === item.supplierId);
    if (!supplier) { problems.push({ itemId: item.id, name: item.name, reason: 'Its supplier could not be found.' }); continue; }
    const resolved = resolveCheckoutContract(item, data.contracts, now);
    if (!resolved.contract) { problems.push({ itemId: item.id, name: item.name, reason: resolved.error ?? 'No active contract covers it.' }); continue; }
    const key = `${supplier.id}|${resolved.contract.id}`;
    const order = byKey.get(key) ?? {
      key, supplier, contract: resolved.contract,
      riskAssessment: resolveCheckoutRiskAssessment(data.riskAssessments, supplier.id, resolved.contract.id, now),
      lines: [], total: 0,
    };
    order.lines.push({ item, quantity: line.quantity });
    order.total += line.quantity * item.unitPrice;
    byKey.set(key, order);
  }
  const orders = [...byKey.values()];
  return { orders, total: orders.reduce((sum, order) => sum + order.total, 0), problems };
}

/** How an order reads in the requester's list: its items, then how many more. */
export function basketOrderTitle(order: Pick<BasketOrder, 'lines'>): string {
  const names = order.lines.map((line) => (line.quantity > 1 ? `${line.item.name} ×${line.quantity}` : line.item.name));
  const shown = names.slice(0, 2).join(', ');
  return `Catalogue order: ${shown}${names.length > 2 ? ` and ${names.length - 2} more` : ''}`;
}

export interface BasketContext {
  requesterId: string;
  profile: ProcurementProfile;
  costCentre: string;
  shipToLocationId: string;
  purpose: string;
  currency: string;
  activeCostCentreIds: readonly string[];
  activeDeliveryLocationIds: readonly string[];
  /** One minted request id per order, in `plan.orders` order. */
  requestIds: string[];
  /** Makes each order's idempotency key: a retry of this basket is the same orders. */
  basketKey: string;
}

export interface BasketOrderPayload {
  request: Partial<ProcurementRequest>;
  requestId: string;
  requisitionId: string;
  checkout: GovernedCheckoutInput;
  decision: GovernedCheckoutDecision;
  lines: RequestLine[];
}

/** Each order's payload for the governed checkout, decided on the basket total. */
export function basketPayloads(plan: BasketPlan, ctx: BasketContext, config?: PolicyConfig): BasketOrderPayload[] {
  return plan.orders.map((order, index) => {
    const requestId = ctx.requestIds[index];
    const checkout: GovernedCheckoutInput = {
      route: 'catalogue',
      lines: order.lines.map(({ item, quantity }) => ({
        item, description: item.name, quantity, unit: item.unit, unitPrice: item.unitPrice,
        supplierId: order.supplier.id, contractId: order.contract.id,
        riskAssessmentId: order.riskAssessment?.id, commodityCode: item.commodityCode,
      })),
      supplier: order.supplier,
      contract: order.contract,
      ...(order.riskAssessment ? { riskAssessment: order.riskAssessment } : {}),
      profile: ctx.profile,
      currency: ctx.currency,
      purpose: ctx.purpose,
      costCentre: ctx.costCentre,
      shipToLocationId: ctx.shipToLocationId,
      beneficiaryId: ctx.requesterId,
      idempotencyKey: `basket-${ctx.basketKey}-${order.key}`,
      activeCostCentreIds: ctx.activeCostCentreIds,
      activeDeliveryLocationIds: ctx.activeDeliveryLocationIds,
      // Only when the basket is more than this order: a lone order is judged on
      // its own value, as it always was.
      ...(plan.orders.length > 1 ? { approvalBasisValue: plan.total } : {}),
    };
    const decision = evaluateGovernedCheckout(checkout, config);
    const title = basketOrderTitle(order);
    return {
      requestId,
      requisitionId: `PR-${requestId}`,
      checkout,
      decision,
      request: {
        id: requestId, title, description: title, category: 'catalogue', status: 'intake', priority: 'medium',
        value: decision.totalValue, currency: ctx.currency,
        supplierId: order.supplier.id, contractId: order.contract.id, buyingChannel: 'catalogue',
        commodityCode: order.lines[0]?.item.commodityCode, commodityCodeLabel: order.lines[0]?.item.commodityCode,
        costCentre: ctx.costCentre, budgetOwner: ctx.profile.budgetOwner, businessJustification: ctx.purpose,
        requestorId: ctx.requesterId, ownerId: ctx.requesterId,
      },
      lines: order.lines.map(({ item, quantity }) => ({
        id: `LINE-${requestId}-${item.id}`, requestId, description: item.name, quantity, unit: item.unit,
        unitPrice: item.unitPrice, supplierId: order.supplier.id, contractId: order.contract.id,
        catalogueItemId: item.id, riskAssessmentId: order.riskAssessment?.id, commodityCode: item.commodityCode,
      })),
    };
  });
}
