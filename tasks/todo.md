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
1. [ ] Write `db/backfills/2026-09-12-drop-supabase-rls.mjs` — drops every policy and
       disables RLS on every table that has it, read from `pg_policies` /
       `pg_class.relrowsecurity` rather than from a hand-written list, so it cannot
       miss one. `requireConnectionOrFail`, per the backfill rule.
2. [ ] Run it against the live database; verify 0 policies and 0 RLS-enabled tables.
3. [ ] Remove the 47 + 47 + 37 statements from `db/schema.sql`, leaving a comment
       saying RLS was removed and where real policies would go if identity lands.
4. [ ] Delete the empty `supabase/` directory (holds only a `.DS_Store`).
5. [ ] Extend `test:schema-drift` so a reintroduced policy or RLS-enabled table fails
       the gate — the guard is what stops this growing back.
6. [ ] Verify: `tsc`, lint, `test:all`, `test:neon-live`, `test:schema-drift`.
7. [ ] Docs: README, TEST_PLAYBOOK, ADR-0003 consequences.

## Then — restructuring, per the assessment's own recommendations
8.  [ ] Move `src/server/api/` → `api/_domains/` (8 files, ~20 imports).
9.  [ ] Decide and document what `src/lib/integrations/own-store/` is for; make the
        five direct-client call sites conform.
10. [ ] Fold `src/hooks/use-breadcrumbs.ts` into the layout code and delete the dir.
11. [ ] Rename the four camelCase modules to kebab-case.

Deferred deliberately (recorded in the assessment): splitting the three large intake
files rides along with the redesign; `src/lib/procurement/` stays flat; the
`-core.ts` asymmetry is correct and gets a comment, not a sibling.
