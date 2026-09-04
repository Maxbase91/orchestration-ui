// The determination, wired to the data layer — the one React seam over
// `evaluateIntakeDetermination`.
//
// Mounted once per intake, in the page, so the Details step (which asks the
// residual risk questions) and the Review step (which shows every conclusion)
// read the *same* object rather than each computing its own. Two screens
// deriving the same governance answer independently is the drift this codebase
// has already paid for more than once.

import { useMemo } from 'react';
import { useSourceData } from '@/lib/integrations';
import { useMatchingRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { useApprovalChains } from '@/lib/db/hooks/use-approval-chains';
import { selectWorkflowTemplateForCategory } from '@/lib/workflow/workflow-steps';
import {
  evaluateIntakeDetermination,
  type DeterminationServiceDescription,
  type IntakeDetermination,
} from '@/lib/procurement/intake-determination';
import type { Supplier, Contract, RoutingRule, RiskAssessment, WorkflowTemplate } from '@/data/types';
import type { ApprovalChain } from '@/lib/db/approval-chains';

// Stable empty fallbacks defined at module level. Inline `= []` creates a new
// array reference on every render, which destabilises the memo dep array and
// (when the result was pushed to a parent) caused an infinite update loop.
const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_CONTRACTS: Contract[] = [];
const EMPTY_MATCHES: RiskAssessment[] = [];
const EMPTY_RULES: RoutingRule[] = [];
const EMPTY_TEMPLATES: WorkflowTemplate[] = [];
const EMPTY_APPROVAL_CHAINS: ApprovalChain[] = [];

export interface UseIntakeDeterminationInput {
  category: string;
  estimatedValue: number;
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
  /** The template the category implies, when the requester has not picked one. */
  derivedWorkflowTemplateId?: string;
}

export function useIntakeDetermination(
  input: UseIntakeDeterminationInput,
): UseIntakeDeterminationResult {
  const { data: suppliers = EMPTY_SUPPLIERS } = useSourceData<Supplier>('supplier');
  const { data: contracts = EMPTY_CONTRACTS } = useSourceData<Contract>('contract');
  const { data: matches = EMPTY_MATCHES, isFetched: matchesFetched } =
    useMatchingRiskAssessments({ supplierId: input.supplierId });
  const { data: routingRules = EMPTY_RULES } = useRoutingRules();
  const { data: validatorAgent } = useAiAgent('AI-002');
  const { data: workflowTemplates = EMPTY_TEMPLATES } = useWorkflowTemplates();
  const { data: approvalChains = EMPTY_APPROVAL_CHAINS } = useApprovalChains();

  // A fetch is pending if we have a supplierId and the matching-SRA lookup
  // hasn't resolved yet. Without a supplierId the query is disabled, so treat
  // it as resolved immediately.
  const loading = Boolean(input.supplierId) && !matchesFetched;

  const {
    category, estimatedValue, supplierId, isUrgent, requestTitle, serviceDescription,
    miniIrq, contractId,
  } = input;

  const determination = useMemo<IntakeDetermination | null>(() => {
    if (loading) return null;
    return evaluateIntakeDetermination({
      category,
      estimatedValue,
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
      contracts,
      matchingRiskAssessments: matches,
      routingRules,
      approvalChains,
      validatorAgent: validatorAgent ?? undefined,
    });
  }, [
    loading, category, estimatedValue, supplierId, isUrgent, requestTitle, serviceDescription,
    miniIrq, contractId, suppliers, contracts, matches, routingRules, approvalChains, validatorAgent,
  ]);

  const derivedWorkflowTemplateId = useMemo(
    () => selectWorkflowTemplateForCategory(workflowTemplates, category)?.id,
    [workflowTemplates, category],
  );

  return { determination, loading, derivedWorkflowTemplateId };
}
