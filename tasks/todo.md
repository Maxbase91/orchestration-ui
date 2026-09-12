# Drop the Supabase row-level-security scaffolding

## Why
`db/schema.sql` carries 47 `ENABLE ROW LEVEL SECURITY` statements and 47 policies,
every one of them `FOR ALL USING (true) WITH CHECK (true)`. It is scaffolding from
the Supabase era that survived the Neon migration (ADR-0003). It enforces nothing —
the app connects as the table owner, and an open policy would not restrict it even
if it did not — but it reads to a reader or an auditor like access control, which is
the reason to remove it rather than leave it.

Approved by the user: "you can drop it, everything regarding Supabase can be dropped
as we migrated fully to Neon."

## The trap to avoid
Deleting the lines from `schema.sql` alone does **not** remove RLS from the live
database. It would only stop *fresh* environments enabling it, so live and fresh
would diverge — the same schema-drift shape that has already bitten this codebase
twice (the three `service_descriptions` columns, and the contract-scope tables).

So the change is in three parts, in this order.

## Steps
1. [x] Write `db/backfills/2026-09-12-drop-supabase-rls.mjs` — drops every policy and
       disables RLS on every table that has it, read from `pg_policies` /
       `pg_class.relrowsecurity` rather than from a hand-written list, so it cannot
       miss one. `requireConnectionOrFail`, per the backfill rule.
2. [x] Run it against the live database; verify 0 policies and 0 RLS-enabled tables.
3. [x] Remove the 47 + 47 + 37 statements from `db/schema.sql`, leaving a comment
       saying RLS was removed and where real policies would go if identity lands.
4. [x] Delete the empty `supabase/` directory (holds only a `.DS_Store`).
5. [x] Extend `test:schema-drift` so a reintroduced policy or RLS-enabled table fails
       the gate — the guard is what stops this growing back.
6. [x] Verify: `tsc`, lint, `test:all`, `test:neon-live`, `test:schema-drift`.
7. [x] Docs: README, TEST_PLAYBOOK, ADR-0003 consequences.

## Then — restructuring, per the assessment's own recommendations
8.  [x] Move `src/server/api/` → `api/_domains/` (8 files, ~20 imports).
9.  [x] Decide and document what `src/lib/integrations/own-store/` is for; make the
        five direct-client call sites conform.
10. [x] Fold `src/hooks/use-breadcrumbs.ts` into the layout code and delete the dir.
11. [x] Rename the four camelCase modules to kebab-case.

Deferred deliberately (recorded in the assessment): splitting the three large intake
files rides along with the redesign; `src/lib/procurement/` stays flat; the
`-core.ts` asymmetry is correct and gets a comment, not a sibling.


---

## Done — 12 September 2026

All eleven steps complete across four commits. Two things the work surfaced that
were not in the plan:

- **The applier had been discarding the RLS statements all along.**
  `apply-neon-schema.mjs` skipped every `CREATE POLICY` and `ENABLE ROW LEVEL
  SECURITY`, so `db/schema.sql` described 47 RLS-enabled tables while the live
  database carried one. A skip in the applier is a schema the file describes and
  no environment gets — the same drift shape as the three `service_descriptions`
  columns. Both skip rules removed with the statements.

- **Moving `src/server/api/` out of `src/` exposed a type hole and a duplicate.**
  Those files import `@vercel/node`, whose types leaked Node's globals into the
  browser program, which is the only reason `src/lib/llm.ts` could reference
  `process.env` and typecheck. Removing the leak broke the build, correctly — and
  `src/lib/llm.ts` turned out to be a second copy of `api/_llm.ts` naming a
  **different Groq model**, so the assistant and the four single-shot handlers had
  been running on different models with nothing saying so. Merged with no change
  to which model any endpoint uses; the difference is a parameter now.

Also closed while consolidating the data layer: `assistant_conversations` and
`chat_feedback` had no data-access module, so three components wrote their own
queries and disagreed about whether to scope by `user_id`.

Deferred as recommended, not forgotten: splitting the three large intake files
rides along with the redesign; `src/lib/procurement/` stays flat until ~60 files;
`engine.ts` and `transition.ts` keep direct client access until they move behind
a server endpoint.
