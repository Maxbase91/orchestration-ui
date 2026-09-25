// Answering a status question in the browser — the Home box, the assistant's
// lookups and the agent's test panel all come through here.
//
// Loads what status-answer.ts needs and nothing else decides: records through
// the source-connector ports (never a direct table read of an upstream object),
// the platform's own users, approvals and workflow templates for the derived
// attributes, and the Status Answers agent for what may be said to whom.
import type { Role } from '@/config/roles';
import type { WorkflowTemplate } from '@/data/types';
import { requireConnector, type SourceObject } from '@/lib/integrations';
import { listAiAgents } from '@/lib/db/ai-agents';
import { listApprovals } from '@/lib/db/approvals';
import { listUsers } from '@/lib/db/users';
import { listWorkflowTemplates } from '@/lib/db/workflow-templates';
import { STATUS_OBJECT_META, accessFor, statusConfigFromStored, type StatusObject, type StatusAgentConfig } from './status-config';
import {
  parseStatusQuestion, askedAttributes, ownershipFor, deriveAttributes, composeItem, mayAnswer, isOwn,
  deniedAnswer, notFoundAnswer,
  type StatusAnswer, type StatusRecord, type StatusLookupData, type Ownership, type StatusQuestion,
} from './status-answer';

const SOURCE: Record<Exclude<StatusObject, 'approval'>, SourceObject> = {
  request: 'purchase-request',
  'purchase-order': 'purchase-order',
  invoice: 'invoice',
  contract: 'contract',
  supplier: 'supplier',
};

async function getRecord(object: Exclude<StatusObject, 'approval'>, id: string): Promise<StatusRecord | null> {
  try {
    const rec = await requireConnector<string, StatusRecord>(SOURCE[object]).get(id);
    return rec?.data ?? null;
  } catch {
    return null;
  }
}

async function listRecords(object: Exclude<StatusObject, 'approval'>, search?: string): Promise<StatusRecord[]> {
  try {
    return (await requireConnector<string, StatusRecord>(SOURCE[object]).list(search ? { search } : undefined)).map((r) => r.data);
  } catch {
    return [];
  }
}

/** The status agent's configuration, and whether it is switched on. */
export async function loadStatusAgent(): Promise<{ active: boolean; config: StatusAgentConfig }> {
  const agent = (await listAiAgents().catch(() => [])).find((a) => a.type === 'status');
  return { active: agent?.status === 'active', config: statusConfigFromStored(agent?.config) };
}

async function lookupData(): Promise<StatusLookupData> {
  const [users, suppliers, templates, approvals, requests] = await Promise.all([
    listUsers().catch(() => []),
    listRecords('supplier'),
    listWorkflowTemplates().catch(() => [] as WorkflowTemplate[]),
    listApprovals().catch(() => []),
    listRecords('request'),
  ]);
  return {
    users: users.map((u) => ({ id: u.id, name: u.name })),
    suppliers: suppliers.map((s) => ({ id: String(s.id), name: String(s.name) })),
    templates,
    approvals: approvals as unknown as StatusRecord[],
    requestTitles: Object.fromEntries(requests.map((r) => [String(r.id), String(r.title ?? '')])),
  };
}

const OPEN = (r: StatusRecord) => !['completed', 'cancelled', 'draft'].includes(String(r.status));

/**
 * The answer to a status question, or null when the text is not one.
 * `role` and `userId` are the person asking — they decide whose records and
 * which attributes the answer may contain.
 */
export async function answerStatusQuestion(
  text: string,
  who: { userId: string; role: Role },
  question: StatusQuestion | null = parseStatusQuestion(text),
): Promise<StatusAnswer | null> {
  if (!question) return null;
  const { active, config } = await loadStatusAgent();
  if (!active) return { kind: 'off', message: 'Status answers are switched off (Admin → AI agents → Status Answers).' };
  const { object } = question;
  const access = accessFor(config, who.role, object);
  if (access === 'none') return deniedAnswer(object);

  const data = await lookupData();
  // Ownership needs the person's requests and the POs off them; only worked
  // out when the role's access is Own.
  let own: Ownership | null = null;
  if (access === 'own') {
    const [requests, pos] = await Promise.all([listRecords('request'), listRecords('purchase-order')]);
    own = ownershipFor(who.userId, requests, pos);
  }
  const asked = askedAttributes(text, config.objects[object]);
  const item = (record: StatusRecord) => composeItem(object, { ...record, ...deriveAttributes(object, record, data) }, config, who.role, asked);

  if (object === 'approval') {
    // Always the ones waiting on the asker, oldest first; the access cell only
    // decides whether the role may ask at all.
    const waiting = data.approvals
      .filter((a) => a.status === 'pending' && a.approverId === who.userId)
      .sort((a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt)));
    return { kind: 'list', object, heading: STATUS_OBJECT_META.approval.plural, items: waiting.slice(0, 5).map(item), more: Math.max(0, waiting.length - 5) };
  }

  if (question.id) {
    const record = await getRecord(object, question.id);
    if (!record || !mayAnswer(config, who.role, object, record, own)) return notFoundAnswer(object, question.id);
    return { kind: 'record', object, item: item(record) };
  }

  if (question.name) {
    const needle = question.name.toLowerCase();
    const field = object === 'supplier' ? 'name' : 'supplierName';
    const record = (await listRecords(object, question.name)).find((r) => String(r[field] ?? '').toLowerCase().includes(needle));
    if (!record || !mayAnswer(config, who.role, object, record, own)) return notFoundAnswer(object, `matching "${question.name}"`);
    return { kind: 'record', object, item: item(record) };
  }

  // "My …": the person's own open items, newest first — "my requests" means
  // mine even to a role that may ask about all of them.
  const mine = own ?? ownershipFor(who.userId, await listRecords('request'), await listRecords('purchase-order'));
  const records = (await listRecords(object))
    .filter((r) => isOwn(object, r, mine) && OPEN(r))
    .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')));
  return { kind: 'list', object, heading: `Your ${STATUS_OBJECT_META[object].plural.toLowerCase()}`, items: records.slice(0, 5).map(item), more: Math.max(0, records.length - 5) };
}

/**
 * Every attribute a live record of this object carries — how the admin page
 * lists a column the configuration does not know yet. One record is enough:
 * the mappers write every key, set or not.
 */
export async function discoverAttributeKeys(object: StatusObject): Promise<string[]> {
  if (object === 'approval') {
    const [first] = await listApprovals().catch(() => []);
    return first ? Object.keys(first) : [];
  }
  const [first] = await listRecords(object);
  return first ? Object.keys(first) : [];
}
