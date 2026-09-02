# ADR-0003: Private Neon database with an API boundary

## Context

The application historically used Supabase PostgREST directly from React and from Vercel handlers. That exposed the browser to a database API whose permissive prototype policies were not an authorization boundary. The repository schema and application-owned data were migrated to Neon while retaining Supabase only for rollback/comparison.

## Decision

Use Neon PostgreSQL as a private database and route browser operations through the allowlisted `/api/db` endpoint. The endpoint rejects arbitrary relations, identifiers, SQL, and functions; only application-owned tables/views and the two documented ID functions are available. Existing data modules retain their public function shape through a compatibility client. (It was originally selected by `VITE_DATABASE_PROVIDER`; see the update below — that switch is gone.)

Neon is the active R1 database. Keep the current prototype role-switching identity model for simulation and UAT; real authentication and production authorization remain a separate deferred hardening milestone.

Copy all rows from the repository-defined schema with an idempotent, non-destructive migration script. The cutover is immediate with no write freeze, so the migration records a best-effort count/mismatch report and retains Supabase for rollback.

## Update — the rollback window is closed

Supabase is decommissioned. The provider switch is gone: the browser client (then
`src/lib/supabase-client.ts`, now `src/lib/db-client.ts`) always constructs the Neon-backed client,
and the server-side admin client (then `api/_supabase-admin.ts`, now `api/_db-admin.ts`) no longer
has a Supabase branch. The browser client is also no longer cast to `SupabaseClient` — that cast made TypeScript accept any call
site regardless of what the compatibility client implements, and it hid a missing `.contains()` that
threw in production every sixty seconds.

Keeping both paths was itself the defect: `import.meta.env.PROD` chose Neon in production and
Supabase in dev, so no test exercised the client that production ran. Three defects reached users
through that gap. One client, one code path.

The ten integration suites that built their own Supabase client now use a Neon-backed one with the
same query surface (`neonClient()` in `tests/lib/live.mjs`), so ~1,800 lines of behaviour assert
against the system of record instead of skipping. `@supabase/supabase-js` remained at that point only
because the one-way copy script read *from* Supabase; see the second update below.

One thing this update does **not** change: `/api/db` still has no authentication. An unfiltered
DELETE or UPDATE is refused, which bounds the damage, but that is not authorization.

## Update — Supabase is fully removed (2026-09-02)

The rollback window closing left the name in the tree; this removes it. Nothing in the repository
depends on, reads from, or can be pointed at Supabase any more:

- `@supabase/supabase-js` is out of `package.json`. The two scripts that needed it — the one-way copy
  (`migrate:supabase-to-neon`) and the 2026-08-29 catalogue backfill — read *from* the retired project
  and are deleted. Every remaining data repair runs against Neon alone.
- The directory is `db/`, not `supabase/`. `src/lib/supabase-client.ts` is `src/lib/db-client.ts`,
  `src/lib/supabase.ts` is `src/lib/db-query.ts`, and `api/_supabase-admin.ts` is `api/_db-admin.ts`.
- `SUPABASE_*` and `VITE_SUPABASE_*` are gone from `.env.example` and from the deployment's
  documented variables. `NEON_DATABASE_URL` is the only database variable.
- The 39 `intake_compliance_records` rows the copy list omitted were exported as committed SQL
  (`db/backfills/2026-09-02-intake-compliance-records.sql`, applied by
  `npm run backfill:intake-compliance`). **This is what made removal possible**: the recovery no
  longer depends on the source project still existing.
- `test:neon-migration` asserts the absence — the dependency, the environment variables, the server
  fallback, and any `Supabase` identifier in `src/`, `api/` or `tests/` outside a reviewed allowlist.

What this update does **not** change, again: `/api/db` still has no authentication.

## Consequences

- Neon credentials stay server-only (`NEON_DATABASE_URL`/`DATABASE_URL`).
- The browser requires no database variable at all: it posts to `/api/db` and holds no credential.
- The retired provider's row-level-security policies were never treated as application authorization; API authorization must be added when real authentication is introduced.
- The no-freeze cutover did miss writes: one table was absent from the copy list and 39 rows were left behind. They are recovered from committed SQL, and `test:table-lists` now requires every difference between the schema, the `/api/db` allowlist and the live guard to be declared.
- The migration was intentionally limited to schema and tables owned by this repository. Any object outside it was not carried over, and the source is no longer reachable from this repository.
