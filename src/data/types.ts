// Status + Priority stay as union types (they drive the lifecycle state machine).
export type RequestStatus = 'draft' | 'intake' | 'validation' | 'approval' | 'risk' | 'onboarding' | 'sourcing' | 'contracting' | 'po' | 'receipt' | 'invoice' | 'payment' | 'completed' | 'cancelled' | 'referred-back';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// Categories and channels are widened to `string` so admin-created values work at runtime.
// Use KNOWN_CATEGORIES / KNOWN_CHANNELS for compile-time hint arrays.
export type RequestCategory = string;
export type BuyingChannel = string;

/** Candidate commodity/service-family classifications shown for confirmation. */
export interface CommodityClassificationCandidate {
  code: string;
  label: string;
  probability: number;
  reason: string;
  source: 'rules' | 'ai' | 'user';
}

export interface IntakeAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  extractedText: string;
  dataBase64?: string;
  extractionStatus: 'complete' | 'partial' | 'failed';
}

export const KNOWN_CATEGORIES = [
  'goods', 'services', 'software', 'consulting', 'contingent-labour', 'catalogue',
] as const;

export const KNOWN_CHANNELS = [
  'procurement-led', 'business-led', 'framework-call-off', 'catalogue',
] as const;
export type RiskRating = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated' | 'info-requested';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  initials: string;
  isOOO: boolean;
  delegateId?: string;
  avatar?: string;
  /** Home country of the user — drives requester location + future country workflows. */
  country?: string;
  /** ISO 3166-1 alpha-2 code for `country` (e.g. "DE"). */
  countryCode?: string;
}

export interface ProcurementRequest {
  id: string;
  title: string;
  description: string;
  category: RequestCategory;
  status: RequestStatus;
  priority: Priority;
  value: number;
  currency: string;
  requestorId: string;
  ownerId: string;
  supplierId?: string;
  /**
   * Why the requester chose a supplier outside the category's preferred list.
   * Set by the server only when it found such an override, so its presence is
   * the record that one was made (and asked a category manager to agree).
   */
  supplierOverrideReason?: string;
  contractId?: string;
  poId?: string;
  /** Durable requisition created from the request before a PO is released. */
  requisitionId?: string;
  /** Risk evidence selected during governed checkout. */
  riskAssessmentId?: string;
  /** Resolved fulfilment/governance outcome, e.g. auto-approved or approval. */
  fulfilmentStatus?: PurchaseRequisitionStatus;
  buyingChannel: BuyingChannel;
  /**
   * The determined sourcing route ('new-event' | 'renewal' | 'benchmarking' |
   * 'none'). Computed at intake by determineSourcingType(); persisted so that
   * 'new-event' still means something after the wizard unmounts — previously it
   * was rendered, exported to Markdown and then discarded.
   */
  sourcingType?: string;
  sourcingTypeReason?: string;
  /** Approval chain fixed by the matched routing rule; null falls back to the value band. */
  approvalChain?: string;
  /**
   * The determination the front door made at intake. Persisted so the request
   * carries its own governance record — these used to live only in wizard state
   * and were discarded when it unmounted.
   */
  inherentRiskTier?: string;
  materialityTier?: string;
  riskAssessmentRequired?: boolean;
  screeningOutcome?: string;
  referralDisposition?: string;
  commodityCode: string;
  commodityCodeLabel: string;
  commodityCandidates?: CommodityClassificationCandidate[];
  commodityClassificationConfirmed?: boolean;
  /** Retained uploaded intake sources and their extracted-text provenance. */
  attachments?: IntakeAttachment[];
  costCentre: string;
  budgetOwner: string;
  businessJustification: string;
  deliveryDate: string;
  isUrgent: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * When the current stage is due, or null when its node sets no `slaDays`.
   *
   * Null is a written value, not an absence: a transition into a stage with no
   * SLA must *clear* the previous stage's deadline. Typed `string | undefined`
   * while the writers only ever set it, which is how a request moved out of a
   * 1-day Intake and kept the intake deadline through a 20-day Sourcing.
   */
  slaDeadline?: string | null;
  daysInStage: number;
  isOverdue: boolean;
  referBackCount: number;
  workflowTemplateId?: string;
  /** Requester's country — auto-derived from the requestor's profile (read-only). */
  requesterCountry?: string;
  requesterCountryCode?: string;
  /**
   * Who the request is for. Defaults to the requestor ("self"); set to another
   * directory user when buying on behalf of someone else. "Self" is derived:
   * `!beneficiaryId || beneficiaryId === requestorId`.
   */
  beneficiaryId?: string;
  beneficiaryName?: string;
  beneficiaryCountry?: string;
  beneficiaryCountryCode?: string;
}

export interface StageHistoryEntry {
  requestId: string;
  stage: RequestStatus;
  enteredAt: string;
  completedAt?: string;
  ownerId: string;
  action?: string;
  notes?: string;
}

export interface Comment {
  id: string;
  requestId: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  content: string;
  timestamp: string;
  isInternal: boolean;
  attachments?: string[];
  /** Optional lifecycle stage the comment is attached to. */
  stage?: string;
  /** User IDs mentioned via @handle. Populated at create time. */
  mentions?: string[];
}

export interface ApprovalEntry {
  id: string;
  requestId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: ApprovalStatus;
  requestedAt: string;
  respondedAt?: string;
  comments?: string;
  delegatedTo?: string;
  /** Position in the chain — steps run in order. */
  stepOrder?: number;
  /** 'role' means any holder of approverRole may act; 'person' names one. */
  assignmentMode?: 'person' | 'role';
  /** Who actually responded, which is not always the person asked. */
  decidedBy?: string;
  decidedByName?: string;
}

export interface AuditEntry {
  id: string;
  requestId?: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  objectType: string;
  objectId: string;
  detail: string;
  type: 'system' | 'human' | 'ai' | 'warning' | 'block';
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  riskRating: RiskRating;
  activeContracts: number;
  totalSpend12m: number;
  onboardingStatus: 'completed' | 'in-progress' | 'not-started';
  sraStatus: 'valid' | 'expiring' | 'expired' | 'not-assessed';
  sraExpiryDate?: string;
  screeningStatus: 'clear' | 'flagged' | 'pending';
  categories: string[];
  tier: 1 | 2 | 3;
  /** On the preferred-supplier list (PSL). Soft preference, not a hard gate. */
  preferred?: boolean;
  /**
   * Created from a demand and never transacted with.
   *
   * Distinct from `onboardingStatus !== 'completed'`: an established supplier
   * can be mid-data-refresh, whereas a prospective one has no history at all.
   * Sourcing invitations and the risk assessment both need that distinction.
   */
  prospective?: boolean;
  /** The demand that brought this supplier into the system, for audit. */
  createdFromRequestId?: string;
  duns: string;
  address: string;
  primaryContact: string;
  primaryContactEmail: string;
  certifications: { name: string; expiryDate: string; status: 'valid' | 'expiring' | 'expired' }[];
  spendHistory: { year: number; amount: number }[];
  performanceScore: number;
}

export interface Contract {
  id: string;
  title: string;
  supplierId: string;
  supplierName: string;
  value: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'under-review' | 'active' | 'expiring' | 'expired' | 'terminated';
  ownerId: string;
  ownerName: string;
  department: string;
  category: string;
  renewalDate?: string;
  utilisationPercentage: number;
  /** A framework / master agreement: not directly transactable, but a SOW can be authored under it. */
  isFramework?: boolean;
  linkedRequestIds: string[];
  /** Coverage metadata is loaded from the normalized scope tables when available. */
  coverageStatus?: 'complete' | 'incomplete' | 'draft';
  activeScopeVersionId?: string;
  scopeNarrative?: string;
  scopeServiceFamily?: string;
  scopeDeliverables?: ContractScopeDeliverable[];
  scopeExclusions?: ContractScopeExclusion[];
  scopeGeographies?: string[];
  scopeBusinessUnits?: string[];
}

/** Effective-dated, auditable coverage for a contract. */
export interface ContractScopeVersion {
  id: string;
  contractId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'draft' | 'active' | 'superseded';
  scopeNarrative: string;
  serviceFamily?: string;
  eligibleCategories: string[];
  geographies: string[];
  businessUnits: string[];
  callOffRequirements: string[];
  completeness: 'complete' | 'incomplete';
  provenance: 'curated' | 'inferred' | 'owner-entered';
}

export interface ContractScopeDeliverable {
  id: string;
  scopeVersionId: string;
  name: string;
  aliases: string[];
  description?: string;
  required: boolean;
}

export interface ContractScopeExclusion {
  id: string;
  scopeVersionId: string;
  term: string;
  reason?: string;
}

export interface ContractMatchCandidate {
  contractId: string;
  scopeVersionId: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  exclusionsChecked: string[];
}

export interface ContractMatchResponse {
  sufficient: boolean;
  route: 'contract' | 'clarify' | 'full-request';
  missingFields: string[];
  questions: string[];
  candidates: ContractMatchCandidate[];
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  value: number;
  status: 'draft' | 'submitted' | 'acknowledged' | 'received' | 'partially-received' | 'closed';
  createdAt: string;
  deliveryDate: string;
  contractId?: string;
  requestId?: string;
  requisitionId?: string;
  riskAssessmentId?: string;
  costCentre?: string;
  budgetOwner?: string;
  accountType?: string;
  shipToLocationId?: string;
  beneficiaryId?: string;
  lineItems: { description: string; quantity: number; unitPrice: number; received: number }[];
  /** Who is handling this order. There was no owner concept at all before. */
  ownerId?: string;
  ownerName?: string;
}

/** Lifecycle of the internal requisition that precedes PO creation. */
export type PurchaseRequisitionStatus =
  | 'draft'
  | 'submitted'
  | 'pending-approval'
  | 'risk-review'
  | 'contract-amendment-required'
  | 'approved'
  | 'po-created'
  | 'cancelled';

export type PurchaseRequisitionRoute = 'catalogue' | 'contract-call-off';

/** A durable line copied from a catalogue item or a contract call-off. */
export interface RequestLine {
  id: string;
  requestId: string;
  requisitionId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  supplierId: string;
  contractId: string;
  catalogueItemId?: string;
  riskAssessmentId?: string;
  commodityCode?: string;
  deliveryDate?: string;
  /** Snapshotted from the catalogue item so a later re-code cannot rewrite a placed order. */
  supplierPartId?: string;
  /** UN/CEFACT code (EA, PK). `unit` stays the display word. */
  unitOfMeasureCode?: string;
  /** Line ordinal — a downstream order requires one, and an id is not it. */
  lineNumber?: number;
}

/** Profile defaults keep checkout short while preserving routing inputs. */
export interface ProcurementProfile {
  userId: string;
  legalEntity?: string;
  defaultCurrency: string;
  costCentre?: string;
  budgetOwner?: string;
  accountType?: string;
  beneficiaryId?: string;
  approvedShipToLocations: { id: string; label: string; address?: string }[];
  defaultShipToLocationId?: string;
  defaultCommodityCode?: string;
}

export interface PurchaseRequisition {
  id: string;
  requestId: string;
  route: PurchaseRequisitionRoute;
  status: PurchaseRequisitionStatus;
  supplierId: string;
  contractId: string;
  riskAssessmentId?: string;
  totalValue: number;
  currency: string;
  needByDate?: string;
  serviceStartDate?: string;
  serviceEndDate?: string;
  purpose: string;
  costCentre?: string;
  budgetOwner?: string;
  accountType?: string;
  shipToLocationId?: string;
  beneficiaryId?: string;
  approvalRequired: boolean;
  riskReviewRequired: boolean;
  contractAmendmentRequired: boolean;
  contractScopeVersionId?: string | null;
  contractMatchScore?: number;
  contractMatchReasons?: string[];
  contractMatchAlgorithmVersion?: string;
  contractMatchInputFingerprint?: string;
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  status: 'submitted' | 'under-review' | 'matched' | 'approved' | 'scheduled' | 'paid' | 'disputed';
  invoiceDate: string;
  dueDate: string;
  poId?: string;
  matchStatus: 'matched' | 'partial-match' | 'unmatched' | 'variance';
  matchVariance?: number;
  paidDate?: string;
}

/**
 * Supplier payment / banking master — vendor-data foundation (not an R1 flow).
 * Read through the `payment` source-connector port. `iban` and `bic` are
 * sensitive: they must be masked by default and shown only to entitled roles
 * when surfaced (per the platform's masking rule).
 */
export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  bankName: string;
  accountHolder: string;
  /** Sensitive — mask by default. */
  iban: string;
  /** Sensitive — mask by default. */
  bic: string;
  currency: string;
  /** e.g. 'Net 30', 'Net 60'. */
  paymentTerms: string;
  preferredMethod: 'bank-transfer' | 'card' | 'direct-debit';
  verificationStatus: 'verified' | 'pending' | 'unverified';
  verifiedAt?: string;
}

export interface Notification {
  id: string;
  type: 'approval-request' | 'status-update' | 'sla-warning' | 'escalation' | 'comment' | 'system-alert' | 'ai-insight';
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  relatedId?: string;
}

export interface KPIDataPoint {
  month: string;
  openDemand: number;
  activeSourcing: number;
  avgCycleTime: number;
  complianceRate: number;
  totalSpend: number;
  managedSpend: number;
  policyBreaches: number;
  firstTimeRight: number;
  requestsCompleted: number;
  requestsSubmitted: number;
}

export interface RoutingRule {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'disabled';
  conditions: { field: string; operator: string; value: string }[];
  /**
   * The chain this rule forces, as an approval_chains id, or '' to let the
   * value band decide. It held a role-path string while intake looked it up as
   * an id, so it never matched and the band always won — silently.
   */
  action: { buyingChannel: BuyingChannel; approvalChain: string };
  description: string;
  lastModified: string;
  category: string;
  /**
   * Evaluation order, ascending. 100 for an ordinary rule, 900 for a seeded
   * catch-all. Rules were ordered by id, so the catch-alls sorted last only
   * because they happen to be named RR-9xx — one admin rule named later in the
   * alphabet would have shadowed every specific rule behind it.
   */
  priority?: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  /**
   * Stage nodes carry their own governance: `role` owns the stage, `slaDays`
   * sets its deadline, `gate` says whether leaving it needs a human, `purpose`
   * is the exit criteria shown to that person. All optional so templates saved
   * before these existed stay valid — see lib/workflow/node-config.ts.
   */
  /**
   * Buying channels whose lifecycle this template defines.
   *
   * Every template claims at least one; an unclaimed one runs no request
   * (`test:channel-stages` holds that). The side-process templates that claimed
   * none — supplier onboarding and contract renewal — were retired on
   * 2026-09-25 without ever having run.
   */
  channels?: BuyingChannel[];
  nodes: {
    id: string;
    type: string;
    label: string;
    x?: number;
    y?: number;
    role?: string;
    slaDays?: number;
    purpose?: string;
    gate?: 'auto' | 'manual';
  /** For an `integration` node: which kind the designer dropped. Without it
   *  the three collapse into one on reload. */
  integrationKind?: string;
  }[];
  edges: {
    source: string;
    target: string;
    /** Caption on the canvas. Display only — it was parsed, and `> €5K` never
     *  matched, so the branch it guarded was taken unconditionally. */
    label?: string;
    /** What actually decides the branch: the same {field, operator, value}
     *  shape routing rules and form triggers use, governed thresholds
     *  included. */
    condition?: { field: string; operator: string; value: string } | null;
  }[];
  /** What the requester is told about the channel this template runs — a headline. */
  requesterHeadline?: string;
  /** One sentence under the headline: what happens, in the requester's words. */
  requesterDescription?: string;
}

export type RiskAssessmentCategory =
  | 'security'
  | 'financial'
  | 'operational'
  | 'data-privacy'
  | 'compliance'
  | 'esg';
export type RiskAssessmentStatus = 'draft' | 'in-review' | 'completed' | 'expired';

export interface RiskAssessment {
  id: string;
  title: string;
  subjectType: 'supplier' | 'contract';
  supplierId?: string;
  contractId?: string;
  category: RiskAssessmentCategory;
  riskLevel: RiskRating;
  score: number;
  status: RiskAssessmentStatus;
  assessorId: string;
  assessorName: string;
  assessedAt: string;
  validUntil: string;
  summary: string;
  mitigations: string[];
  reusable: boolean;
  /** Highest data class the assessment covers (for reuse comparison). */
  assessedDataClass?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  linkedRequestIds: string[];
}

export interface AIAgent {
  id: string;
  name: string;
  type: 'classification' | 'validation' | 'extraction' | 'recommendation' | 'knowledge-base' | 'anomaly-detection' | 'status';
  status: 'active' | 'draft' | 'disabled';
  accuracy: number;
  decisionsMade: number;
  lastUpdated: string;
  description: string;
  /**
   * Type-specific configuration. Only the status agent has one today
   * (lib/assistant/status-config.ts); it is read through that module's
   * defensive parser, never trusted as-is.
   */
  config?: unknown;
}

export interface AIResponseLink {
  label: string;
  path: string;
  icon?: string;
}

export interface AIResponse {
  keywords: string[];
  context: 'intake' | 'chat' | 'approval' | 'supplier' | 'general';
  response: string;
  confidence: number;
  suggestions?: string[];
  autoFill?: Record<string, string>;
  links?: AIResponseLink[];
}

// ── Assistant chatbot types ──────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  title: string;
  body: string;
  source: string;
  tags: string[];
}

/**
 * Support ticket. The platform's own store is the system of record — there is no
 * upstream service desk in this release.
 *
 * `waiting-on-user` exists to stop the SLA clock while the requester, not the
 * agent, is the blocker; without it every ticket awaiting a reply reads as an
 * agent-side breach. `cancelled` is the terminal state for tickets raised in
 * error, kept distinct from `resolved` so it can be excluded from resolution
 * metrics.
 */
export type TicketStatus =
  | 'open'
  | 'in-progress'
  | 'waiting-on-user'
  | 'resolved'
  | 'cancelled';

/** Statuses that take a ticket out of the active queue. */
export const TERMINAL_TICKET_STATUSES: TicketStatus[] = ['resolved', 'cancelled'];

export interface Ticket {
  id: string;
  summary: string;
  context: string;
  status: TicketStatus;
  createdAt: string;
  createdBy: string;
  category?: string;
  priority?: string;
  /** Assigned agent. Unassigned tickets are the inbox's default triage view. */
  ownerId?: string;
  ownerName?: string;
  /** Which intake path raised it — 'form' or 'assistant'. */
  source?: string;
  /** Verbatim assistant conversation, when the ticket came from chat. */
  transcript?: string;
  dueAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  authorId?: string;
  authorName?: string;
  authorInitials?: string;
  body: string;
  /** Agent-only note. Never returned to a requester — filtered in the data layer. */
  isInternal: boolean;
  createdAt: string;
}

/**
 * Object kinds a ticket can reference. A subset of the connector port vocabulary
 * (`SourceObject`) — the objects a support query is plausibly *about*. Kept as a
 * const array so the picker renders from it and cannot drift from the type.
 */
export const TICKET_LINK_TYPES = [
  'purchase-request',
  'purchase-order',
  'supplier',
  'contract',
  'invoice',
] as const;

export type TicketLinkType = (typeof TICKET_LINK_TYPES)[number];

/** Human labels + the route each reference deep-links to. */
export const TICKET_LINK_META: Record<TicketLinkType, { label: string; path: (id: string) => string }> = {
  'purchase-request': { label: 'Request', path: (id) => `/requests/${id}` },
  'purchase-order': { label: 'Purchase order', path: (id) => `/purchasing/orders/${id}` },
  supplier: { label: 'Supplier', path: (id) => `/suppliers/${id}` },
  contract: { label: 'Contract', path: (id) => `/contracts/${id}` },
  // The invoice register has no per-id route, so a link lands on the list.
  invoice: { label: 'Invoice', path: () => '/purchasing/invoices' },
};

/**
 * A reference from a ticket to another object, so whoever picks the ticket up
 * can see what it is about without hunting. Many-to-many: a ticket is routinely
 * about a PO *and* the supplier behind it.
 */
export interface TicketLink {
  id: string;
  ticketId: string;
  objectType: TicketLinkType;
  objectId: string;
  /** Display label captured at link time — avoids a query per link when rendering. */
  label?: string;
  createdAt: string;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatAnswerTurn {
  type: 'chat-answer';
  content: string;
  source?: string;
}

export interface DeepLinkTurn {
  type: 'deep-link';
  label: string;
  description?: string;
  path: string;
}

export interface ConfirmTurn {
  type: 'confirm';
  /**
   * What the action will do, built server-side from `actionType` and
   * `actionParams` (api/_action-description.ts). Not the model's wording — the
   * card must describe the write that is actually queued.
   */
  readBack: string;
  /** The resolved targets behind the sentence, so a wrong subject is visible. */
  facts?: Array<{ label: string; value: string }>;
  actionType: string;
  actionParams: Record<string, unknown>;
  actionId: string;
}

export interface SuggestionChipsTurn {
  type: 'suggestion-chips';
  chips: Array<{ label: string; prompt: string }>;
}

export type AssistantTurn = ChatAnswerTurn | DeepLinkTurn | ConfirmTurn | SuggestionChipsTurn;

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  turns?: AssistantTurn[];
  suggestions?: string[];
  links?: Array<{ label: string; path: string }>;
}

/**
 * A request's service description as stored.
 *
 * Declared twice once — this shape in src/lib/db/mappers.ts, and a shorter one
 * in src/data/service-descriptions.ts missing exclusions, the quality gate and
 * all three capture columns. The fixture file's copy typechecked against
 * itself, so nothing caught that the seeds were being written against an older
 * record than the app reads. Entity types belong here; see src/data/README.md.
 */
export interface ServiceDescriptionRecord {
  requestId: string;
  objective: string;
  scope: string;
  exclusions?: string;
  deliverables: string;
  timeline: string;
  resources: string;
  acceptanceCriteria: string;
  pricingModel: string;
  location: string;
  dependencies: string;
  narrative: string;
  /** The quality gate, computed at generation and previously discarded. */
  qualityScore?: number;
  qualityChecks?: { section: string; passed: boolean; issue: string | null }[];
  /** The capture-time governance read the description was written against. */
  signals?: Record<string, unknown>;
  /** Sections that read made mandatory — what a reviewer should expect to find. */
  requiredSections?: string[];
  /**
   * How each section came to be filled: `answered`, `assistant-drafted` (the
   * requester accepted a draft after being challenged) or `weak` (challenged,
   * answered thinly, accepted anyway). Lets a reviewer see which parts of a
   * description nobody really wrote.
   */
  captureFlags?: Partial<Record<string, string>>;
}
