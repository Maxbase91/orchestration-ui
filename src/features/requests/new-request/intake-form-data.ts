// The intake form's data shape — the one state both experience densities fill.
//
// This lived inside `new-request-page.tsx`, which meant `simple-new-request-page`
// and `step-chat-intake` imported *types from a page component* to describe their
// own state. That import direction is what let the two intake implementations
// drift: each page owned a shape, so nothing forced them to agree on one.
//
// There is one intake and one form shape (ADR-0008, superseding ADR-0001's
// dual-mode experience). One shape is the floor that keeps it that way.

import type {
  CommodityClassificationCandidate,
  IntakeAttachment,
} from '@/data/types';
import type { MaterialityResult } from '@/lib/procurement/materiality';
import type { InherentRiskResult } from '@/lib/procurement/risk-segmentation';
import type { ScreeningResult } from '@/lib/procurement/screening';
import type { ReferralResult } from '@/lib/procurement/referral';
import type { MatchingRiskAssessmentSummary } from './step-compliance';

/**
 * How a section came to be filled.
 *
 * `answered` — the requester wrote it and it addressed the question.
 * `assistant-drafted` — they accepted a draft the assistant proposed after a
 *   challenge, so the words are the assistant's and they approved them.
 * `weak` — challenged once, answered again with something thin, and accepted
 *   anyway. Never a hard block, but never invisible either: a reviewer sees
 *   which parts of a description nobody really wrote.
 */
export type SectionCapture = 'answered' | 'document-extracted' | 'assistant-drafted' | 'reviewer-edited' | 'weak';

export interface ServiceDescription {
  objective: string;
  scope: string;
  /** Explicit exclusions are kept separate from included scope. */
  exclusions?: string;
  deliverables: string;
  timeline: string;
  resources: string;
  acceptanceCriteria: string;
  pricingModel: string;
  location: string;
  dependencies: string;
  narrative: string; // Full narrative summary
  /** Per-section provenance — see SectionCapture. Absent for older records. */
  captureFlags?: Partial<Record<string, SectionCapture>>;
}

/** The text-bearing members — everything except the provenance map. */
export type ServiceDescriptionSectionKey = Exclude<keyof ServiceDescription, 'captureFlags'>;

/** Which fulfilment path the demand is on. Drives which steps apply. */
export type IntakeRouteOutcome = 'catalogue' | 'contract' | 'full-request' | '';

export interface IntakeFormData {
  // ── Describe ────────────────────────────────────────────────────────────
  category: string;
  categoryDescription: string;
  /**
   * The assistant's read of what kind of demand this is (api/ai.ts `intent`),
   * carried from the describe step into the routing decision. Empty when AI-001
   * is off or the call failed, in which case the deterministic rules decide.
   */
  llmIntent: string;
  /**
   * The quality gate and governance read from generation. Previously computed,
   * shown, and discarded when the wizard unmounted — leaving `quality_score`
   * null on every row while tab-overview read it.
   */
  sowQualityScore?: number;
  sowQualityChecks?: { section: string; passed: boolean; issue: string | null }[];
  sowRequiredSections?: string[];
  sowSignals?: Record<string, unknown>;
  /**
   * Whether the supplier was named upstream (extraction, chat match, contract
   * call-off) or explicitly chosen at the determination. Drives whether the
   * determination presents it as a suggestion to confirm or a settled choice.
   */
  supplierProvenance?: 'named' | 'chosen';

  // ── Details ─────────────────────────────────────────────────────────────
  title: string;
  supplier: string;
  supplierId: string;
  estimatedValue: number;
  currency: string;
  businessJustification: string;
  deliveryDate: string;
  deliveryLocation: string;
  isUrgent: boolean;
  costCentre: string;
  commodityCode: string;
  commodityCodeLabel: string;
  commodityCandidates?: CommodityClassificationCandidate[];
  commodityClassificationConfirmed?: boolean;
  attachments?: IntakeAttachment[];
  serviceDescription: ServiceDescription | null;
  /**
   * Detail the requester added at the buy-route step to sharpen the match.
   *
   * A field of its own, not appended to `title`. Appending turned the request
   * title into a run-on paragraph — "buy business consulting — IT strategy
   * consulting to define a new product management org structure — IT strategy
   * consulting to define a new product management org structure" — which is
   * then what the request is called everywhere afterwards. The detail belongs
   * to the demand, not to its name.
   */
  demandDetail: string;
  /**
   * Who the order is for, when the checkout collects it. Simple defaulted this
   * to `office` and Expert to empty; the value becomes `shipToLocationId`, which
   * the governed checkout rejects when it is not an approved ship-to — so the
   * same order could pass in one density and fail in the other.
   */
  recipient: string;

  // ── Catalogue / contract resolution (the buy-route step) ────────────────
  catalogueItems: { itemId: string; name: string; quantity: number; unitPrice: number; supplierId: string }[];
  preCheckOutcome: IntakeRouteOutcome;
  contractId: string;
  contractTitle: string;
  workflowTemplateId: string;

  // ── Risk inputs (asked on Details) ──────────────────────────────────────
  miniIrq: { privilegedAccess: boolean; criticalService: boolean };

  // ── Determination output (shown on Review) ──────────────────────────────
  buyingChannelResult: string;
  /**
   * Determination output, lifted wholesale from the compliance step. Stored on
   * the request as two flat columns — the wizard holds the nested shape.
   */
  sourcingType?: { type: string; reason: string };
  sraStatus: string;
  policyChecks: { label: string; passed: boolean; detail: string }[];
  duplicateCheck: string | null;
  /**
   * Determination output that is persisted rather than displayed and dropped.
   * The wizard lifts the whole result via onUpdate; these are the parts the
   * request and its compliance record keep.
   */
  buyingChannelSlug?: string;
  approvalChain?: string;
  matchedRuleName?: string;
  materiality?: MaterialityResult;
  inherentRisk?: InherentRiskResult;
  screening?: ScreeningResult;
  referral?: ReferralResult;
  matchingRiskAssessments?: MatchingRiskAssessmentSummary[];
  // Determination signals that overlay conditional lifecycle steps (item 7+11).
  riskAssessmentRequired: boolean;
  supplierOnboardingRequired: boolean;

  // ── Routing ─────────────────────────────────────────────────────────────
  additionalReviewers: string[];
  notes: string;

  // Requester context (universal — applies to all paths). Country is derived
  // from the requestor's profile (read-only); beneficiary defaults to self.
  requesterCountry: string;
  requesterCountryCode: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  beneficiaryCountryCode: string;
}

export const INITIAL_INTAKE_DATA: IntakeFormData = {
  category: '',
  categoryDescription: '',
  llmIntent: '',
  title: '',
  supplier: '',
  supplierId: '',
  estimatedValue: 0,
  currency: 'EUR',
  businessJustification: '',
  deliveryDate: '',
  deliveryLocation: '',
  isUrgent: false,
  costCentre: '',
  commodityCode: '',
  commodityCodeLabel: '',
  commodityCandidates: [],
  commodityClassificationConfirmed: false,
  attachments: [],
  serviceDescription: null,
  demandDetail: '',
  recipient: '',
  catalogueItems: [],
  preCheckOutcome: '',
  contractId: '',
  contractTitle: '',
  workflowTemplateId: '',
  buyingChannelResult: '',
  miniIrq: { privilegedAccess: false, criticalService: false },
  sraStatus: '',
  policyChecks: [],
  duplicateCheck: null,
  buyingChannelSlug: undefined,
  approvalChain: undefined,
  riskAssessmentRequired: false,
  supplierOnboardingRequired: false,
  additionalReviewers: [],
  notes: '',
  requesterCountry: '',
  requesterCountryCode: '',
  beneficiaryId: '',
  beneficiaryName: '',
  beneficiaryCountry: '',
  beneficiaryCountryCode: '',
};

/**
 * Display labels for the broad commodity category.
 *
 * The category is internal routing metadata the requester never picks (ADR-0005);
 * this map exists so a derived value can be shown back to them in words.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  goods: 'Goods',
  services: 'Services',
  software: 'Software / IT',
  consulting: 'Consulting',
  'contingent-labour': 'Contingent Labour',
  'contract-renewal': 'Contract Renewal',
  'supplier-onboarding': 'Supplier Onboarding',
  catalogue: 'Catalogue Purchase',
};

/**
 * The request id both submit paths use.
 *
 * Known weakness, carried over deliberately rather than changed under a
 * refactor: this is regenerated per attempt and both idempotency keys derive
 * from it, so a retry gets a new key and the 9000-value space can collide.
 * Fixing it is a data-layer change, not a UI one.
 */
export function generateRequestId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `REQ-2025-${num}`;
}
