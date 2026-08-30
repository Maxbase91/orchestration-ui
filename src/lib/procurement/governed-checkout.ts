// Pure governance decisioning for catalogue orders and contract call-offs.
// Persistence/UI callers use this seam before creating a request, requisition,
// and (only when allowed) an internal purchase order.
import type { CatalogueItem } from '../../data/catalogue-items.js';
import type { Contract, ProcurementProfile, PurchaseRequisitionRoute, RiskAssessment, Supplier } from '../../data/types.js';
import { getActivePolicyConfig, type PolicyConfig } from './policy-config.js';

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
  /** Server-generated match evidence carried from the pre-check for audit. */
  contractMatch?: {
    scopeVersionId: string;
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
    contractScopeVersionId?: string;
    contractMatchScore?: number;
    contractMatchReasons?: string[];
    contractMatchInputFingerprint?: string;
    contractMatchAlgorithmVersion?: string;
  };
}

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
  const contractExpiredByDate = Boolean(input.contract.endDate && new Date(input.contract.endDate) < now);
  if ((input.contract.status !== 'active' && input.contract.status !== 'expiring') || contractExpiredByDate) errors.push('The selected contract is expired or not active.');
  const remainingValue = Math.max(0, input.contract.value * (1 - input.contract.utilisationPercentage / 100));
  const capacityExceeded = totalValue > remainingValue;
  if (capacityExceeded) errors.push(`The order exceeds the contract's remaining capacity of ${remainingValue.toFixed(2)}.`);
  if (input.supplier.screeningStatus === 'flagged') errors.push('The supplier is flagged for screening and cannot be used.');
  const riskAssessment = input.riskAssessment;
  const riskReviewRequired = !assessmentIsValid(riskAssessment, now);
  if (!riskAssessment && input.route === 'catalogue') errors.push('This catalogue item has no linked supplier risk assessment and cannot be submitted.');
  else if (!riskAssessment) warnings.push('No linked supplier or contract risk assessment was found; risk review is required.');
  else if (riskReviewRequired) warnings.push('The linked risk assessment is expired or incomplete; risk review is required.');
  const shipToLocationId = input.shipToLocationId ?? input.profile.defaultShipToLocationId;
  const validShipTo = input.profile.approvedShipToLocations.some((location) => location.id === shipToLocationId);
  if (!shipToLocationId || !validShipTo) errors.push('Choose an approved delivery location.');
  const purpose = input.purpose.trim();
  if (!purpose) errors.push('Provide a short business purpose.');
  const resolvedCostCentre = input.costCentre ?? input.profile.costCentre;
  const resolvedBudgetOwner = input.budgetOwner ?? input.profile.budgetOwner;
  const resolvedAccountType = input.accountType ?? input.profile.accountType;
  if (!resolvedCostCentre) errors.push('A cost centre is required.');
  if (!resolvedBudgetOwner) errors.push('A budget owner is required.');
  if (!resolvedAccountType) errors.push('An account type is required.');
  const approvalRequired = totalValue >= config.catalogueAutoApprovalThreshold;
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
