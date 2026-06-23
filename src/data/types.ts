// Status + Priority stay as union types (they drive the lifecycle state machine).
export type RequestStatus = 'draft' | 'intake' | 'validation' | 'approval' | 'sourcing' | 'contracting' | 'po' | 'receipt' | 'invoice' | 'payment' | 'completed' | 'cancelled' | 'referred-back';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// Categories and channels are widened to `string` so admin-created values work at runtime.
// Use KNOWN_CATEGORIES / KNOWN_CHANNELS for compile-time hint arrays.
export type RequestCategory = string;
export type BuyingChannel = string;

export const KNOWN_CATEGORIES = [
  'goods', 'services', 'software', 'consulting', 'contingent-labour',
  'contract-renewal', 'supplier-onboarding', 'catalogue',
] as const;

export const KNOWN_CHANNELS = [
  'procurement-led', 'business-led', 'direct-po', 'framework-call-off', 'catalogue',
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
  contractId?: string;
  poId?: string;
  buyingChannel: BuyingChannel;
  commodityCode: string;
  commodityCodeLabel: string;
  costCentre: string;
  budgetOwner: string;
  businessJustification: string;
  deliveryDate: string;
  isUrgent: boolean;
  createdAt: string;
  updatedAt: string;
  slaDeadline?: string;
  daysInStage: number;
  isOverdue: boolean;
  referBackCount: number;
  workflowTemplateId?: string;
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
  linkedRequestIds: string[];
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
  lineItems: { description: string; quantity: number; unitPrice: number; received: number }[];
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
  action: { buyingChannel: BuyingChannel; approvalChain: string };
  description: string;
  matchCount: number;
  lastModified: string;
  category: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  nodes: { id: string; type: string; label: string; x: number; y: number }[];
  edges: { source: string; target: string; label?: string }[];
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
  type: 'classification' | 'validation' | 'extraction' | 'recommendation' | 'knowledge-base' | 'anomaly-detection';
  status: 'active' | 'draft' | 'disabled';
  accuracy: number;
  decisionsMade: number;
  lastUpdated: string;
  description: string;
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

export interface Ticket {
  id: string;
  summary: string;
  context: string;
  status: 'open' | 'in-progress' | 'resolved';
  createdAt: string;
  createdBy: string;
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
  readBack: string;
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
