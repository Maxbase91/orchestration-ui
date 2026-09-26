// Pure governance decisioning for catalogue orders and contract call-offs.
// Persistence/UI callers use this seam before creating a request, requisition,
// and (only when allowed) an internal purchase order.
import type { CatalogueItem } from '../../data/catalogue-items.js';
import type { Contract, ProcurementProfile, PurchaseRequisitionRoute, RiskAssessment, Supplier } from '../../data/types.js';
import { getActivePolicyConfig, type PolicyConfig } from './policy-config.js';
import type { EdgeCondition } from '../workflow/edge-conditions.js';
import { daysUntilEnd, isoToday } from './contract-status.js';

export interface GovernedCheckoutLine {
  item?: CatalogueItem;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  supplierId: string;
  contractId?: string;
  riskAssessmentId?: string;
  commodityCode?: string;
}

export interface GovernedCheckoutInput {
  route: PurchaseRequisitionRoute;
  lines: GovernedCheckoutLine[];
  supplier: Supplier;
  contract: Contract;
  riskAssessment?: RiskAssessment;
  profile: ProcurementProfile;
  /**
   * The reference data both checks below are made against — active rows from
   * `cost_centres` and `delivery_locations`.
   *
   * These are inputs rather than reads so the evaluator stays pure and the
   * server can supply its OWN copy. The delivery-location check used to run
   * against `profile.approvedShipToLocations`, which nothing ever populated and
   * which `api/governed-checkout.ts` fell back to taking from the browser when
   * no profile row existed — so it approved whatever it was handed. A check
   * that cannot fail is not a check.
   *
   * Undefined means the caller could not load them; both checks then fail
   * closed rather than passing on absent evidence.
   */
  activeCostCentreIds?: readonly string[];
  activeDeliveryLocationIds?: readonly string[];
  currency?: string;
  needByDate?: string;
  serviceStartDate?: string;
  serviceEndDate?: string;
  purpose: string;
  costCentre?: string;
  budgetOwner?: string;
  accountType?: string;
  shipToLocationId?: string;
  beneficiaryId?: string;
  /** Client-generated key for retries of the same checkout. */
  idempotencyKey?: string;
  /**
   * The value the auto-approval threshold is judged on, when this order is one
   * of several placed together: the whole basket's value.
   *
   * A catalogue basket spanning suppliers becomes one order per supplier, and
   * judging each on its own value would let a €1,500 basket split into €800 and
   * €700 pass as two automatic orders — splitting to stay under the threshold is
   * the thing the threshold exists to stop. Absent means this order stands alone.
   * The server computes it from the stored prices; the browser's is advisory.
   */
  approvalBasisValue?: number;
  /**
   * Server-generated match evidence carried from the pre-check for audit.
   * `scopeVersionId` is null when the scope data could not be read: the record
   * then says the coverage check did not run, rather than leaving a blank that
   * reads the same as "ran and matched nothing".
   */
  contractMatch?: {
    scopeVersionId: string | null;
    score: number;
    reasons: string[];
    inputFingerprint: string;
    algorithmVersion: string;
  };
  now?: Date;
}

export interface GovernedCheckoutDecision {
  ok: boolean;
  totalValue: number;
  currency: string;
  approvalRequired: boolean;
  riskReviewRequired: boolean;
  contractAmendmentRequired: boolean;
  status: 'approved' | 'pending-approval' | 'risk-review' | 'contract-amendment-required';
  errors: string[];
  warnings: string[];
  resolved: {
    supplierId: string;
    contractId: string;
    riskAssessmentId?: string;
    costCentre?: string;
    budgetOwner?: string;
    accountType?: string;
    shipToLocationId?: string;
    beneficiaryId?: string;
    commodityCodes: string[];
    contractScopeVersionId?: string | null;
    contractMatchScore?: number;
    contractMatchReasons?: string[];
    contractMatchInputFingerprint?: string;
    contractMatchAlgorithmVersion?: string;
  };
}

/**
 * Where a governed checkout's request enters its lifecycle, from the decision.
 *
 * The stage, not the node: the node is resolved from the stored template by
 * stage (nodeIdForStatus), so reshaping a template in the Workflow Designer
 * cannot leave this naming a node that no longer means what it did. Shared by
 * the checkout endpoint that writes the request and the Channel page that says
 * beforehand where it will go, so the two cannot disagree.
 */
export function checkoutEntryStage(
  route: string,
  status: GovernedCheckoutDecision['status'],
): 'po' | 'approval' | 'risk' | 'contracting' {
  if (route === 'catalogue') {
    // A catalogue order has no sourcing, contracting or risk stage to enter;
    // anything that is not auto-approved waits at manager approval.
    return status === 'approved' ? 'po' : 'approval';
  }
  switch (status) {
    case 'approved': return 'po';
    case 'risk-review': return 'risk';
    case 'contract-amendment-required': return 'contracting';
    default: return 'approval';
  }
}

/**
 * What `checkoutEntryStage` lands a call-off past, in the branch vocabulary —
 * the decision's own tests, in the order its status weighs them: the contract
 * is amended only if it must be, the risk review runs only if the linked
 * assessment is not valid, and approval is asked only above the auto-approval
 * threshold (evaluateGovernedCheckout).
 */
export const CHECKOUT_ENTRY_CONDITIONS: Partial<Record<'contracting' | 'risk' | 'approval', EdgeCondition>> = {
  contracting: { field: 'contractAmendmentRequired', operator: 'equals', value: 'true' },
  risk: { field: 'riskRequired', operator: 'equals', value: 'true' },
  approval: { field: 'value', operator: 'greater_than', value: 'policy:catalogueAutoApprovalThreshold' },
};

/** Resolve the single transactable contract behind a catalogue or call-off line. */
export function resolveCheckoutContract(
  item: CatalogueItem,
  contracts: Contract[],
  now = new Date(),
): { contract?: Contract; error?: string } {
  const candidates = contracts.filter((contract) =>
    (item.contractId ? contract.id === item.contractId : contract.supplierId === item.supplierId)
    && contract.status !== 'expired'
    && contract.status !== 'terminated'
    && new Date(contract.startDate) <= now
    && new Date(contract.endDate) >= now,
  );
  if (candidates.length === 1) return { contract: candidates[0] };
  if (candidates.length === 0) return { error: `No active contract covers ${item.name}.` };
  return { error: `More than one active contract covers ${item.name}; procurement must select one.` };
}

/** Prefer contract-level evidence, then the supplier's reusable assessment. */
export function resolveCheckoutRiskAssessment(
  assessments: RiskAssessment[],
  supplierId: string,
  contractId: string,
  now = new Date(),
): RiskAssessment | undefined {
  const relevant = assessments.filter((assessment) =>
    assessment.status === 'completed'
    && (assessment.contractId === contractId || (!assessment.contractId && assessment.supplierId === supplierId)),
  );
  const valid = relevant.filter((assessment) => assessment.validUntil && new Date(assessment.validUntil) >= now);
  return [...(valid.length > 0 ? valid : relevant)].sort((a, b) => b.validUntil.localeCompare(a.validUntil))[0];
}

function assessmentIsValid(assessment: RiskAssessment | undefined, now: Date): boolean {
  return Boolean(assessment && assessment.status === 'completed' && assessment.validUntil && new Date(assessment.validUntil) >= now);
}

/** Validate all mandatory governance links and derive the next lifecycle state. */
export function evaluateGovernedCheckout(
  input: GovernedCheckoutInput,
  config: PolicyConfig = getActivePolicyConfig(),
): GovernedCheckoutDecision {
  const now = input.now ?? new Date();
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = input.lines;
  const totalValue = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const first = lines[0];
  const allSupplierIds = new Set(lines.map((line) => line.supplierId));
  const allContractIds = new Set(lines.map((line) => line.contractId ?? input.contract.id));
  if (lines.length === 0) errors.push('Add at least one item before submitting.');
  if (lines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0)) errors.push('Every line must have a positive quantity.');
  if (lines.some((line) => !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) errors.push('Every line must have a valid unit price.');
  if (allSupplierIds.size > 1 || (first && first.supplierId !== input.supplier.id)) errors.push('All lines must use the same supplier.');
  if (allContractIds.size > 1 || (first && (first.contractId ?? input.contract.id) !== input.contract.id)) errors.push('All lines must use the same active contract.');
  // In force through its end date, as the contracts view reads it: compared as
  // calendar dates. A timestamp compare made a contract expire at midnight UTC
  // on its last day here while every screen still showed it in force.
  const contractExpiredByDate = (daysUntilEnd(input.contract.endDate, isoToday(now)) ?? 0) < 0;
  if ((input.contract.status !== 'active' && input.contract.status !== 'expiring') || contractExpiredByDate) errors.push('The selected contract is expired or not active.');
  const remainingValue = Math.max(0, input.contract.value * (1 - input.contract.utilisationPercentage / 100));
  const capacityExceeded = totalValue > remainingValue;
  if (capacityExceeded) errors.push(`The order exceeds the contract's remaining capacity of ${remainingValue.toFixed(2)}.`);
  // Server-authoritative twin of the buy-route rule: above the limit a call-off
  // is not a direct award, whatever the browser offered.
  if (input.route === 'contract-call-off' && totalValue > config.directCallOffLimit) {
    errors.push(`This call-off is above the ${config.directCallOffLimit.toLocaleString('en-IE')} direct call-off limit, so it needs a mini-competition — raise it as a new request.`);
  }
  if (input.supplier.screeningStatus === 'flagged') errors.push('The supplier is flagged for screening and cannot be used.');
  const riskAssessment = input.riskAssessment;
  const riskReviewRequired = !assessmentIsValid(riskAssessment, now);
  if (!riskAssessment && input.route === 'catalogue') errors.push('This catalogue item has no linked supplier risk assessment and cannot be submitted.');
  else if (!riskAssessment) warnings.push('No linked supplier or contract risk assessment was found; risk review is required.');
  else if (riskReviewRequired) warnings.push('The linked risk assessment is expired or incomplete; risk review is required.');
  const shipToLocationId = input.shipToLocationId ?? input.profile.defaultShipToLocationId;
  if (!shipToLocationId) errors.push('Choose a delivery location.');
  else if (!input.activeDeliveryLocationIds?.includes(shipToLocationId)) {
    errors.push('That delivery location is not active — choose one from the list.');
  }
  const purpose = input.purpose.trim();
  if (!purpose) errors.push('Provide a short business purpose.');
  const resolvedCostCentre = input.costCentre ?? input.profile.costCentre;
  const resolvedBudgetOwner = input.budgetOwner ?? input.profile.budgetOwner;
  const resolvedAccountType = input.accountType ?? input.profile.accountType;
  if (!resolvedCostCentre) errors.push('A cost centre is required.');
  else if (!input.activeCostCentreIds?.includes(resolvedCostCentre)) {
    errors.push('That cost centre is not active — choose one from the list.');
  }
  if (!resolvedBudgetOwner) errors.push('A budget owner is required.');
  if (!resolvedAccountType) errors.push('An account type is required.');
  // Up to the threshold is automatic, as the catalogue workflow's branch, the
  // Home answer and the knowledge base all say. This was `>=`, so an order of
  // exactly the threshold was held for approval here and auto-approved by the
  // workflow the same record then ran through.
  const approvalRequired = Math.max(totalValue, input.approvalBasisValue ?? 0) > config.catalogueAutoApprovalThreshold;
  const contractAmendmentRequired = capacityExceeded || (input.contract.status !== 'active' && input.contract.status !== 'expiring');
  const status = contractAmendmentRequired
    ? 'contract-amendment-required'
    : riskReviewRequired ? 'risk-review' : approvalRequired ? 'pending-approval' : 'approved';
  return {
    ok: errors.length === 0,
    totalValue,
    currency: input.currency ?? input.profile.defaultCurrency,
    approvalRequired,
    riskReviewRequired,
    contractAmendmentRequired,
    status,
    errors,
    warnings,
    resolved: {
      supplierId: input.supplier.id,
      contractId: input.contract.id,
      ...(riskAssessment ? { riskAssessmentId: riskAssessment.id } : {}),
      costCentre: resolvedCostCentre,
      budgetOwner: resolvedBudgetOwner,
      accountType: resolvedAccountType,
      shipToLocationId,
      beneficiaryId: input.beneficiaryId ?? input.profile.beneficiaryId,
      commodityCodes: [...new Set(lines.map((line) => line.commodityCode ?? line.item?.commodityCode ?? input.profile.defaultCommodityCode).filter((code): code is string => Boolean(code)))],
      ...(input.contractMatch ? {
        contractScopeVersionId: input.contractMatch.scopeVersionId,
        contractMatchScore: input.contractMatch.score,
        contractMatchReasons: input.contractMatch.reasons,
        contractMatchInputFingerprint: input.contractMatch.inputFingerprint,
        contractMatchAlgorithmVersion: input.contractMatch.algorithmVersion,
      } : {}),
    },
  };
}
