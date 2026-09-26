// Submit's second decision: the intake determination made again on the server,
// from stored data, so /api/intake-submit can compare it with the one the
// requester reviewed and record its own (AGENTS.md rule 3, decided 2026-09-26).
//
// The comparison is only fair when both decisions read the same things the
// same way, so every input mirrors src/features/requests/new-request/
// use-intake-determination.ts: the supplier, its contracts and its reusable
// risk assessments through the shared ports; routing rules, approval chains
// and the Request Validator through the read code the browser's modules use;
// the governed thresholds from the stored row. An input read differently here
// would refuse good submits — test:submit-decides-again holds the two in step.
import type { NeonCompatibleClient } from '../src/lib/neon-compatible-client.js';
import type { PolicyConfig } from '../src/lib/procurement/policy-config.js';
import {
  evaluateIntakeDetermination, REQUEST_VALIDATOR_AGENT_ID,
  type DeterminationServiceDescription, type IntakeDetermination,
} from '../src/lib/procurement/intake-determination.js';
import { createSharedConnectors } from '../src/lib/integrations/shared-connectors.js';
import { findReusableRiskAssessments } from '../src/lib/integrations/reusable-assessments.js';
import { listRoutingRulesWith } from '../src/lib/db/routing-rules-core.js';
import { listApprovalChainsWith, type ApprovalChain } from '../src/lib/db/approval-chains-core.js';
import { getAiAgentWith } from '../src/lib/db/ai-agents-core.js';
import { getServiceDescriptionTemplate } from './_sd-template.js';

/** The demand as submitted — what the requester said, not what was concluded. */
export interface SubmittedDemand {
  category: string;
  estimatedValue: number;
  /** '' when none was chosen, as the browser holds it. */
  supplierId: string;
  contractId?: string;
  commodityCode?: string;
  isUrgent: boolean;
  requestTitle: string;
  serviceDescription: DeterminationServiceDescription | null;
  /** The two risk questions a description cannot answer; absent means not asked. */
  riskAnswers: { privilegedAccess?: boolean; criticalService?: boolean };
  /** The category's preferred suppliers, as submit already read them. */
  preferredSupplierIds: string[];
}

export interface ServerDetermination {
  determination: IntakeDetermination;
  /** The chains it banded against, so a refusal can name them. */
  approvalChains: ApprovalChain[];
}

export async function determineOnServer(
  client: NeonCompatibleClient,
  demand: SubmittedDemand,
  policy: PolicyConfig,
  /** YYYY-MM-DD, the day the browser's determination is dated by too. */
  today: string,
): Promise<ServerDetermination> {
  const ports = createSharedConnectors(client);
  const supplierId = demand.supplierId || undefined;
  const [supplier, contracts, reusable, routingRules, approvalChains, validator, template] = await Promise.all([
    supplierId ? ports.supplier.get(supplierId) : Promise.resolve(null),
    // The supplier's contracts only. The browser hands the determination every
    // contract, but the only reader — the second contract check — skips any
    // that is not this supplier's, and keeps the port's order, so the answer
    // is the same.
    supplierId ? ports.contract.list({ filters: { supplierId } }) : Promise.resolve([]),
    findReusableRiskAssessments(ports.riskAssessment, { supplierId, today }),
    listRoutingRulesWith(client),
    listApprovalChainsWith(client),
    getAiAgentWith(client, REQUEST_VALIDATOR_AGENT_ID),
    // Wording only: the questions' text, never which are asked or what the
    // record says, so its 60-second memo cannot make the decisions differ.
    getServiceDescriptionTemplate(demand.category),
  ]);

  const determination = evaluateIntakeDetermination({
    category: demand.category,
    preferredSupplierIds: demand.preferredSupplierIds,
    estimatedValue: demand.estimatedValue,
    supplierId: demand.supplierId,
    isUrgent: demand.isUrgent,
    requestTitle: demand.requestTitle,
    serviceDescription: demand.serviceDescription,
    miniIrq: demand.riskAnswers,
    contractId: demand.contractId,
    commodityCode: demand.commodityCode,
    now: today,
    // Only the chosen supplier: the determination looks nothing else up.
    suppliers: supplier ? [supplier.data] : [],
    contracts: contracts.map((record) => record.data),
    matchingRiskAssessments: reusable,
    routingRules,
    approvalChains,
    validatorAgent: validator ? { name: validator.name, status: validator.status } : undefined,
    policyConfig: policy,
    riskQuestionWording: template.riskQuestionWording,
  });
  return { determination, approvalChains };
}
