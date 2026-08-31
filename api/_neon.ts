// Server-only Neon connection factory used by Vercel handlers and the database
// compatibility endpoint. The connection string is never sent to the browser.

import { neon } from '@neondatabase/serverless';

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
