// One contract call-off, built once, for the Channel page and for submit.
//
// The call-off used to be assembled inside the submit handler, so the first time
// anything evaluated it was the moment it was written — there was no way to say
// beforehand where it would go or who would approve it. The Channel page needs
// exactly the decision submit records, so both call this with the same inputs
// and only the request id differs (a placeholder while previewing). The server
// re-runs the decision from stored data either way (ADR-0002); this is the
// browser's advisory copy, and the same one on both screens.
import type { BuyingChannel, Contract, ProcurementProfile, RequestCategory, RequestLine, RiskAssessment, Supplier } from '@/data/types';
import {
  evaluateGovernedCheckout,
  resolveCheckoutRiskAssessment,
  type GovernedCheckoutDecision,
  type GovernedCheckoutInput,
} from '@/lib/procurement/governed-checkout';
import type { SubmitGovernedCheckoutInput } from '@/lib/procurement/submit-governed-checkout';
import { parseDeliveryDate } from '@/lib/parse-delivery-date';
import type { ContractCallOffDraft } from './contract-call-off-checkout';
import type { IntakeFormData } from './intake-form-data';

export interface CallOffInput {
  draft: ContractCallOffDraft;
  contract: Contract;
  supplier: Supplier;
  riskAssessments: RiskAssessment[];
  /** The requester's stored profile; null when they have none. */
  storedProfile: ProcurementProfile | null;
  user: { id: string; name: string };
  form: Pick<IntakeFormData, 'currency' | 'commodityCode' | 'commodityCodeLabel' | 'beneficiaryId' | 'beneficiaryName' | 'category' | 'isUrgent'>;
  activeCostCentreIds: string[];
  activeDeliveryLocationIds: string[];
  requestId: string;
}

export interface CallOff {
  checkout: GovernedCheckoutInput;
  decision: GovernedCheckoutDecision;
  request: SubmitGovernedCheckoutInput['request'];
  lines: RequestLine[];
  riskAssessment?: RiskAssessment;
}

export function buildCallOff(input: CallOffInput): CallOff {
  const { draft, contract, supplier, user, form, requestId: id } = input;
  const profile: ProcurementProfile = input.storedProfile ?? {
    userId: user.id, defaultCurrency: form.currency, costCentre: draft.costCentre,
    budgetOwner: user.name, accountType: 'expense', beneficiaryId: form.beneficiaryId || user.id,
    // Never the requester's own choice: a list built from the choice it is
    // meant to check approves whatever was chosen.
    approvedShipToLocations: [],
  };
  const riskAssessment = resolveCheckoutRiskAssessment(input.riskAssessments, supplier.id, contract.id);
  const commodityCode = form.commodityCode || profile.defaultCommodityCode;
  const line = {
    description: draft.title, quantity: 1, unit: 'service', unitPrice: draft.value,
    supplierId: supplier.id, contractId: contract.id, riskAssessmentId: riskAssessment?.id, commodityCode,
  };
  const checkout: GovernedCheckoutInput = {
    route: 'contract-call-off', lines: [line], supplier, contract, riskAssessment, profile,
    currency: form.currency, needByDate: draft.needBy, serviceStartDate: draft.serviceStartDate || undefined,
    serviceEndDate: draft.serviceEndDate || undefined, purpose: draft.purpose, costCentre: draft.costCentre,
    shipToLocationId: draft.deliveryLocation, beneficiaryId: form.beneficiaryId || user.id,
    idempotencyKey: `checkout-${id}`,
    activeCostCentreIds: input.activeCostCentreIds, activeDeliveryLocationIds: input.activeDeliveryLocationIds,
  };
  const decision = evaluateGovernedCheckout(checkout);
  const request: SubmitGovernedCheckoutInput['request'] = {
    id, title: draft.title, description: draft.purpose,
    category: (form.category || contract.category || 'services') as RequestCategory,
    status: 'intake', priority: form.isUrgent ? 'urgent' : 'medium', value: decision.totalValue,
    currency: form.currency, supplierId: supplier.id, contractId: contract.id, buyingChannel: 'framework-call-off' as BuyingChannel,
    commodityCode, commodityCodeLabel: form.commodityCodeLabel || commodityCode, costCentre: draft.costCentre,
    budgetOwner: user.name, businessJustification: '', deliveryDate: parseDeliveryDate(draft.needBy) ?? undefined,
    requestorId: user.id, ownerId: user.id, daysInStage: 0, isOverdue: false, referBackCount: 0,
    beneficiaryId: form.beneficiaryId || undefined, beneficiaryName: form.beneficiaryName || undefined,
  };
  const lines: RequestLine[] = [{
    id: `LINE-${id}-1`, requestId: id, description: draft.title, quantity: 1, unit: 'service', unitPrice: draft.value,
    supplierId: supplier.id, contractId: contract.id, riskAssessmentId: riskAssessment?.id, commodityCode, deliveryDate: draft.needBy,
  }];
  return { checkout, decision, request, lines, riskAssessment };
}
