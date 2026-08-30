import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NeonCompatibleClient } from './neon-compatible-client';

const provider = import.meta.env.VITE_DATABASE_PROVIDER as string | undefined;
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient;
if (provider === 'neon') {
  // The cast keeps the existing data modules source-compatible while the
  // compatibility client routes operations through the private server API.
  client = new NeonCompatibleClient() as unknown as SupabaseClient;
} else if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local — see .env.example.',
  );
} else {
  client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabase: SupabaseClient = client;
