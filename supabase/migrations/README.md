# Supabase-to-Neon migration

The repository schema remains the source of truth for the application-owned PostgreSQL model. Apply [`../schema.sql`](../schema.sql) to the Neon project before copying data. If the SQL editor stops part-way through, resume safely with `npm run migrate:neon-schema`; it applies additive statements, replaces views, and skips destructive drops and Supabase RLS policies.

The schema includes both request-bound `ai_conversations` transcripts and the
user-scoped `assistant_conversations` history used by the assistant inbox and
full-page assistant. Older Supabase projects may not have the latter; the data
copy treats it as an optional source table and leaves the Neon table empty until
new conversations are created.

With `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEON_DATABASE_URL` (or `DATABASE_URL`) set, run:

```bash
npm run migrate:supabase-to-neon
```

The script is idempotent and non-destructive: it inserts missing rows, never drops or truncates either database, and reports source/target counts. It copies the known application tables in foreign-key-safe order. Rows created in Supabase while the script is running may be absent because the selected cutover policy does not use a write freeze.

The cutover is done and the provider switch is gone: Neon is the only store, and the browser posts to
`/api/db` rather than holding a credential. Only `NEON_DATABASE_URL` is needed in Vercel. Never put it,
or any database password, in a `VITE_` variable.

The Supabase server variables are still used locally by the ten integration suites that have not been
rewritten against Neon (see the known-gap note in `docs/testing/TEST_PLAYBOOK.md`); the application
does not read them.

If the source catalogue predates the governed-checkout columns, repair the migrated
catalogue links in Neon with `npm run backfill:neon-catalogue-governance`. The
backfill is idempotent and only creates missing own-store supplier/contract/risk
records before linking each existing catalogue item; it does not create orders.
