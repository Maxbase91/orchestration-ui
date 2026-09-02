# ADR-0003: Private Neon database with an API boundary

## Context

The application historically used Supabase PostgREST directly from React and from Vercel handlers. That exposed the browser to a database API whose permissive prototype policies were not an authorization boundary. The repository schema and application-owned data were migrated to Neon while retaining Supabase only for rollback/comparison.

## Decision

Use Neon PostgreSQL as a private database and route browser operations through the allowlisted `/api/db` endpoint. The endpoint rejects arbitrary relations, identifiers, SQL, and functions; only application-owned tables/views and the two documented ID functions are available. Existing data modules retain their public function shape through a compatibility client. (It was originally selected by `VITE_DATABASE_PROVIDER`; see the update below — that switch is gone.)

Neon is the active R1 database. Keep the current prototype role-switching identity model for simulation and UAT; real authentication and production authorization remain a separate deferred hardening milestone.

Copy all rows from the repository-defined schema with an idempotent, non-destructive migration script. The cutover is immediate with no write freeze, so the migration records a best-effort count/mismatch report and retains Supabase for rollback.

## Update — the rollback window is closed

Supabase is decommissioned. The provider switch is gone: `src/lib/supabase-client.ts` always
constructs the Neon-backed client, and `api/_supabase-admin.ts` no longer has a Supabase branch. The
browser client is also no longer cast to `SupabaseClient` — that cast made TypeScript accept any call
site regardless of what the compatibility client implements, and it hid a missing `.contains()` that
threw in production every sixty seconds.

Keeping both paths was itself the defect: `import.meta.env.PROD` chose Neon in production and
Supabase in dev, so no test exercised the client that production ran. Three defects reached users
through that gap. One client, one code path.

The ten integration suites that built their own Supabase client now use a Neon-backed one with the
same query surface (`neonClient()` in `tests/lib/live.mjs`), so ~1,800 lines of behaviour assert
against the system of record instead of skipping. `@supabase/supabase-js` remains only because the
migration script reads *from* Supabase.

One thing this update does **not** change: `/api/db` still has no authentication. An unfiltered
DELETE or UPDATE is refused, which bounds the damage, but that is not authorization.

## Consequences

- Neon credentials stay server-only (`NEON_DATABASE_URL`/`DATABASE_URL`).
- The browser no longer requires Supabase URL or anon-key variables in Neon mode.
- Supabase-specific RLS policies are not treated as application authorization; API authorization must be added when real authentication is introduced.
- A no-freeze cutover can miss writes made during the copy window; operators must review the mismatch report before accepting the cutover.
- The migration is intentionally limited to schema and tables owned by this repository; undocumented Supabase objects require a complete PostgreSQL dump.
