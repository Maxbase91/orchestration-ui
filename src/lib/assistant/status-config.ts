// What the status agent may answer: per object, which attributes can be asked
// about, and per role, whose records.
//
// The assistant's lookups each carried their own column list — the browser
// one in capabilities/lookup.ts, the server one in api/chat.ts — and they
// disagreed about what a person could learn about a request. The Status
// Answers agent (Admin → AI agents) now owns that decision:
//
//  • objects[<object>] lists every attribute of the object's data model, with
//    the label the chatbot uses, whether it is on at all, whether it is part
//    of the default status answer ("summary") or only answered when asked for
//    by name ("ask"), and who may see it.
//  • access[<role>][<object>] is None / Own / All — whose records that role can
//    ask about. "Own" is defined per object in status-answer.ts.
//
// An attribute the data model gains later is listed automatically, switched
// off, until an admin enables it (mergeDiscoveredAttributes) — and
// test:status-agent fails until it has an entry here.
//
// Dependency-free, relative imports: api/chat.ts applies the same config.
import type { Role } from '../../config/roles.js';

export type StatusObject = 'request' | 'purchase-order' | 'invoice' | 'contract' | 'supplier' | 'approval';
export type StatusAccess = 'none' | 'own' | 'all';
export type AttributeVisibility = 'everyone' | 'procurement';
export type AttributeMode = 'summary' | 'ask' | 'off';

export interface StatusAttribute {
  key: string;
  label: string;
  /** Off, answered only when asked for by name, or part of the default answer. */
  mode: AttributeMode;
  visibility: AttributeVisibility;
  /** Computed for the answer rather than stored on the record (e.g. the next stage). */
  derived?: boolean;
}

export interface StatusAgentConfig {
  objects: Record<StatusObject, StatusAttribute[]>;
  access: Record<Role, Record<StatusObject, StatusAccess>>;
}

export const STATUS_OBJECTS: readonly StatusObject[] = ['request', 'approval', 'purchase-order', 'invoice', 'contract', 'supplier'];

export const STATUS_OBJECT_META: Record<StatusObject, { label: string; plural: string; idPattern: RegExp | null; path: (id: string) => string }> = {
  request: { label: 'Request', plural: 'Requests', idPattern: /\bREQ-\d{4}-\d+\b/i, path: (id) => `/requests/${id}` },
  approval: { label: 'Approval', plural: 'Approvals waiting on you', idPattern: null, path: (id) => `/requests/${id}` },
  'purchase-order': { label: 'Purchase order', plural: 'Purchase orders', idPattern: /\bPO-[A-Z0-9-]*\d[A-Z0-9-]*\b/i, path: (id) => `/purchasing/orders/${id}` },
  invoice: { label: 'Invoice', plural: 'Invoices', idPattern: /\bINV-[A-Z0-9-]*\d[A-Z0-9-]*\b/i, path: () => '/purchasing/invoices' },
  contract: { label: 'Contract', plural: 'Contracts', idPattern: /\bCON-[A-Z0-9-]*\d[A-Z0-9-]*\b/i, path: (id) => `/contracts/${id}` },
  supplier: { label: 'Supplier', plural: 'Suppliers', idPattern: /\bSUP-[A-Z0-9-]*\d[A-Z0-9-]*\b/i, path: (id) => `/suppliers/${id}` },
};

/** Roles that see attributes marked "procurement roles only". */
export const PROCUREMENT_ROLES: readonly Role[] = ['procurement-manager', 'vendor-manager', 'operations-lead', 'admin'];

type Row = [key: string, label: string, mode: AttributeMode, visibility?: AttributeVisibility, derived?: 'derived'];

// One row per attribute of the data model, plus the derived ones. The default
// answers "where is it, who has it, what happens next"; anything identifying a
// person beyond their name, or commercially sensitive, is procurement-only.
const DEFAULTS: Record<StatusObject, Row[]> = {
  request: [
    ['title', 'Title', 'summary'],
    ['status', 'Stage', 'summary'],
    ['ownerName', 'With', 'summary', 'everyone', 'derived'],
    ['stageTarget', 'Time in stage', 'summary', 'everyone', 'derived'],
    ['nextStage', 'Next', 'summary', 'everyone', 'derived'],
    ['pendingApprovers', 'Waiting on', 'summary', 'everyone', 'derived'],
    ['requestorName', 'Raised by', 'ask', 'everyone', 'derived'],
    ['supplierName', 'Supplier', 'ask', 'everyone', 'derived'],
    ['value', 'Value', 'ask'],
    ['buyingChannel', 'Buying channel', 'ask'],
    ['category', 'Category', 'ask'],
    ['deliveryDate', 'Need-by date', 'ask'],
    ['costCentre', 'Charged to', 'ask'],
    ['priority', 'Priority', 'ask'],
    ['isUrgent', 'Urgent', 'ask'],
    ['createdAt', 'Raised on', 'ask'],
    ['slaDeadline', 'Stage due by', 'ask'],
    ['isOverdue', 'Overdue', 'ask'],
    ['beneficiaryName', 'Buying for', 'ask'],
    ['poId', 'Purchase order', 'ask'],
    ['contractId', 'Contract', 'ask'],
    ['commodityCodeLabel', 'Commodity', 'ask'],
    ['description', 'Description', 'ask'],
    ['businessJustification', 'Justification', 'ask'],
    ['sourcingType', 'Sourcing type', 'ask'],
    ['fulfilmentStatus', 'Fulfilment', 'ask'],
    ['riskAssessmentRequired', 'Risk assessment needed', 'ask'],
    ['referBackCount', 'Times referred back', 'ask'],
    ['approvalChain', 'Approval chain', 'ask', 'procurement'],
    ['inherentRiskTier', 'Inherent risk', 'ask', 'procurement'],
    ['materialityTier', 'Materiality', 'ask', 'procurement'],
    ['screeningOutcome', 'Supplier screening', 'ask', 'procurement'],
    ['supplierOverrideReason', 'Reason for a non-preferred supplier', 'ask', 'procurement'],
    ['id', 'Request id', 'off'],
    ['currency', 'Currency', 'off'],
    ['requestorId', 'Requestor id', 'off'],
    ['ownerId', 'Owner id', 'off'],
    ['supplierId', 'Supplier id', 'off'],
    ['beneficiaryId', 'Beneficiary id', 'off'],
    ['requisitionId', 'Requisition', 'off'],
    ['riskAssessmentId', 'Risk assessment', 'off'],
    ['sourcingTypeReason', 'Sourcing type reason', 'off', 'procurement'],
    ['referralDisposition', 'Disposition', 'off', 'procurement'],
    ['commodityCode', 'Commodity code', 'off'],
    ['commodityCandidates', 'Commodity candidates', 'off'],
    ['commodityClassificationConfirmed', 'Commodity confirmed', 'off'],
    ['attachments', 'Attachments', 'off'],
    ['budgetOwner', 'Budget owner', 'off'],
    ['updatedAt', 'Last updated', 'off'],
    ['daysInStage', 'Days in stage', 'off'],
    ['workflowTemplateId', 'Workflow template', 'off', 'procurement'],
    ['requesterCountry', 'Requesting from', 'off'],
    ['requesterCountryCode', 'Requesting-from code', 'off'],
    ['beneficiaryCountry', 'Beneficiary country', 'off'],
    ['beneficiaryCountryCode', 'Beneficiary country code', 'off'],
  ],
  approval: [
    ['requestId', 'Request', 'summary'],
    ['requestTitle', 'For', 'summary', 'everyone', 'derived'],
    ['approverRole', 'As', 'summary'],
    ['waitingDays', 'Waiting', 'summary', 'everyone', 'derived'],
    ['requestedAt', 'Asked on', 'ask'],
    ['status', 'Status', 'ask'],
    ['approverName', 'Approver', 'ask'],
    ['stepOrder', 'Step', 'ask'],
    ['comments', 'Comments', 'ask'],
    ['respondedAt', 'Answered on', 'ask'],
    ['decidedByName', 'Decided by', 'ask'],
    ['id', 'Approval id', 'off'],
    ['approverId', 'Approver id', 'off'],
    ['delegatedTo', 'Delegated to', 'off'],
    ['assignmentMode', 'Assigned by', 'off'],
    ['decidedBy', 'Decided by (id)', 'off'],
  ],
  'purchase-order': [
    ['status', 'Status', 'summary'],
    ['supplierName', 'Supplier', 'summary'],
    ['value', 'Value', 'summary'],
    ['deliveryDate', 'Delivery', 'summary'],
    ['requestId', 'Request', 'ask'],
    ['contractId', 'Contract', 'ask'],
    ['createdAt', 'Raised on', 'ask'],
    ['costCentre', 'Charged to', 'ask'],
    ['lineItems', 'Lines', 'ask'],
    ['ownerName', 'Owner', 'ask'],
    ['accountType', 'Account type', 'ask', 'procurement'],
    ['id', 'PO id', 'off'],
    ['supplierId', 'Supplier id', 'off'],
    ['requisitionId', 'Requisition', 'off'],
    ['riskAssessmentId', 'Risk assessment', 'off'],
    ['budgetOwner', 'Budget owner', 'off'],
    ['shipToLocationId', 'Ship-to location', 'off'],
    ['beneficiaryId', 'Beneficiary id', 'off'],
    ['ownerId', 'Owner id', 'off'],
  ],
  invoice: [
    ['status', 'Status', 'summary'],
    ['supplierName', 'Supplier', 'summary'],
    ['amount', 'Amount', 'summary'],
    ['dueDate', 'Due', 'summary'],
    ['matchStatus', 'Match', 'summary'],
    ['paidDate', 'Paid on', 'ask'],
    ['invoiceDate', 'Invoice date', 'ask'],
    ['poId', 'Purchase order', 'ask'],
    ['matchVariance', 'Match variance', 'ask'],
    ['id', 'Invoice id', 'off'],
    ['supplierId', 'Supplier id', 'off'],
    ['currency', 'Currency', 'off'],
  ],
  contract: [
    ['status', 'Status', 'summary'],
    ['supplierName', 'Supplier', 'summary'],
    ['endDate', 'Ends', 'summary'],
    ['expiresIn', 'Expires in', 'summary', 'everyone', 'derived'],
    ['utilisationPercentage', 'Used', 'summary'],
    ['title', 'Title', 'ask'],
    ['value', 'Value', 'ask', 'procurement'],
    ['startDate', 'Starts', 'ask'],
    ['renewalDate', 'Renewal date', 'ask'],
    ['ownerName', 'Owner', 'ask'],
    ['department', 'Department', 'ask'],
    ['category', 'Category', 'ask'],
    ['isFramework', 'Framework', 'ask'],
    ['coverageStatus', 'Coverage', 'ask'],
    ['scopeNarrative', 'Scope', 'ask'],
    ['scopeServiceFamily', 'Service family', 'ask'],
    // What the record says, beside the status read from the end date. Off: the
    // live status is the answer; an administrator can switch this on.
    ['recordedStatus', 'Recorded status', 'off'],
    ['id', 'Contract id', 'off'],
    ['supplierId', 'Supplier id', 'off'],
    ['ownerId', 'Owner id', 'off'],
    ['linkedRequestIds', 'Linked requests', 'off'],
    ['activeScopeVersionId', 'Scope version', 'off'],
    ['scopeDeliverables', 'Deliverables', 'off'],
    ['scopeExclusions', 'Exclusions', 'off'],
    ['scopeGeographies', 'Geographies', 'off'],
    ['scopeBusinessUnits', 'Business units', 'off'],
  ],
  supplier: [
    ['onboardingStatus', 'Onboarding', 'summary'],
    ['sraStatus', 'Risk assessment', 'summary'],
    ['screeningStatus', 'Screening', 'summary'],
    ['sraExpiryDate', 'Risk assessment valid until', 'ask'],
    ['riskRating', 'Risk rating', 'ask'],
    ['tier', 'Tier', 'ask'],
    ['country', 'Country', 'ask'],
    ['activeContracts', 'Active contracts', 'ask'],
    ['categories', 'Categories', 'ask'],
    ['certifications', 'Certifications', 'ask'],
    ['performanceScore', 'Performance score', 'ask', 'procurement'],
    ['totalSpend12m', 'Spend (12 months)', 'ask', 'procurement'],
    ['primaryContact', 'Contact', 'ask', 'procurement'],
    ['primaryContactEmail', 'Contact email', 'ask', 'procurement'],
    ['id', 'Supplier id', 'off'],
    ['name', 'Name', 'off'],
    ['countryCode', 'Country code', 'off'],
    ['preferred', 'Preferred', 'off'],
    ['prospective', 'Prospective', 'off'],
    ['createdFromRequestId', 'Created from request', 'off'],
    ['duns', 'DUNS number', 'off', 'procurement'],
    ['address', 'Address', 'off', 'procurement'],
    ['spendHistory', 'Spend history', 'off', 'procurement'],
  ],
};

const ALL: Record<StatusObject, StatusAccess> = { request: 'all', approval: 'own', 'purchase-order': 'all', invoice: 'all', contract: 'all', supplier: 'all' };
const OWN: Record<StatusObject, StatusAccess> = { request: 'own', approval: 'own', 'purchase-order': 'own', invoice: 'own', contract: 'own', supplier: 'own' };
const NONE: Record<StatusObject, StatusAccess> = { request: 'none', approval: 'none', 'purchase-order': 'none', invoice: 'none', contract: 'none', supplier: 'none' };

export const DEFAULT_STATUS_CONFIG: StatusAgentConfig = {
  objects: Object.fromEntries(STATUS_OBJECTS.map((object) => [object, DEFAULTS[object].map(([key, label, mode, visibility = 'everyone', derived]) => ({
    key, label, mode, visibility, ...(derived ? { derived: true } : {}),
  }))])) as Record<StatusObject, StatusAttribute[]>,
  // Requesters ask about their own; procurement roles about any; the external
  // supplier role about nothing. Approvals are always the ones waiting on you.
  access: {
    'service-owner': OWN,
    'procurement-manager': ALL,
    'vendor-manager': ALL,
    'operations-lead': ALL,
    admin: ALL,
    supplier: NONE,
  },
};

/** "createdFromRequestId" → "Created from request id", for an attribute nobody labelled yet. */
export function humaniseKey(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const MODES = new Set<AttributeMode>(['summary', 'ask', 'off']);
const VISIBILITIES = new Set<AttributeVisibility>(['everyone', 'procurement']);
const ACCESSES = new Set<StatusAccess>(['none', 'own', 'all']);

/**
 * The stored config over the defaults, read defensively — like
 * policyConfigFromRow: a hand-edited or partial row keeps every attribute it
 * does not mention at its default, and a malformed value falls back rather than
 * reaching an answer.
 */
export function statusConfigFromStored(raw: unknown): StatusAgentConfig {
  const stored = (raw && typeof raw === 'object' ? raw : {}) as Partial<{ objects: Record<string, unknown>; access: Record<string, unknown> }>;
  const objects = {} as Record<StatusObject, StatusAttribute[]>;
  for (const object of STATUS_OBJECTS) {
    const defaults = DEFAULT_STATUS_CONFIG.objects[object];
    const list = Array.isArray(stored.objects?.[object]) ? (stored.objects![object] as unknown[]) : [];
    const byKey = new Map<string, StatusAttribute>();
    for (const item of list) {
      const a = item as Partial<StatusAttribute>;
      if (!a || typeof a.key !== 'string' || !a.key) continue;
      const fallback = defaults.find((d) => d.key === a.key);
      byKey.set(a.key, {
        key: a.key,
        label: typeof a.label === 'string' && a.label.trim() ? a.label.trim() : (fallback?.label ?? humaniseKey(a.key)),
        mode: MODES.has(a.mode as AttributeMode) ? (a.mode as AttributeMode) : (fallback?.mode ?? 'off'),
        visibility: VISIBILITIES.has(a.visibility as AttributeVisibility) ? (a.visibility as AttributeVisibility) : (fallback?.visibility ?? 'procurement'),
        ...(fallback?.derived ? { derived: true } : {}),
      });
    }
    // Stored order first (an admin may reorder), then any default not stored.
    objects[object] = [...byKey.values(), ...defaults.filter((d) => !byKey.has(d.key))];
  }
  const access = {} as StatusAgentConfig['access'];
  for (const role of Object.keys(DEFAULT_STATUS_CONFIG.access) as Role[]) {
    const row = (stored.access?.[role] ?? {}) as Record<string, unknown>;
    access[role] = Object.fromEntries(STATUS_OBJECTS.map((object) => [
      object,
      ACCESSES.has(row[object] as StatusAccess) ? row[object] : DEFAULT_STATUS_CONFIG.access[role][object],
    ])) as Record<StatusObject, StatusAccess>;
  }
  return { objects, access };
}

/**
 * Add attributes the data model has and the config does not, switched off.
 *
 * `keys` are what a live record of the object actually carries. Anything new
 * — a column added after this config was saved — appears in the admin list,
 * labelled from its name, answering nothing until an admin turns it on.
 */
export function mergeDiscoveredAttributes(
  config: StatusAgentConfig,
  object: StatusObject,
  keys: Iterable<string>,
): { config: StatusAgentConfig; added: string[] } {
  const known = new Set(config.objects[object].map((a) => a.key));
  const added = [...new Set(keys)].filter((k) => !known.has(k));
  if (added.length === 0) return { config, added };
  return {
    added,
    config: {
      ...config,
      objects: {
        ...config.objects,
        [object]: [...config.objects[object], ...added.map((key) => ({ key, label: humaniseKey(key), mode: 'off' as const, visibility: 'procurement' as const }))],
      },
    },
  };
}

export function accessFor(config: StatusAgentConfig, role: Role, object: StatusObject): StatusAccess {
  return config.access[role]?.[object] ?? 'none';
}

export function canSeeAttribute(attribute: StatusAttribute, role: Role): boolean {
  if (attribute.mode === 'off') return false;
  return attribute.visibility === 'everyone' || PROCUREMENT_ROLES.includes(role);
}
