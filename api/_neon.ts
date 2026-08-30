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
  // Neon may need to wake an idle branch during the first parallel page load;
  // keep this above the browser request budget so the API returns a clear error
  // instead of aborting every cold-start query at the same instant.
  client = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(30000) } });
  return client;
}
