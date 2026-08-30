// Allowlisted database endpoint for the private-Neon transition.
// It intentionally exposes table operations only for application-owned objects;
// arbitrary SQL and arbitrary identifiers are rejected at the boundary.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from './_neon.js';

type DomainHandler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

/**
 * Load only the requested domain at runtime. Besides keeping the dispatcher
 * small, this prevents optional document-parser dependencies from being
 * evaluated on every database request (Vercel can otherwise fail the whole
 * function during cold start before the selected handler runs).
 */
async function loadDomainHandler(name: string): Promise<DomainHandler | undefined> {
  switch (name) {
    case 'commodity-match': return (await import('../src/server/api/commodity-match.js')).default;
    case 'contract-match': return (await import('../src/server/api/contract-match.js')).default;
    case 'contract-scope': return (await import('../src/server/api/contract-scope.js')).default;
    case 'contract-vocabulary': return (await import('../src/server/api/contract-vocabulary.js')).default;
    case 'intake-guidance': return (await import('../src/server/api/intake-guidance.js')).default;
    case 'intake-upload': return (await import('../src/server/api/intake-upload.js')).default;
    case 'policy-config': return (await import('../src/server/api/policy-config.js')).default;
    default: return undefined;
  }
}

const ALLOWED_RELATIONS = new Set([
  'users', 'user_preferences', 'requests', 'stage_history', 'service_descriptions',
  'ai_conversations', 'assistant_conversations', 'comments', 'comment_reads',
  'compliance_reports', 'system_integrations', 'form_submissions', 'approval_entries',
  'notifications', 'suppliers', 'suppliers_with_derived', 'contracts', 'contracts_with_derived',
  'purchase_orders', 'purchase_requisitions', 'request_lines', 'invoices', 'risk_assessments',
  'workflow_templates', 'workflow_step_details', 'workflow_instances', 'approval_chains',
  'routing_rules', 'catalogue_items', 'ai_agents', 'kpi_data', 'form_templates',
  'intake_compliance_records', 'procurement_profiles', 'audit_entries', 'knowledge_base', 'chat_feedback',
  'sla_targets', 'procurement_categories', 'goods_receipts', 'sourcing_events',
  'sourcing_responses', 'tickets', 'ticket_responses', 'ticket_links',
  'service_description_templates',
]);

const ALLOWED_FUNCTIONS = new Set(['next_ticket_id', 'next_sourcing_event_id']);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const jsonColumnsCache = new Map<string, Set<string>>();

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

function parameterCast(value: unknown): string {
  if (typeof value === 'boolean') return '::boolean';
  if (typeof value === 'number') return '::numeric';
  return '::text';
}

function updateParameterCast(value: unknown, column: string): string {
  // Neon HTTP sends JavaScript strings as unknown parameters. Explicit casts
  // are required for UPDATE assignments (notably approval status fields),
  // even though a WHERE comparison can infer its type from the column.
  if (typeof value === 'string' && (column.endsWith('_at') || column === 'sla_deadline')) return '::timestamp';
  if (typeof value === 'string' && (column.endsWith('_date') || column === 'effective_from' || column === 'effective_to')) return '::date';
  return parameterCast(value);
}

function selectList(value: string | undefined): string {
  if (!value || value === '*') return '*';
  return value.split(',').map((column) => quoteIdentifier(column.trim())).join(', ');
}

function addFilter(parts: string[], params: unknown[], filter: Filter, placeholderOffset = 0): void {
  const column = quoteIdentifier(filter.column);
  const value = filter.value;
  switch (filter.operator) {
    case 'eq':
      if (value === null) { parts.push(`${column} IS NULL`); break; }
      params.push(value); parts.push(`${column} = $${placeholderOffset + params.length}${parameterCast(value)}`); break;
    case 'neq':
      if (value === null) { parts.push(`${column} IS NOT NULL`); break; }
      params.push(value); parts.push(`${column} <> $${placeholderOffset + params.length}${parameterCast(value)}`); break;
    case 'gt': params.push(value); parts.push(`${column} > $${placeholderOffset + params.length}${parameterCast(value)}`); break;
    case 'gte': params.push(value); parts.push(`${column} >= $${placeholderOffset + params.length}${parameterCast(value)}`); break;
    case 'lt': params.push(value); parts.push(`${column} < $${placeholderOffset + params.length}${parameterCast(value)}`); break;
    case 'lte': params.push(value); parts.push(`${column} <= $${placeholderOffset + params.length}${parameterCast(value)}`); break;
    case 'ilike': params.push(value); parts.push(`${column} ILIKE $${placeholderOffset + params.length}${parameterCast(value)}`); break;
    case 'is': parts.push(value === null ? `${column} IS NULL` : `${column} IS NOT NULL`); break;
    case 'in': {
      if (!Array.isArray(value) || value.length === 0) { parts.push('FALSE'); break; }
      const placeholders = value.map((item) => { params.push(item); return `$${placeholderOffset + params.length}${parameterCast(item)}`; });
      parts.push(`${column} IN (${placeholders.join(', ')})`);
      break;
    }
    default: throw new Error(`Unsupported filter operator: ${filter.operator}`);
  }
}

function whereClause(request: DbRequest, params: unknown[], placeholderOffset = 0): string {
  const andParts: string[] = [];
  for (const filter of request.filters ?? []) addFilter(andParts, params, filter, placeholderOffset);
  const orParts: string[] = [];
  for (const filter of request.orFilters ?? []) addFilter(orParts, params, filter, placeholderOffset);
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

async function jsonColumns(table: string): Promise<Set<string>> {
  const cached = jsonColumnsCache.get(table);
  if (cached) return cached;
  const sql = getNeonClient();
  // `table` is allowlisted above, so embedding it avoids a Neon HTTP driver
  // type-inference failure on this metadata-only query during cold starts.
  const rows = await sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND data_type IN ('json', 'jsonb')`,
  );
  const columns = new Set(rows.map((row) => String(row.column_name)));
  jsonColumnsCache.set(table, columns);
  return columns;
}

function parameterValue(value: unknown, column: string, jsonColumnsForTable: Set<string>): unknown {
  // The Neon driver treats a JavaScript array parameter as a PostgreSQL array;
  // JSONB writes therefore need explicit serialization or [] becomes {}.
  if (jsonColumnsForTable.has(column) && value !== null && value !== undefined && typeof value !== 'string') {
    return JSON.stringify(value);
  }
  return value;
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
  const jsonColumnsForTable = await jsonColumns(request.table);
  const columns = Object.keys(rows[0]);
  if (columns.length === 0 || columns.some((column) => !IDENTIFIER.test(column))) throw new Error('Invalid database write columns');
  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  const bodyParams: unknown[] = [];
  const valueGroups = () => rows.map((row) => `(${columns.map((column) => {
    const value = parameterValue(row[column], column, jsonColumnsForTable);
    // A bare NULL has no type for the Neon HTTP protocol to infer. Emitting
    // the SQL NULL literal preserves nullable updates/inserts and avoids the
    // approval action failure caused by an untyped second parameter.
    if (value === null) return 'NULL';
    bodyParams.push(value);
    return `$${bodyParams.length}`;
  }).join(', ')})`);
  if (request.operation === 'insert') {
    const result = await sql.query(`INSERT INTO ${relation} (${quotedColumns}) VALUES ${valueGroups().join(', ')} RETURNING *`, bodyParams);
    return request.single ? (result[0] ?? null) : result;
  }
  if (request.operation === 'upsert') {
    const conflictColumns = (request.conflict ?? 'id').split(',').map((column) => quoteIdentifier(column.trim())).join(', ');
    const updates = columns.filter((column) => !(request.conflict ?? 'id').split(',').includes(column)).map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`);
    const result = await sql.query(`INSERT INTO ${relation} (${quotedColumns}) VALUES ${valueGroups().join(', ')} ON CONFLICT (${conflictColumns}) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'} RETURNING *`, bodyParams);
    return request.single ? (result[0] ?? null) : result;
  }
  const updates = columns.map((column) => {
    const value = parameterValue(rows[0][column], column, jsonColumnsForTable);
    if (value === null) return `${quoteIdentifier(column)} = NULL`;
    bodyParams.push(value);
    return `${quoteIdentifier(column)} = $${bodyParams.length}${updateParameterCast(value, column)}`;
  });
  // Put SET parameters first and append filter parameters afterwards. This
  // keeps values typed by their target columns at $1..$n; the previous
  // filter-first ordering caused Neon/Postgres to reject $2 as indeterminate.
  const whereParams: unknown[] = [];
  const updateWhere = whereClause(request, whereParams, bodyParams.length);
  const result = await sql.query(`UPDATE ${relation} SET ${updates.join(', ')}${updateWhere} RETURNING *`, [...bodyParams, ...whereParams]);
  return request.single ? (result[0] ?? null) : result;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Vercel Hobby only permits twelve functions. Explicit rewrites route the
  // small domain endpoints through this already-deployed function without
  // exposing a generic database operation to those callers.
  const domain = req.query?.domain;
  const domainName = Array.isArray(domain) ? domain[0] : domain;
  const delegate = domainName ? await loadDomainHandler(domainName) : undefined;
  if (delegate) {
    await delegate(req, res);
    return;
  }
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
