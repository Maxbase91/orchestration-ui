# Applying the schema to Neon

The repository schema is the source of truth for the application-owned PostgreSQL model. Apply
[`../schema.sql`](../schema.sql) to the Neon project. If the SQL editor stops part-way through, resume
safely with `npm run migrate:neon-schema`; it applies additive statements, replaces views, and skips
destructive drops and the legacy row-level-security policies, which are not this application's
authorization boundary.

The schema includes both request-bound `ai_conversations` transcripts and the user-scoped
`assistant_conversations` history used by the assistant inbox and full-page assistant.

Neon is the only store. The browser holds no database credential — it posts to the allowlisted
`/api/db` boundary — so `NEON_DATABASE_URL` (or `DATABASE_URL`) is the only database variable the
deployment needs. Never put it, or any database password, in a `VITE_` variable.

## Data repairs

The one-way copy that seeded Neon has been removed along with the source it read from; what remains
are idempotent repairs that run against Neon alone.

| Command | What it does |
| --- | --- |
| `npm run backfill:intake-compliance` | Restores the 39 `intake_compliance_records` rows that the cutover's copy list omitted. Every statement is `ON CONFLICT DO NOTHING`, so it is safe to re-run. |
| `npm run backfill:neon-catalogue-governance` | Repairs catalogue links where the migrated data predates the governed-checkout columns: creates missing own-store supplier/contract/risk records, then links each existing catalogue item. Never creates requests or orders. |
| `npm run backfill:compliance` | Fills front-door determination fields on `requests` rows that predate them, using the same decisioning functions the live wizard runs. Only ever fills nulls. |
