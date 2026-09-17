# `src/lib/db` — the data-access layer

One module per relation, plus the TanStack Query hooks in `hooks/`. This is where
a read or a write to the platform's own store belongs.

## Which layer do I use?

| You are… | Use |
|---|---|
| a component that needs data | `hooks/use-<entity>.ts` |
| a function that needs data | `<entity>.ts` |
| a serverless handler in `api/` | the `<entity>-core.ts` variant, which takes a client |
| reading an object that could one day come from an upstream system | a port in `src/lib/integrations` |
| anything else | still one of the above — **not** `db-client` directly |

`src/lib/db-client.ts` is the transport. Importing it outside this directory
means writing a query nobody else can find, reuse or fix: it is how
`assistant_conversations` and `chat_feedback` came to be read and written from
three different components, each with slightly different filters — the thread
list scoped its update by `user_id` and the rename did not, and nothing made
that difference deliberate.

## The `-core.ts` pattern

`api/` cannot resolve the `@/` alias at runtime, and these modules import the
`@/`-aliased browser client. So a module a serverless handler also needs is
split: `<entity>-core.ts` takes a `NeonCompatibleClient` parameter and uses
relative `.js` specifiers, and `<entity>.ts` passes the browser singleton to it.

There are four: `approvals-core`, `receipts-core`, `tickets-core`,
`user-preferences-core`. Only three have a browser-side sibling —
`receipts-core` has no `receipts.ts` because nothing in the browser needs it
yet. **That asymmetry is correct.** The split exists so two runtimes can share
one implementation, not as a naming scheme to apply evenly; adding a
`receipts.ts` to make the set look tidy would add a module with no caller.

## Known exceptions

`src/lib/workflow/engine.ts` and `src/lib/workflow/transition.ts` still use
`db-client` directly. They perform ordered multi-table sequences — close the
open `stage_history` row, then open its replacement, then move the request —
where routing each statement through a per-entity module would scatter an
ordering constraint across four files without making it atomic.

The real fix is not to reroute them through this layer but to move them behind a
server endpoint, the way `api/workflow-action.ts` already handles the same
sequence transactionally. Recorded as a gap rather than argued away.

## A module with no importers is not free

`src/lib/db/sla-targets.ts` and `hooks/use-sla-targets.ts` were deleted in C10.
Nothing had imported either for months — every countdown reads
`requests.sla_deadline`, computed from the workflow template node's `slaDays` —
but they were not merely inert. `resolveSla` ended in `?? 5`, so any future
caller would have been handed a five-day target for a stage nobody configured,
and the nine `sla_targets` stage rows they read disagreed with the templates in
six of nine stages. A reader that invents an answer, pointed at a table nothing
maintains, is one import away from becoming a second source of truth.

Stage SLAs now have one reader: `src/lib/workflow/stage-sla.ts`, which returns
`null` when nothing defines one. `sla_targets` keeps only its `stage='ticket'`
rows, read by `tickets-core.ts` — one table, one purpose.
