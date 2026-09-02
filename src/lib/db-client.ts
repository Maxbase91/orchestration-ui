// The application's database client.
//
// Neon is the store, and this is the only path to it from the browser: every
// call goes to the allowlisted /api/db boundary, so the page never holds a
// database credential.
//
// Two pieces of history worth keeping, because both cost a release:
//
// It used to choose between two providers on `import.meta.env.PROD` — the
// retired one in dev, Neon in production — so no test anywhere exercised the
// client production actually ran. Three defects reached users through that gap,
// none of them reproducible locally. One client, one code path.
//
// It was also cast to the retired client's type. That cast made TypeScript
// accept every call site regardless of what this client implements, so a method
// the compatibility layer lacked (`.contains()`) compiled cleanly and threw at
// runtime — the same failure shape as the `?.trim()` crash before it. Typed as
// itself, a missing method is a build error.

import { NeonCompatibleClient } from './neon-compatible-client';

export const db = new NeonCompatibleClient();
