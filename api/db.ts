// Allowlisted database endpoint for the private-Neon transition.
// It intentionally exposes table operations only for application-owned objects;
// arbitrary SQL and arbitrary identifiers are rejected at the boundary.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from './_neon.js';

const ALLOWED_RELATIONS = new Set([
  'users', 'user_preferences', 'requests', 'stage_history', 'service_descriptions',
  'ai_conversations', 'assistant_conversations', 'comments', 'comment_reads',
  'compliance_reports', 'system_integrations', 'form_submissions', 'approval_entries',
  'notifications', 'suppliers', 'suppliers_with_derived', 'contracts', 'contracts_with_derived',
  'purchase_orders', 'purchase_requisitions', 'request_lines', 'invoices', 'risk_assessments',
  'workflow_templates', 'workflow_step_details', 'workflow_instances', 'approval_chains',
  'routing_rules', 'catalogue_items', 'ai_agents', 'kpi_data', 'form_templates',
  'intake_compliance_records', 'audit_entries', 'knowledge_base', 'chat_feedback',
  'sla_targets', 'procurement_categories', 'goods_receipts', 'sourcing_events',
  'sourcing_responses', 'tickets', 'ticket_responses', 'ticket_links',
  'service_description_templates',
]);

const ALLOWED_FUNCTIONS = new Set(['next_ticket_id', 'next_sourcing_event_id']);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface Filter { column: string; operator: string; value: unknown }
interface Order { column: string; ascending: boolean }
export interface DbRequest {
  operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  table?: string;
  functionName?: string;
  args?: Record<string, unknown>;
  select?: string;
  filters?: Filter[];
  orFilters?: Filter[];
  orders?: Order[];
  limit?: number;
  single?: boolean;
  body?: unknown;
  conflict?: string;
}

function quoteIdentifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error('Invalid database identifier');
  return `"${value}"`;
}

function selectList(value: string | undefined): string {
  if (!value || value === '*') return '*';
  return value.split(',').map((column) => quoteIdentifier(column.trim())).join(', ');
}

function addFilter(parts: string[], params: unknown[], filter: Filter): void {
  const column = quoteIdentifier(filter.column);
  const value = filter.value;
  switch (filter.operator) {
    case 'eq': params.push(value); parts.push(`${column} = $${params.length}`); break;
    case 'neq': params.push(value); parts.push(`${column} <> $${params.length}`); break;
    case 'gt': params.push(value); parts.push(`${column} > $${params.length}`); break;
    case 'gte': params.push(value); parts.push(`${column} >= $${params.length}`); break;
    case 'lt': params.push(value); parts.push(`${column} < $${params.length}`); break;
    case 'lte': params.push(value); parts.push(`${column} <= $${params.length}`); break;
    case 'ilike': params.push(value); parts.push(`${column} ILIKE $${params.length}`); break;
    case 'is': parts.push(value === null ? `${column} IS NULL` : `${column} IS NOT NULL`); break;
    case 'in': {
      if (!Array.isArray(value) || value.length === 0) { parts.push('FALSE'); break; }
      const placeholders = value.map((item) => { params.push(item); return `$${params.length}`; });
      parts.push(`${column} IN (${placeholders.join(', ')})`);
      break;
    }
    default: throw new Error(`Unsupported filter operator: ${filter.operator}`);
  }
}

function whereClause(request: DbRequest, params: unknown[]): string {
  const andParts: string[] = [];
  for (const filter of request.filters ?? []) addFilter(andParts, params, filter);
  const orParts: string[] = [];
  for (const filter of request.orFilters ?? []) addFilter(orParts, params, filter);
  if (orParts.length > 0) andParts.push(`(${orParts.join(' OR ')})`);
  return andParts.length > 0 ? ` WHERE ${andParts.join(' AND ')}` : '';
}

function bodyRows(body: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(body) ? body : [body];
  if (rows.length === 0 || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('Database writes require object records');
  }
  return rows as Record<string, unknown>[];
}

export async function executeNeonRequest(request: DbRequest): Promise<unknown> {
  const sql = getNeonClient();
  if (request.operation === 'rpc') {
    if (!request.functionName || !ALLOWED_FUNCTIONS.has(request.functionName)) throw new Error('Unsupported database function');
    const rows = await sql.query(`SELECT ${quoteIdentifier(request.functionName)}() AS value`);
    return rows[0]?.value ?? null;
  }
  if (!request.table || !ALLOWED_RELATIONS.has(request.table)) throw new Error('Unsupported database relation');
  const relation = quoteIdentifier(request.table);
  const params: unknown[] = [];
  const where = whereClause(request, params);
  if (request.operation === 'select') {
    const order = (request.orders ?? []).map((item) => `${quoteIdentifier(item.column)} ${item.ascending ? 'ASC' : 'DESC'}`).join(', ');
    const suffix = `${where}${order ? ` ORDER BY ${order}` : ''}${request.limit ? ` LIMIT ${Math.max(1, Math.min(request.limit, 2000))}` : ''}`;
    const rows = await sql.query(`SELECT ${selectList(request.select)} FROM ${relation}${suffix}`, params);
    if (!request.single) return rows;
    if (rows.length > 1) throw new Error('Expected at most one database row');
    return rows[0] ?? null;
  }
  if (request.operation === 'delete') {
    const rows = await sql.query(`DELETE FROM ${relation}${where} RETURNING *`, params);
    return request.single ? (rows[0] ?? null) : rows;
  }
  const rows = bodyRows(request.body);
  const columns = Object.keys(rows[0]);
  if (columns.length === 0 || columns.some((column) => !IDENTIFIER.test(column))) throw new Error('Invalid database write columns');
  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  const valueGroups = rows.map((row) => `(${columns.map((column) => { params.push(row[column]); return `$${params.length}`; }).join(', ')})`);
  if (request.operation === 'insert') {
    const result = await sql.query(`INSERT INTO ${relation} (${quotedColumns}) VALUES ${valueGroups.join(', ')} RETURNING *`, params);
    return request.single ? (result[0] ?? null) : result;
  }
  if (request.operation === 'upsert') {
    const conflictColumns = (request.conflict ?? 'id').split(',').map((column) => quoteIdentifier(column.trim())).join(', ');
    const updates = columns.filter((column) => !(request.conflict ?? 'id').split(',').includes(column)).map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`);
    const result = await sql.query(`INSERT INTO ${relation} (${quotedColumns}) VALUES ${valueGroups.join(', ')} ON CONFLICT (${conflictColumns}) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'} RETURNING *`, params);
    return request.single ? (result[0] ?? null) : result;
  }
  const updates = columns.map((column) => { params.push(rows[0][column]); return `${quoteIdentifier(column)} = $${params.length}`; });
  const result = await sql.query(`UPDATE ${relation} SET ${updates.join(', ')}${where} RETURNING *`, params);
  return request.single ? (result[0] ?? null) : result;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const result = await executeNeonRequest(req.body as DbRequest);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database request failed';
    console.error('[neon-db]', message);
    res.status(500).json({ data: null, error: message });
  }
}
