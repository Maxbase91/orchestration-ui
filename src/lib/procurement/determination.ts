// Contract-type and sourcing-type determination.
//
// Non-binary outcomes for the determination endpoint: what kind of contract the
// demand needs (new master agreement, statement of work, amendment, change,
// renewal, or none) and what kind of sourcing (new event, renewal, benchmarking,
// or none). Derived from the buying channel, the category, and whether an
// existing framework/contract or supplier relationship applies. Standardised and
// organisation-agnostic.

import type { BuyingChannel } from '@/data/types';

export type ContractType = 'new-msa' | 'sow' | 'amend' | 'change' | 'renew' | 'none';
export type SourcingType = 'new-event' | 'renewal' | 'benchmarking' | 'none';

export interface ContractTypeInput {
  channel: BuyingChannel;
  category: string;
  /** A transactable framework/contract is in place (matched or via the supplier). */
  hasFrameworkOrContract: boolean;
}

export interface SourcingTypeInput {
  channel: BuyingChannel;
  category: string;
  /** The supplier is an incumbent (existing contract or spend). */
  hasExistingSupplierRelationship: boolean;
}

/**
 * Determine the contract type. Catalogue/direct-PO need none; a renewal category
 * renews; an existing framework/contract is filled with a statement of work;
 * otherwise a new master agreement is needed. (`amend`/`change` are part of the
 * outcome set and produced once scope/headroom signals are captured.)
 */
export function determineContractType(input: ContractTypeInput): { type: ContractType; reason: string } {
  if (input.channel === 'catalogue' || input.channel === 'direct-po') {
    return { type: 'none', reason: 'Catalogue / direct PO — no contract required' };
  }
  if (input.category === 'contract-renewal') {
    return { type: 'renew', reason: 'Renewal of an existing contract' };
  }
  if (input.channel === 'framework-call-off' || input.hasFrameworkOrContract) {
    return { type: 'sow', reason: 'Author a statement of work under the existing framework / contract' };
  }
  return { type: 'new-msa', reason: 'No existing agreement — a new master agreement (and SOW) is needed' };
}

/**
 * Determine the sourcing type. Catalogue/direct-PO/framework call-offs need no
 * sourcing event; a renewal category renews; an incumbent relationship is
 * benchmarked against the market; otherwise it's a new event.
 */
export function determineSourcingType(input: SourcingTypeInput): { type: SourcingType; reason: string } {
  if (input.channel === 'catalogue' || input.channel === 'direct-po' || input.channel === 'framework-call-off') {
    return { type: 'none', reason: 'Deflected to catalogue / contract — no sourcing event' };
  }
  if (input.category === 'contract-renewal') {
    return { type: 'renewal', reason: 'Renewal of the incumbent engagement' };
  }
  if (input.hasExistingSupplierRelationship) {
    return { type: 'benchmarking', reason: 'Incumbent relationship — benchmark against the market' };
  }
  return { type: 'new-event', reason: 'New sourcing event' };
}
