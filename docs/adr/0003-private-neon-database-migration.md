# ADR-0003: Private Neon database with an API boundary

## Context

The application historically used Supabase PostgREST directly from React and from Vercel handlers. That exposed the browser to a database API whose permissive prototype policies were not an authorization boundary. The repository schema and application-owned data were migrated to Neon while retaining Supabase only for rollback/comparison.

## Decision

Use Neon PostgreSQL as a private database and route browser operations through the allowlisted `/api/db` endpoint. The endpoint rejects arbitrary relations, identifiers, SQL, and functions; only application-owned tables/views and the two documented ID functions are available. Existing data modules retain their public function shape through a compatibility client selected by `VITE_DATABASE_PROVIDER=neon`.

Neon is the active R1 database. Keep the current prototype role-switching identity model for simulation and UAT; real authentication and production authorization remain a separate deferred hardening milestone.

Copy all rows from the repository-defined schema with an idempotent, non-destructive migration script. The cutover is immediate with no write freeze, so the migration records a best-effort count/mismatch report and retains Supabase for rollback.

## Consequences

- Neon credentials stay server-only (`NEON_DATABASE_URL`/`DATABASE_URL`).
- The browser no longer requires Supabase URL or anon-key variables in Neon mode.
- Supabase-specific RLS policies are not treated as application authorization; API authorization must be added when real authentication is introduced.
- A no-freeze cutover can miss writes made during the copy window; operators must review the mismatch report before accepting the cutover.
- The migration is intentionally limited to schema and tables owned by this repository; undocumented Supabase objects require a complete PostgreSQL dump.
