// Status answers: what a person asked about, whether they may see it, and the
// answer the status agent's configuration allows.
//
// Pure — every record and lookup is handed in — so the Home box, the browser
// assistant and api/chat.ts compose the same answer from the same config. Each
// side only loads the data (see status-lookup.ts and api/_domains/status-answers.ts).
import type { Role } from '../../config/roles.js';
import type { WorkflowTemplate } from '../../data/types.js';
import {
  STATUS_OBJECT_META, accessFor, canSeeAttribute,
  type StatusAgentConfig, type StatusObject, type StatusAttribute,
} from './status-config.js';
import { stageSlasFromTemplates, stageSlaDays } from '../workflow/stage-sla.js';
import { channelStageMapFromTemplates, nextStageAfter } from '../workflow/channel-stages.js';

export type StatusRecord = Record<string, unknown>;

// ── The question ────────────────────────────────────────────────────────────

export interface StatusQuestion {
  object: StatusObject;
  /** A record named by id. */
  id?: string;
  /** "my requests", "waiting on me" — the person's own open items. */
  mine?: boolean;
  /** A supplier or contract named in words ("is Acme onboarded?"). */
  name?: string;
  text: string;
}

const MINE: Array<[RegExp, StatusObject]> = [
  [/\b(waiting (on|for) me|my (pending )?approvals?|to approve|approvals? (for|waiting)|what do i (need to|have to) approve)\b/i, 'approval'],
  [/\bmy (purchase orders?|pos?|orders?)\b/i, 'purchase-order'],
  [/\bmy invoices?\b/i, 'invoice'],
  [/\bmy contracts?\b/i, 'contract'],
  [/\bmy (open )?(requests?|demands?)\b/i, 'request'],
];

/**
 * What a status question is about, or null when it is not one.
 *
 * An id wins over everything ("where is REQ-2026-0012?"); then the person's
 * own items; then a supplier or contract named in words. A bare "what's the
 * status?" is about the asker's own requests — the one list everybody has.
 */
export function parseStatusQuestion(text: string): StatusQuestion | null {
  for (const object of Object.keys(STATUS_OBJECT_META) as StatusObject[]) {
    const pattern = STATUS_OBJECT_META[object].idPattern;
    const m = pattern ? text.match(pattern) : null;
    if (m) return { object, id: m[0].toUpperCase(), text };
  }
  for (const [pattern, object] of MINE) if (pattern.test(text)) return { object, mine: true, text };
  const supplier = text.match(/\bis ([\w&.' -]{2,40}?) (onboarded|approved|screened|assessed|set up|registered)\b/i)
    ?? text.match(/\b(?:status|onboarding|risk assessment|screening) (?:of|for) (?:the )?supplier ([\w&.' -]{2,40})\??$/i);
  if (supplier) return { object: 'supplier', name: supplier[1].trim(), text };
  const contract = text.match(/\bcontract with ([\w&.' -]{2,40}?)(?: expire| end| run|\?|$)/i);
  if (contract) return { object: 'contract', name: contract[1].trim(), text };
  if (/\b(status|where is|where are|how far|stuck|progress)\b/i.test(text) && /\b(request|demand|my)\b/i.test(text)) {
    return { object: 'request', mine: true, text };
  }
  return null;
}

/**
 * The on-ask attributes the question names. A label matches when each of its
 * words (3+ letters) starts a word of the question — "expire" asks for
 * "Expires in", "due" for "Due".
 */
export function askedAttributes(text: string, attributes: StatusAttribute[]): Set<string> {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const asked = new Set<string>();
  for (const attribute of attributes) {
    const labelWords = attribute.label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
    if (labelWords.length === 0) continue;
    if (labelWords.every((lw) => words.some((w) => w.startsWith(lw.slice(0, 4)) || (w.length >= 3 && lw.startsWith(w))))) asked.add(attribute.key);
  }
  return asked;
}

// ── Whose record ────────────────────────────────────────────────────────────

export interface Ownership {
  userId: string;
  /** Requests the person raised, is the beneficiary of, or owns. */
  ownRequestIds: ReadonlySet<string>;
  /** POs hanging off those requests, or owned by the person. */
  ownPoIds: ReadonlySet<string>;
  /** Suppliers on those requests and POs. */
  ownSupplierIds: ReadonlySet<string>;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** "Own", per object — the definition the access matrix's middle column uses. */
export function isOwn(object: StatusObject, record: StatusRecord, own: Ownership): boolean {
  switch (object) {
    case 'request':
      return [record.requestorId, record.beneficiaryId, record.ownerId].includes(own.userId);
    case 'approval':
      return record.approverId === own.userId;
    case 'purchase-order':
      return own.ownRequestIds.has(str(record.requestId)) || record.ownerId === own.userId;
    case 'invoice':
      return own.ownPoIds.has(str(record.poId));
    case 'contract':
      return record.ownerId === own.userId
        || (Array.isArray(record.linkedRequestIds) && record.linkedRequestIds.some((id) => own.ownRequestIds.has(String(id))));
    case 'supplier':
      return own.ownSupplierIds.has(str(record.id));
  }
}

/** Build the ownership sets from the person's requests and the POs. */
export function ownershipFor(userId: string, requests: StatusRecord[], purchaseOrders: StatusRecord[]): Ownership {
  const blank: Ownership = { userId, ownRequestIds: new Set(), ownPoIds: new Set(), ownSupplierIds: new Set() };
  const ownRequests = requests.filter((r) => isOwn('request', r, blank));
  const ownRequestIds = new Set(ownRequests.map((r) => str(r.id)));
  const ownPos = purchaseOrders.filter((po) => ownRequestIds.has(str(po.requestId)) || po.ownerId === userId);
  return {
    userId,
    ownRequestIds,
    ownPoIds: new Set(ownPos.map((po) => str(po.id))),
    ownSupplierIds: new Set([...ownRequests.map((r) => str(r.supplierId)), ...ownPos.map((po) => str(po.supplierId))].filter(Boolean)),
  };
}

// ── Derived attributes ──────────────────────────────────────────────────────

export interface StatusLookupData {
  users: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  templates: WorkflowTemplate[];
  /** Approval entries — for "waiting on" and the approval's request title. */
  approvals: StatusRecord[];
  /** Request id → title, for approvals. */
  requestTitles: Record<string, string>;
}

const DAY_MS = 86_400_000;
const TERMINAL = new Set(['completed', 'cancelled']);

function daysBetween(fromIso: string, to: number): number | null {
  const t = Date.parse(fromIso);
  return Number.isFinite(t) ? Math.floor((to - t) / DAY_MS) : null;
}

/** The computed attributes: names for ids, time against the stage target, what comes next. */
export function deriveAttributes(object: StatusObject, record: StatusRecord, data: StatusLookupData, now = Date.now()): StatusRecord {
  const userName = (id: unknown) => data.users.find((u) => u.id === id)?.name;
  switch (object) {
    case 'request': {
      const status = str(record.status);
      const days = typeof record.daysInStage === 'number' ? record.daysInStage : null;
      const target = stageSlaDays(stageSlasFromTemplates(data.templates), status, str(record.workflowTemplateId) || undefined);
      const stageTarget = TERMINAL.has(status) || days === null ? undefined
        : target === null ? `${days} ${days === 1 ? 'day' : 'days'}`
        : days <= target ? `Day ${Math.max(days, 1)} of a ${target}-day target`
        : `${days} days — past its ${target}-day target`;
      const next = TERMINAL.has(status) ? null : nextStageAfter(channelStageMapFromTemplates(data.templates), str(record.buyingChannel) || undefined, status);
      const pending = data.approvals
        .filter((a) => a.requestId === record.id && a.status === 'pending')
        .sort((a, b) => Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0))
        .map((a) => (a.assignmentMode === 'role' ? str(a.approverRole) : `${str(a.approverName)} (${str(a.approverRole)})`));
      return {
        ownerName: userName(record.ownerId),
        requestorName: userName(record.requestorId),
        supplierName: data.suppliers.find((s) => s.id === record.supplierId)?.name,
        stageTarget,
        nextStage: next ?? undefined,
        pendingApprovers: pending.length ? pending : undefined,
      };
    }
    case 'approval': {
      const waited = daysBetween(str(record.requestedAt), now);
      return {
        requestTitle: data.requestTitles[str(record.requestId)],
        waitingDays: waited === null ? undefined : `${waited} ${waited === 1 ? 'day' : 'days'}`,
      };
    }
    case 'contract': {
      const end = Date.parse(str(record.endDate));
      if (!Number.isFinite(end)) return {};
      const days = Math.ceil((end - now) / DAY_MS);
      return { expiresIn: days < 0 ? `Ended ${-days} days ago` : days === 0 ? 'Today' : `${days} days` };
    }
    default:
      return {};
  }
}

// ── Formatting ──────────────────────────────────────────────────────────────

const MONEY_KEYS = new Set(['value', 'amount', 'totalSpend12m', 'matchVariance']);
const STAGE_WORDS: Record<string, string> = { po: 'Purchase order', sra: 'SRA' };
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function humanise(value: string): string {
  if (STAGE_WORDS[value]) return STAGE_WORDS[value];
  const spaced = value.replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A value as the answer states it, or null when there is nothing to say. */
export function formatStatusValue(key: string, value: unknown, record: StatusRecord): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (MONEY_KEYS.has(key)) {
      const currency = str(record.currency) || 'EUR';
      try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); } catch { return `€${value.toLocaleString('en-GB')}`; }
    }
    if (key === 'utilisationPercentage') return `${value}%`;
    return value.toLocaleString('en-GB');
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      const shown = value.slice(0, 5).map(String);
      return value.length > 5 ? `${shown.join(', ')} and ${value.length - 5} more` : shown.join(', ');
    }
    return `${value.length} ${key === 'lineItems' ? (value.length === 1 ? 'line' : 'lines') : 'items'}`;
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const t = Date.parse(value);
      return Number.isFinite(t) ? DATE_FORMAT.format(t) : value;
    }
    // Enum-like values ("referred-back", "procurement-led") read as words.
    return /^[a-z0-9]+([-_][a-z0-9]+)*$/.test(value) ? humanise(value) : value;
  }
  return null;
}

// ── The answer ──────────────────────────────────────────────────────────────

export interface StatusFact { key: string; label: string; value: string }

export interface StatusItem {
  title: string;
  facts: StatusFact[];
  link: string;
}

export type StatusAnswer =
  | { kind: 'record'; object: StatusObject; item: StatusItem }
  | { kind: 'list'; object: StatusObject; heading: string; items: StatusItem[]; more: number }
  | { kind: 'not-found'; object: StatusObject; message: string }
  | { kind: 'denied'; object: StatusObject; message: string }
  | { kind: 'off'; message: string };

function titleFor(object: StatusObject, record: StatusRecord): string {
  const id = str(record.id);
  switch (object) {
    case 'request': return `${id} · ${str(record.title)}`;
    case 'approval': return `${str(record.requestId)}${record.requestTitle ? ` · ${str(record.requestTitle)}` : ''}`;
    case 'contract': return `${id} · ${str(record.title)}`;
    case 'supplier': return str(record.name) || id;
    default: return id;
  }
}

function linkFor(object: StatusObject, record: StatusRecord): string {
  return STATUS_OBJECT_META[object].path(object === 'approval' ? str(record.requestId) : str(record.id));
}

/**
 * One record's answer: the summary attributes, plus any on-ask attribute the
 * question named, minus whatever the person's role may not see. The title
 * attributes are not repeated as facts.
 */
export function composeItem(
  object: StatusObject,
  record: StatusRecord,
  config: StatusAgentConfig,
  role: Role,
  asked: ReadonlySet<string> = new Set(),
): StatusItem {
  const shownInTitle = new Set(object === 'request' || object === 'contract' ? ['title', 'id'] : object === 'supplier' ? ['name', 'id'] : object === 'approval' ? ['requestId', 'requestTitle'] : ['id']);
  const facts: StatusFact[] = [];
  for (const attribute of config.objects[object]) {
    if (shownInTitle.has(attribute.key) || !canSeeAttribute(attribute, role)) continue;
    if (attribute.mode === 'ask' && !asked.has(attribute.key)) continue;
    const value = formatStatusValue(attribute.key, record[attribute.key], record);
    if (value !== null) facts.push({ key: attribute.key, label: attribute.label, value });
  }
  return { title: titleFor(object, record), facts, link: linkFor(object, record) };
}

/**
 * The gate every answer passes: None refuses, Own requires the record to be
 * the person's. A record the person may not see is reported as not found, so
 * the answer does not confirm that it exists.
 */
export function mayAnswer(
  config: StatusAgentConfig,
  role: Role,
  object: StatusObject,
  record: StatusRecord,
  own: Ownership | null,
): boolean {
  const access = accessFor(config, role, object);
  if (access === 'none') return false;
  if (access === 'all') return true;
  return own !== null && isOwn(object, record, own);
}

export function deniedAnswer(object: StatusObject): StatusAnswer {
  return { kind: 'denied', object, message: `Your role cannot ask about ${STATUS_OBJECT_META[object].plural.toLowerCase()} here.` };
}

export function notFoundAnswer(object: StatusObject, what: string): StatusAnswer {
  return { kind: 'not-found', object, message: `No ${STATUS_OBJECT_META[object].label.toLowerCase()} ${what} that you can see.` };
}
