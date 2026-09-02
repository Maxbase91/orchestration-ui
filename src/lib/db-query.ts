// Serverless data helper for the handlers that read with a PostgREST-shaped
// query string (api/workflow-action, api/seed, api/conversations).
//
// It once held a whole second implementation — a direct REST call with an anon
// key — selected by an environment variable. That is gone: keeping it meant this
// file could take a different route to the data than the rest of the server,
// which is the drift that made dev and production disagree. The query-string
// shape is retained because those three handlers are written against it; only
// the destination changed, to the same Neon executor everything else uses.

import { executeNeonRequest } from '../../api/db.js';

interface DbQueryOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  filters?: string;
  select?: string;
  single?: boolean;
  upsert?: boolean;
  order?: string;
  limit?: number;
}

export async function dbQuery<T = unknown>(
  table: string,
  options: DbQueryOptions = {},
): Promise<{ data: T | null; error: string | null }> {
  const {
    method = 'GET',
    body,
    filters,
    select,
    single = false,
    upsert = false,
    order,
    limit,
  } = options;

  const filtersList = (filters ?? '').split('&').filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    const column = separator > 0 ? part.slice(0, separator) : part;
    const expression = separator > 0 ? decodeURIComponent(part.slice(separator + 1)) : '';
    const dot = expression.indexOf('.');
    return {
      column,
      operator: dot > 0 ? expression.slice(0, dot) : 'eq',
      value: dot > 0
        ? expression.slice(dot + 1) === 'null' ? null : expression.slice(dot + 1)
        : expression,
    };
  });
  try {
    const data = await executeNeonRequest({
      operation: method === 'GET' ? 'select' : method === 'POST' ? (upsert ? 'upsert' : 'insert') : method === 'PATCH' ? 'update' : 'delete',
      table,
      select,
      filters: filtersList,
      orders: order ? order.split(',').map((item) => {
        const [column, direction] = item.split('.');
        return { column, ascending: direction !== 'desc' };
      }) : undefined,
      limit,
      // This helper's `single` has always meant "one row or null", which is
      // `maybeSingle` semantics — the strict form errors when nothing matched.
      single: single ? 'maybe' : undefined,
      body,
      conflict: upsert ? 'id' : undefined,
    });
    return { data: data as T, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Neon database request failed';
    console.error(`Neon ${method} ${table} error:`, message);
    return { data: null, error: message };
  }
}
