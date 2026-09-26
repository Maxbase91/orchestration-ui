// The determination, wired to the data layer — the one React seam over
// `evaluateIntakeDetermination`.
//
// Mounted once per intake, in the page, so the conversation (which asks the
// residual risk questions) and the Channel page (which shows the conclusions)
// read the *same* object rather than each computing its own. Two screens
// deriving the same governance answer independently is the drift this codebase
// has already paid for more than once.

import { useMemo } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useSourceData } from '@/lib/integrations';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { usePolicyConfigStore } from '@/stores/policy-config-store';
import { useMatchingRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useApprovalChains } from '@/lib/db/hooks/use-approval-chains';
import { usePreferredSupplierIds } from '@/lib/db/hooks/use-category-preferred-suppliers';
import { useServiceDescriptionTemplate } from '@/lib/db/hooks/use-service-description-templates';
import {
  evaluateIntakeDetermination,
  REQUEST_VALIDATOR_AGENT_ID,
  type DeterminationServiceDescription,
  type IntakeDetermination,
} from '@/lib/procurement/intake-determination';
import type { Supplier, Contract, RoutingRule, RiskAssessment } from '@/data/types';
import type { ApprovalChain } from '@/lib/db/approval-chains';

// Stable empty fallbacks defined at module level. Inline `= []` creates a new
// array reference on every render, which destabilises the memo dep array and
// (when the result was pushed to a parent) caused an infinite update loop.
const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_CONTRACTS: Contract[] = [];
const EMPTY_MATCHES: RiskAssessment[] = [];
const EMPTY_RULES: RoutingRule[] = [];
const EMPTY_APPROVAL_CHAINS: ApprovalChain[] = [];
const EMPTY_WORDING: Readonly<Record<string, string>> = {};

export interface UseIntakeDeterminationInput {
  category: string;
  estimatedValue: number;
  commodityCode?: string;
  supplierId: string;
  isUrgent: boolean;
  requestTitle?: string;
  serviceDescription?: DeterminationServiceDescription | null;
  miniIrq: { privilegedAccess?: boolean; criticalService?: boolean };
  contractId?: string;
}

export interface UseIntakeDeterminationResult {
  determination: IntakeDetermination | null;
  /** True while the supplier's reusable-assessment lookup is still in flight. */
  loading: boolean;
}

export function useIntakeDetermination(
  input: UseIntakeDeterminationInput,
): UseIntakeDeterminationResult {
  const { data: suppliers = EMPTY_SUPPLIERS } = useSourceData<Supplier>('supplier');
  const { data: contracts = EMPTY_CONTRACTS } = useSourceData<Contract>('contract');
  const { data: matches = EMPTY_MATCHES, isFetched: matchesFetched } =
    useMatchingRiskAssessments({ supplierId: input.supplierId });
  const { data: routingRules = EMPTY_RULES } = useRoutingRules();
  const { data: validatorAgent } = useAiAgent(REQUEST_VALIDATOR_AGENT_ID);
  const { data: approvalChains = EMPTY_APPROVAL_CHAINS } = useApprovalChains();
  const preferredSupplierIds = usePreferredSupplierIds(input.category);
  // How this category puts the risk questions (Admin → Service description).
  const { data: sdTemplate } = useServiceDescriptionTemplate(input.category);
  const riskQuestionWording = sdTemplate?.riskQuestionWording ?? EMPTY_WORDING;
  // The admin's saved thresholds, as a subscription: the determination is
  // decided again when they move, and submit compares it with one decided on
  // the stored row.
  const policyConfig = usePolicyConfig();

  // A fetch is pending if we have a supplierId and the matching-SRA lookup
  // hasn't resolved yet. Without a supplierId the query is disabled, so treat
  // it as resolved immediately.
  const loading = Boolean(input.supplierId) && !matchesFetched;

  const {
    category, estimatedValue, supplierId, isUrgent, requestTitle, serviceDescription, commodityCode,
    miniIrq, contractId,
  } = input;

  const determination = useMemo<IntakeDetermination | null>(() => {
    if (loading) return null;
    return evaluateIntakeDetermination({
      category,
      estimatedValue,
      commodityCode,
      supplierId,
      isUrgent,
      requestTitle,
      serviceDescription,
      miniIrq,
      contractId,
      // Read once per recomputation rather than three times inside the
      // evaluation, so every date-sensitive check sees the same day.
      now: new Date().toISOString().slice(0, 10),
      suppliers,
      preferredSupplierIds,
      contracts,
      matchingRiskAssessments: matches,
      routingRules,
      approvalChains,
      validatorAgent: validatorAgent ?? undefined,
      riskQuestionWording,
      policyConfig,
    });
  }, [
    loading, category, estimatedValue, supplierId, isUrgent, requestTitle, serviceDescription, commodityCode,
    miniIrq, contractId, suppliers, preferredSupplierIds, contracts, matches, routingRules, approvalChains, validatorAgent,
    riskQuestionWording, policyConfig,
  ]);


  return { determination, loading };
}

/**
 * The cached reads the determination above is made from, by query key. Submit
 * decides the demand again on the server and refuses when the answer differs
 * from what the requester reviewed (409 `determination_changed`); these are
 * fetched again then, with the governed thresholds, so the Channel page
 * redraws on what the server decided with. Keep it beside the hooks it mirrors:
 * an input missing here would be refused again on the next submit.
 */
const DETERMINATION_INPUT_KEYS = [
  ['source-connector', 'supplier'],
  ['source-connector', 'contract'],
  ['risk-assessments'],
  ['routing-rules'],
  ['approval-chains'],
  ['ai-agents'],
  ['category-preferred-suppliers'],
  ['service-description-templates'],
] as const;

export async function refreshDeterminationInputs(queryClient: QueryClient): Promise<void> {
  await usePolicyConfigStore.getState().hydrateFromServer();
  await Promise.all(DETERMINATION_INPUT_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
