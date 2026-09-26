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
 * What /api/db would have answered. The endpoint's response goes through JSON,
 * so the browser gets a date as an ISO string; the driver hands this in-process
 * path a Date object. A server reader therefore saw other values than the
 * browser for the same row — the risk port's reuse filter called `.slice` on a
 * Date — and submit's second decision could not be compared with the browser's
 * first (2026-09-26). Encoded the same way, it is one data path again.
 */
function asTheEndpointAnswers(result: unknown): unknown {
  return result === undefined ? null : JSON.parse(JSON.stringify(result));
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
  client = new NeonCompatibleClient(async (payload) => asTheEndpointAnswers(await executeNeonRequest(payload)));
  return client;
}

export function requireAdminSecret(provided: string | string[] | undefined): boolean {
  const expected = process.env.ADMIN_SEED_SECRET;
  if (!expected) return false;
  const got = Array.isArray(provided) ? provided[0] : provided;
  return typeof got === 'string' && got === expected;
}
