import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local — see .env.example.',
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
