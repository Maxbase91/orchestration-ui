// Server-only Neon connection factory used by Vercel handlers and the database
// compatibility endpoint. The connection string is never sent to the browser.

import { neon } from '@neondatabase/serverless';

let client: ReturnType<typeof neon> | null = null;

export class NeonConfigurationError extends Error {
  constructor() {
    super('Neon database configuration is unavailable.');
    this.name = 'NeonConfigurationError';
  }
}

export function getNeonClient(): ReturnType<typeof neon> {
  if (client) return client;
  const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new NeonConfigurationError();
  client = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(10000) } });
  return client;
}

