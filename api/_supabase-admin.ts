// Server-side Supabase client using the SERVICE ROLE key. Bypasses RLS.
// Only import from inside api/* handlers that require admin privileges
// (e.g. seeding). Never import this from the browser bundle.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase admin env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
}

export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function requireAdminSecret(provided: string | string[] | undefined): boolean {
  const expected = process.env.ADMIN_SEED_SECRET;
  if (!expected) return false;
  const got = Array.isArray(provided) ? provided[0] : provided;
  return typeof got === 'string' && got === expected;
}
