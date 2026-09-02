// Server-side privileged data client, backed by the private Neon connection
// through the allowlisted query executor. Only import from api/* handlers that
// require server-side data access.
//
// This used to choose between two providers on DATABASE_PROVIDER, with a
// fail-closed branch for a rollback window that is now over. A second data path
// is what let dev and production run different code, so there is one.

import { NeonCompatibleClient } from '../src/lib/neon-compatible-client.js';
import { executeNeonRequest } from './db.js';

let client: NeonCompatibleClient | null = null;

/** A recoverable server configuration error, safe to turn into a 503 response. */
export class ServerConfigurationError extends Error {
  constructor() {
    super('Database administration configuration is unavailable.');
    this.name = 'ServerConfigurationError';
  }
}

/**
 * Construct the privileged client only when an API handler needs it. Import-time
 * validation made every dependent Vercel function crash before it could return
 * a controlled error when a production environment variable was absent.
 *
 * The executor runs the query in-process rather than posting to /api/db, so a
 * server handler does not make an HTTP round trip to its own deployment.
 */
export function getDbAdmin(): NeonCompatibleClient {
  if (client) return client;
  if (!process.env.NEON_DATABASE_URL && !process.env.DATABASE_URL) throw new ServerConfigurationError();
  client = new NeonCompatibleClient((payload) => executeNeonRequest(payload));
  return client;
}

export function requireAdminSecret(provided: string | string[] | undefined): boolean {
  const expected = process.env.ADMIN_SEED_SECRET;
  if (!expected) return false;
  const got = Array.isArray(provided) ? provided[0] : provided;
  return typeof got === 'string' && got === expected;
}
