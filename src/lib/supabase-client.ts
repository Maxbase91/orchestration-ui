// The application's database client.
//
// Neon is the store. This used to pick between Neon and Supabase — Supabase in
// dev, Neon whenever `import.meta.env.PROD` — which meant no test anywhere
// exercised the client production actually runs. Three defects reached users
// through that gap, none of them reproducible locally. One client, one code
// path, dev and production alike.
//
// It is also no longer cast to `SupabaseClient`. That cast made TypeScript
// accept every call site regardless of what the client implements, so a method
// the compatibility layer lacked (`.contains()`) compiled cleanly and threw at
// runtime — the same failure shape as the `?.trim()` crash that cost a release.
// Typed as itself, a missing method is a build error.

import { NeonCompatibleClient } from './neon-compatible-client';

export const supabase = new NeonCompatibleClient();
