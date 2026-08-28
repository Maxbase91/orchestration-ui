// Server-side Supabase client using the SERVICE ROLE key. Bypasses RLS.
// Only import from inside api/* handlers that require admin privileges
// (e.g. seeding). Never import this from the browser bundle.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** A recoverable server configuration error, safe to turn into a 503 response. */
export class ServerConfigurationError extends Error {
  constructor() {
    super('Supabase admin configuration is unavailable.');
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
