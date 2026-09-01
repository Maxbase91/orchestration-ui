// Server-only Neon connection factory used by Vercel handlers and the database
// compatibility endpoint. The connection string is never sent to the browser.

import { neon } from '@neondatabase/serverless';

/** A row as the driver returns it when neither arrayMode nor fullResults is set. */
export type DbRow = Record<string, unknown>;

export class NeonConfigurationError extends Error {
  constructor() {
    super('Neon database configuration is unavailable.');
    this.name = 'NeonConfigurationError';
  }
}

export function getNeonClient(): ReturnType<typeof neon> {
  const raw = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new NeonConfigurationError();
  const connectionString = normalizeNeonConnectionString(raw);
  // Do not cache this signal with the client: Vercel reuses warm modules, and
  // an expired module-level AbortSignal would make every later query fail
  // immediately. A fresh client/signal also covers Neon branch wake-up time.
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(30000) } });
}

/**
 * Run a query and get rows back.
 *
 * `sql.query()` is typed as `any[][] | Record<string, any>[] | FullQueryResults`
 * because the driver's return shape depends on `arrayMode`/`fullResults`. We set
 * neither, so it is always the row-object array — but callers cannot index the
 * union, and every one of them was reaching for `rows[0]` regardless. Narrowing
 * once here puts that assumption in a single place tied to the client that makes
 * it, instead of a cast at each call site.
 */
export async function queryRows(
  sql: ReturnType<typeof neon>,
  text: string,
  params: unknown[] = [],
): Promise<DbRow[]> {
  return await sql.query(text, params) as unknown as DbRow[];
}

/**
 * Vercel variables are normally unquoted, while copied `.env.local` values
 * often retain surrounding quotes and libpq-only channel_binding options.
 * Normalising here keeps every server handler on the same safe connection path.
 */
export function normalizeNeonConnectionString(raw: string): string {
  const unquoted = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  try {
    const parsed = new URL(unquoted);
    parsed.searchParams.delete('channel_binding');
    return parsed.toString();
  } catch {
    throw new NeonConfigurationError();
  }
}
