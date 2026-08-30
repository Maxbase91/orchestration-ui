# Supabase-to-Neon migration

The repository schema remains the source of truth for the application-owned PostgreSQL model. Apply [`../schema.sql`](../schema.sql) to the Neon project before copying data. If the SQL editor stops part-way through, resume safely with `npm run migrate:neon-schema`; it applies additive statements, replaces views, and skips destructive drops and Supabase RLS policies.

With `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEON_DATABASE_URL` (or `DATABASE_URL`) set, run:

```bash
npm run migrate:supabase-to-neon
```

The script is idempotent and non-destructive: it inserts missing rows, never drops or truncates either database, and reports source/target counts. It copies the known application tables in foreign-key-safe order. Rows created in Supabase while the script is running may be absent because the selected cutover policy does not use a write freeze.

After the data copy, set `DATABASE_PROVIDER=neon` and `VITE_DATABASE_PROVIDER=neon` in Vercel. Keep Supabase server variables until post-cutover validation and rollback acceptance are complete. Never put `NEON_DATABASE_URL` or any database password in a `VITE_` variable.

If the source catalogue predates the governed-checkout columns, repair the migrated
catalogue links in Neon with `npm run backfill:neon-catalogue-governance`. The
backfill is idempotent and only creates missing own-store supplier/contract/risk
records before linking each existing catalogue item; it does not create orders.
