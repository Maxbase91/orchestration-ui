// The assistant's server-side lookups, governed by the Status Answers agent.
//
// api/chat.ts used to select a hand-picked column list per object, which
// disagreed with the browser's own list about what a person could learn — and
// nothing an admin could change. It now reads the whole record, applies the
// same status configuration the Home box does (status-config.ts /
// status-answer.ts), and hands the model only the attributes the asker's role
// may see, for records the role may ask about.
//
// Raw SQL rather than the connector ports: the known server-side gap recorded
// in CLAUDE.md. The mappers make the rows the same domain shape the browser's
// connectors return, so the one composer serves both.
import type { NeonCompatibleClient, DbRow } from '../../src/lib/neon-compatible-client.js';
import type { Role } from '../../src/config/roles.js';
import { roles } from '../../src/config/roles.js';
import {
  mapDbToRequest, mapDbToPurchaseOrder, mapDbToInvoice, mapDbToContract, mapDbToSupplier, mapDbToWorkflowTemplate,
} from '../../src/lib/db/mappers.js';
import { accessFor, statusConfigFromStored, type StatusAgentConfig, type StatusObject } from '../../src/lib/assistant/status-config.js';
import {
  ownershipFor, deriveAttributes, composeItem, mayAnswer,
  type StatusRecord, type StatusLookupData, type Ownership,
} from '../../src/lib/assistant/status-answer.js';

type RecordObject = Exclude<StatusObject, 'approval'>;

const TABLE: Record<RecordObject, string> = {
  request: 'requests_with_derived',
  'purchase-order': 'purchase_orders',
  invoice: 'invoices',
  contract: 'contracts_with_derived',
  supplier: 'suppliers_with_derived',
};

const MAP: Record<RecordObject, (row: DbRow) => unknown> = {
  request: mapDbToRequest as (row: DbRow) => unknown,
  'purchase-order': mapDbToPurchaseOrder as (row: DbRow) => unknown,
  invoice: mapDbToInvoice as (row: DbRow) => unknown,
  contract: mapDbToContract as (row: DbRow) => unknown,
  supplier: mapDbToSupplier as (row: DbRow) => unknown,
};

/** The tool's object names → the status agent's. */
export const TOOL_OBJECT: Record<string, RecordObject> = {
  request: 'request',
  requests: 'request',
  po: 'purchase-order',
  purchase_orders: 'purchase-order',
  invoice: 'invoice',
  invoices: 'invoice',
  contract: 'contract',
  contracts: 'contract',
  supplier: 'supplier',
  suppliers: 'supplier',
};

const toRecord = (object: RecordObject, row: DbRow) => MAP[object](row) as StatusRecord;

/** A role the client named, or the most restricted one when it named none we know. */
export function roleFrom(raw: unknown): Role {
  return roles.some((r) => r.id === raw) ? (raw as Role) : 'service-owner';
}

export interface StatusContext {
  active: boolean;
  config: StatusAgentConfig;
  role: Role;
  userId: string;
}

export async function loadStatusContext(db: NeonCompatibleClient, userId: string, role: Role): Promise<StatusContext> {
  const { data } = await db.from('ai_agents').select('status, config').eq('type', 'status').limit(1).maybeSingle();
  const agent = data as { status?: string; config?: unknown } | null;
  return { active: agent?.status === 'active', config: statusConfigFromStored(agent?.config), role, userId };
}

async function rows(db: NeonCompatibleClient, table: string, columns = '*'): Promise<DbRow[]> {
  try {
    const { data } = await db.from(table).select(columns);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function ownershipOf(db: NeonCompatibleClient, userId: string): Promise<Ownership> {
  const [requests, pos] = await Promise.all([rows(db, 'requests'), rows(db, 'purchase_orders')]);
  return ownershipFor(userId, requests.map((r) => toRecord('request', r)), pos.map((p) => toRecord('purchase-order', p)));
}

async function lookupData(db: NeonCompatibleClient, object: RecordObject): Promise<StatusLookupData> {
  // Only a request derives from users, templates and approvals; the others
  // derive from their own fields.
  if (object !== 'request') return { users: [], suppliers: [], templates: [], approvals: [], requestTitles: {} };
  const [users, suppliers, templates, approvals] = await Promise.all([
    rows(db, 'users', 'id, name'),
    rows(db, 'suppliers', 'id, name'),
    rows(db, 'workflow_templates'),
    rows(db, 'approval_entries', 'request_id, status, step_order, assignment_mode, approver_role, approver_name'),
  ]);
  return {
    users: users.map((u) => ({ id: String(u.id), name: String(u.name) })),
    suppliers: suppliers.map((s) => ({ id: String(s.id), name: String(s.name) })),
    templates: templates.map((t) => mapDbToWorkflowTemplate(t)),
    approvals: approvals.map((a) => ({
      requestId: a.request_id, status: a.status, stepOrder: a.step_order,
      assignmentMode: a.assignment_mode, approverRole: a.approver_role, approverName: a.approver_name,
    })),
    requestTitles: {},
  };
}

/** Every on-ask attribute counts as asked: the model chooses what to say from what the role may see. */
function projectFor(ctx: StatusContext, object: RecordObject, record: StatusRecord, data: StatusLookupData) {
  const asked = new Set(ctx.config.objects[object].map((a) => a.key));
  const item = composeItem(object, { ...record, ...deriveAttributes(object, record, data) }, ctx.config, ctx.role, asked);
  return { id: record.id, title: item.title, link: item.link, ...Object.fromEntries(item.facts.map((f) => [f.label, f.value])) };
}

/** lookup_object for a governed object: one record, or found:false. */
export async function statusLookup(db: NeonCompatibleClient, ctx: StatusContext, object: RecordObject, identifier: string): Promise<string> {
  if (!ctx.active) return JSON.stringify({ found: false, reason: 'Status answers are switched off.' });
  const access = accessFor(ctx.config, ctx.role, object);
  if (access === 'none') return JSON.stringify({ found: false, reason: 'This role cannot ask about these records.' });

  const id = identifier.toUpperCase();
  let query = db.from(TABLE[object]).select('*');
  query = object === 'supplier' ? query.or(`id.eq.${id},name.ilike.%${identifier}%`)
    : object === 'contract' ? query.or(`id.eq.${id},supplier_name.ilike.%${identifier}%`)
    : query.eq('id', id);
  const { data } = await query.limit(1).maybeSingle();
  if (!data) return JSON.stringify({ found: false, type: object, identifier });

  const record = toRecord(object, data as DbRow);
  const own = access === 'own' ? await ownershipOf(db, ctx.userId) : null;
  // A record the role may not see is "not found", so the answer does not
  // confirm it exists.
  if (!mayAnswer(ctx.config, ctx.role, object, record, own)) return JSON.stringify({ found: false, type: object, identifier });
  return JSON.stringify({ found: true, type: object, data: projectFor(ctx, object, record, await lookupData(db, object)) });
}

/** Project already-filtered list rows through the same configuration. */
export async function statusProjectList(
  db: NeonCompatibleClient,
  ctx: StatusContext,
  object: RecordObject,
  listRows: DbRow[],
): Promise<Array<Record<string, unknown>> | null> {
  if (!ctx.active || accessFor(ctx.config, ctx.role, object) === 'none') return null;
  const access = accessFor(ctx.config, ctx.role, object);
  const own = access === 'own' ? await ownershipOf(db, ctx.userId) : null;
  const data = await lookupData(db, object);
  return listRows
    .map((row) => toRecord(object, row))
    .filter((record) => mayAnswer(ctx.config, ctx.role, object, record, own))
    .map((record) => projectFor(ctx, object, record, data));
}
