// Server-side privileged data client. Supabase mode uses the SERVICE ROLE key;
// Neon mode uses the private connection through the allowlisted query executor.
// Only import from api/* handlers that require server-side data access.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NeonCompatibleClient } from '../src/lib/neon-compatible-client.js';
import { executeNeonRequest } from './db.js';

let client: SupabaseClient | null = null;

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
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  if (process.env.DATABASE_PROVIDER === 'neon') {
    client = new NeonCompatibleClient((payload) => executeNeonRequest(payload)) as unknown as SupabaseClient;
    return client;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new ServerConfigurationError();

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function requireAdminSecret(provided: string | string[] | undefined): boolean {
  const expected = process.env.ADMIN_SEED_SECRET;
  if (!expected) return false;
  const got = Array.isArray(provided) ? provided[0] : provided;
  return typeof got === 'string' && got === expected;
}
