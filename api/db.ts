// Allowlisted database endpoint for the private-Neon transition.
// It intentionally exposes table operations only for application-owned objects;
// arbitrary SQL and arbitrary identifiers are rejected at the boundary.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient, queryRows } from './_neon.js';
import commodityMatch from '../src/server/api/commodity-match.js';
import contractMatch from '../src/server/api/contract-match.js';
import contractScope from '../src/server/api/contract-scope.js';
import contractVocabulary from '../src/server/api/contract-vocabulary.js';
import policyConfig from '../src/server/api/policy-config.js';
import intakeSubmit from '../src/server/api/intake-submit.js';
import neonHealth from '../src/server/api/neon-health.js';

type DomainHandler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

/**
 * Load only the requested domain at runtime. Besides keeping the dispatcher
 * small, this prevents optional document-parser dependencies from being
 * evaluated on every database request (Vercel can otherwise fail the whole
 * function during cold start before the selected handler runs).
 */
async function loadDomainHandler(name: string): Promise<DomainHandler | undefined> {
  switch (name) {
    case 'commodity-match': return commodityMatch;
    case 'contract-match': return contractMatch;
    case 'contract-scope': return contractScope;
    case 'contract-vocabulary': return contractVocabulary;
    case 'policy-config': return policyConfig;
    case 'intake-submit': return intakeSubmit;
    case 'neon-health': return neonHealth;
    // Keep document parser dependencies out of the common cold-start path;
    // only the upload request loads PDF/DOCX parsing code.
    case 'intake-upload': return (await import('../src/server/api/intake-upload.js')).default;
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
const columnTypeCache = new Map<string, Map<string, string>>();

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
  // 'one' must match a row and errors otherwise (supabase-js `.single()`);
  // 'maybe' returns null when nothing matched (`.maybeSingle()`). A single
  // boolean made the two indistinguishable, so a not-found `.single()` returned
  // `{ data: null, error: null }` and callers mapped null instead of throwing.
  single?: 'one' | 'maybe';
  body?: unknown;
  conflict?: string;
  ignoreDuplicates?: boolean;
  count?: 'exact';
  head?: boolean;
}

function quoteIdentifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error('Invalid database identifier');
  return `"${value}"`;
}

// SET assignments need the same treatment as WHERE comparisons: the Neon HTTP
// driver sends JavaScript strings as untyped parameters, so PostgreSQL needs to
// be told what they are. This used to guess from the column *name*
// (`_at` → timestamp, `_date` → date), which worked for the columns someone had
// hit and silently mis-cast the rest; the schema knows the answer.
function updateParameterCast(value: unknown, column: string, types: Map<string, string>): string {
  return castForColumn(value, column, types);
}

function selectList(value: string | undefined): string {
  if (!value || value === '*') return '*';
  return value.split(',').map((column) => quoteIdentifier(column.trim())).join(', ');
}

function addFilter(parts: string[], params: unknown[], filter: Filter, types: Map<string, string>, placeholderOffset = 0): void {
  const column = quoteIdentifier(filter.column);
  const value = filter.value;
  const cast = (item: unknown) => castForColumn(item, filter.column, types);
  switch (filter.operator) {
    case 'eq':
      if (value === null) { parts.push(`${column} IS NULL`); break; }
      params.push(value); parts.push(`${column} = $${placeholderOffset + params.length}${cast(value)}`); break;
    case 'neq':
      if (value === null) { parts.push(`${column} IS NOT NULL`); break; }
      params.push(value); parts.push(`${column} <> $${placeholderOffset + params.length}${cast(value)}`); break;
    case 'gt': params.push(value); parts.push(`${column} > $${placeholderOffset + params.length}${cast(value)}`); break;
    case 'gte': params.push(value); parts.push(`${column} >= $${placeholderOffset + params.length}${cast(value)}`); break;
    case 'lt': params.push(value); parts.push(`${column} < $${placeholderOffset + params.length}${cast(value)}`); break;
    case 'lte': params.push(value); parts.push(`${column} <= $${placeholderOffset + params.length}${cast(value)}`); break;
    case 'ilike': params.push(value); parts.push(`${column} ILIKE $${placeholderOffset + params.length}${cast(value)}`); break;
    case 'is': parts.push(value === null ? `${column} IS NULL` : `${column} IS NOT NULL`); break;
    case 'cs': {
      // Array containment (`comments.mentions` is TEXT[]). The explicit
      // element cast is needed because the driver would otherwise send the
      // array as an untyped parameter.
      if (!Array.isArray(value)) { parts.push('FALSE'); break; }
      params.push(value);
      parts.push(`${column} @> $${placeholderOffset + params.length}::text[]`);
      break;
    }
    case 'in': {
      if (!Array.isArray(value) || value.length === 0) { parts.push('FALSE'); break; }
      const placeholders = value.map((item) => { params.push(item); return `$${placeholderOffset + params.length}${cast(item)}`; });
      parts.push(`${column} IN (${placeholders.join(', ')})`);
      break;
    }
    default: throw new Error(`Unsupported filter operator: ${filter.operator}`);
  }
}

function whereClause(request: DbRequest, params: unknown[], types: Map<string, string>, placeholderOffset = 0): string {
  const andParts: string[] = [];
  for (const filter of request.filters ?? []) addFilter(andParts, params, filter, types, placeholderOffset);
  const orParts: string[] = [];
  for (const filter of request.orFilters ?? []) addFilter(orParts, params, filter, types, placeholderOffset);
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

async function columnTypes(table: string): Promise<Map<string, string>> {
  const cached = columnTypeCache.get(table);
  if (cached) return cached;
  const sql = getNeonClient();
  // `table` is allowlisted above, so embedding it avoids a Neon HTTP driver
  // type-inference failure on this metadata-only query during cold starts.
  const rows = await queryRows(sql,
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
  const types = new Map(rows.map((row) => [String(row.column_name), String(row.data_type)]));
  columnTypeCache.set(table, types);
  return types;
}

/**
 * The cast a parameter needs to be comparable with its column.
 *
 * Every string parameter used to be cast to `::text`, which is wrong for any
 * column that is not text: PostgreSQL has no implicit `text` → `uuid`/`date`/
 * `timestamptz` cast, so `"valid_until" > $1::text` fails with
 * `operator does not exist: date > text`. That broke risk-assessment reuse
 * matching outright and made assistant conversation writes (uuid keys) fail
 * silently, because those call sites do not check the error.
 *
 * Casting to the column's own type is what makes the comparison legal. An
 * unknown column gets no cast at all, which lets PostgreSQL infer from the
 * column — the behaviour the original code assumed it already had.
 */
export function castForColumn(value: unknown, column: string, types: Map<string, string>): string {
  if (value === null || value === undefined) return '';
  const type = types.get(column);
  switch (type) {
    case 'uuid': return '::uuid';
    case 'date': return '::date';
    case 'timestamp with time zone': return '::timestamptz';
    case 'timestamp without time zone': return '::timestamp';
    case 'boolean': return '::boolean';
    case 'integer': case 'bigint': case 'smallint':
    case 'numeric': case 'double precision': case 'real': return '::numeric';
    case 'text': case 'character varying': case 'character': return '::text';
    case 'jsonb': case 'json': return '::jsonb';
    // ARRAY and anything unmapped: no cast, so PostgreSQL infers from the
    // column rather than being told the wrong thing.
    default: return '';
  }
}

function parameterValue(value: unknown, column: string, types: Map<string, string>): unknown {
  // The Neon driver treats a JavaScript array parameter as a PostgreSQL array;
  // JSONB writes therefore need explicit serialization or [] becomes {}.
  const type = types.get(column);
  if ((type === 'jsonb' || type === 'json') && value !== null && value !== undefined && typeof value !== 'string') {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Refuse a DELETE or UPDATE with no filter, before touching the database.
 *
 * An unfiltered destructive statement rewrites or empties a whole table. Every
 * legitimate caller in src/lib/db filters by id, so requiring a filter costs
 * nothing and removes the worst thing this endpoint can be made to do.
 *
 * This is a blast-radius guard, **not** authorization: /api/db still accepts
 * requests from anyone who can reach the deployment. Real protection needs
 * authentication, which ADR-0003 defers along with the rest of the identity
 * model — do not read this guard as that gap being closed.
 */
export function assertFilteredWrite(request: Pick<DbRequest, 'operation' | 'filters' | 'orFilters'>): void {
  if (request.operation !== 'delete' && request.operation !== 'update') return;
  const filtered = (request.filters?.length ?? 0) > 0 || (request.orFilters?.length ?? 0) > 0;
  if (!filtered) throw new Error(`An unfiltered ${request.operation} is refused; add a filter`);
}

export async function executeNeonRequest(request: DbRequest): Promise<unknown> {
  assertFilteredWrite(request);
  const sql = getNeonClient();
  if (request.operation === 'rpc') {
    if (!request.functionName || !ALLOWED_FUNCTIONS.has(request.functionName)) throw new Error('Unsupported database function');
    const rows = await queryRows(sql, `SELECT ${quoteIdentifier(request.functionName)}() AS value`);
    return rows[0]?.value ?? null;
  }
  if (!request.table || !ALLOWED_RELATIONS.has(request.table)) throw new Error('Unsupported database relation');
  const relation = quoteIdentifier(request.table);
  const types = await columnTypes(request.table);
  const params: unknown[] = [];
  const where = whereClause(request, params, types);
  if (request.operation === 'select') {
    const order = (request.orders ?? []).map((item) => `${quoteIdentifier(item.column)} ${item.ascending ? 'ASC' : 'DESC'}`).join(', ');
    const suffix = `${where}${order ? ` ORDER BY ${order}` : ''}${request.limit ? ` LIMIT ${Math.max(1, Math.min(request.limit, 2000))}` : ''}`;
    // `head` asks for the count without the rows; `count` asks for both. Neither
    // was implemented, so a caller reading `{ count }` got undefined and the
    // query fetched every row it was trying to avoid.
    if (request.count || request.head) {
      const totals = await queryRows(sql, `SELECT count(*)::int AS count FROM ${relation}${where}`, params);
      const count = Number(totals[0]?.count ?? 0);
      if (request.head) return { rows: [], count };
      const counted = await queryRows(sql, `SELECT ${selectList(request.select)} FROM ${relation}${suffix}`, params);
      return { rows: counted, count };
    }
    const rows = await queryRows(sql, `SELECT ${selectList(request.select)} FROM ${relation}${suffix}`, params);
    if (!request.single) return rows;
    if (rows.length > 1) throw new Error('Expected at most one database row');
    if (!rows[0] && request.single === 'one') throw new Error('Expected exactly one database row, found none');
    return rows[0] ?? null;
  }
  if (request.operation === 'delete') {
    const rows = await queryRows(sql, `DELETE FROM ${relation}${where} RETURNING *`, params);
    return request.single ? (rows[0] ?? null) : rows;
  }
  const rows = bodyRows(request.body);
  
  const columns = Object.keys(rows[0]);
  if (columns.length === 0 || columns.some((column) => !IDENTIFIER.test(column))) throw new Error('Invalid database write columns');
  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  const bodyParams: unknown[] = [];
  const valueGroups = () => rows.map((row) => `(${columns.map((column) => {
    const value = parameterValue(row[column], column, types);
    // A bare NULL has no type for the Neon HTTP protocol to infer. Emitting
    // the SQL NULL literal preserves nullable updates/inserts and avoids the
    // approval action failure caused by an untyped second parameter.
    if (value === null) return 'NULL';
    bodyParams.push(value);
    return `$${bodyParams.length}`;
  }).join(', ')})`);
  if (request.operation === 'insert') {
    const result = await queryRows(sql, `INSERT INTO ${relation} (${quotedColumns}) VALUES ${valueGroups().join(', ')} RETURNING *`, bodyParams);
    return request.single ? (result[0] ?? null) : result;
  }
  if (request.operation === 'upsert') {
    const conflictKeys = (request.conflict ?? 'id').split(',').map((column) => column.trim());
    const conflictColumns = conflictKeys.map(quoteIdentifier).join(', ');
    // `.trim()` on both sides: the key list was split without trimming here, so
    // `onConflict: 'a, b'` left ' b' in the SET list and overwrote a conflict key.
    const updates = request.ignoreDuplicates
      ? []
      : columns.filter((column) => !conflictKeys.includes(column)).map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`);
    const result = await queryRows(sql, `INSERT INTO ${relation} (${quotedColumns}) VALUES ${valueGroups().join(', ')} ON CONFLICT (${conflictColumns}) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'} RETURNING *`, bodyParams);
    return request.single ? (result[0] ?? null) : result;
  }
  const updates = columns.map((column) => {
    const value = parameterValue(rows[0][column], column, types);
    if (value === null) return `${quoteIdentifier(column)} = NULL`;
    bodyParams.push(value);
    return `${quoteIdentifier(column)} = $${bodyParams.length}${updateParameterCast(value, column, types)}`;
  });
  // Put SET parameters first and append filter parameters afterwards. This
  // keeps values typed by their target columns at $1..$n; the previous
  // filter-first ordering caused Neon/Postgres to reject $2 as indeterminate.
  const whereParams: unknown[] = [];
  const updateWhere = whereClause(request, whereParams, types, bodyParams.length);
  const result = await queryRows(sql, `UPDATE ${relation} SET ${updates.join(', ')}${updateWhere} RETURNING *`, [...bodyParams, ...whereParams]);
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
    // A counted select returns rows and a total; everything else returns rows.
    if (result && typeof result === 'object' && 'rows' in result && 'count' in result) {
      const { rows, count } = result as { rows: unknown; count: number };
      res.status(200).json({ data: rows, count, error: null });
      return;
    }
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database request failed';
    console.error('[neon-db]', message);
    res.status(500).json({ data: null, error: message });
  }
}
