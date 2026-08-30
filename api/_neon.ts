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
  const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new NeonConfigurationError();
  // Do not cache this signal with the client: Vercel reuses warm modules, and
  // an expired module-level AbortSignal would make every later query fail
  // immediately. A fresh client/signal also covers Neon branch wake-up time.
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(30000) } });
}
