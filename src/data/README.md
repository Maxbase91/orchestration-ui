# `src/data` — seed fixtures and domain types

Two different things live here, and only one of them runs in the app.

## `types.ts` — the domain model
The shared entity types (`ProcurementRequest`, `Supplier`, `Contract`, …), imported
by ~340 modules. This is the canonical model; keep new entity types here rather
than beside the module that happens to introduce them.

## Everything else — seed fixtures
The remaining files are **seed data, not a data layer**. Each exports an array of
fixtures, and the only consumer is `api/admin/seed.ts`, which imports them
dynamically to populate a fresh Neon database. Nothing in the browser bundle
reads them.

The runtime app reads the database:

| Need | Use |
|---|---|
| Data in a component | `src/lib/db/hooks/use-<entity>.ts` (TanStack Query) |
| Data in a function | `src/lib/db/<entity>.ts` |
| Data in a serverless handler | the `-core.ts` variant, which takes a client |
| An upstream object | `src/lib/integrations` ports |

**Do not add accessor functions to these files.** They used to carry 36 of them —
`getRequestById`, `getContractsByStatus`, `getUsersByRole` and so on — none of
which had a caller. They were a hazard rather than dead weight: each one looks
like the data layer and returns a fixture, so anything that picked one up would
have silently read stale mock data instead of the store. They were removed in
the 2026-09-12 cleanup.
