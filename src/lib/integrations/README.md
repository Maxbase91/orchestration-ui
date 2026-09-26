# Source connectors

A standardised, single-interface layer for reading upstream-shaped business objects
(requests, orders, invoices, contracts, suppliers, tickets, risk records, …).

The platform reads everything through these **ports**. The default implementation
reads the platform's **own Neon store** — the R1 system of record — so no live
upstream connection is required. R2 can register a live implementation for any
object type; because every consumer depends only on the ports, that swap needs
**no change at the call site**.

Nothing here is specific to any organisation or industry. The upstream
`sourceSystem` is a free-form, deployment-configured identifier.

## Layout

| File | Responsibility |
|---|---|
| `ports.ts` | The `SourceConnector` interface + provenance envelope (`SourceRecord`, `SourceMeta`). |
| `registry.ts` | Resolve a connector by object type; register/replace implementations. |
| `own-store/factory.ts` | `createOwnStoreConnector` — builds a connector for any object from own-store reads with uniform filter / search / limit semantics. |
| `own-store/*-connector.ts` | One own-store connector per object type. The supplier, contract and risk-assessment ones take the client they read with. |
| `shared-connectors.ts` | `createSharedConnectors(client)` — the supplier, contract and risk-assessment connectors for either side: the browser registers them with its `/api/db` client, a server handler builds them with its own. The one place a live connector for those three is swapped. |
| `reusable-assessments.ts` | `findReusableRiskAssessments` — the assessments a demand can reuse, read through the risk port. |
| `hooks.ts` | `useSourceObject` / `useSourceList` — TanStack Query hooks. |
| `index.ts` | Public entry point; `registerDefaultConnectors()`. |

## Registered objects

`registerDefaultConnectors()` wires an own-store connector for each canonical object:

| Object | Backed by | `sourceSystem` |
|---|---|---|
| `supplier` | `db/suppliers` | `supplier-master` |
| `contract` | `db/contracts` | `contract-management` |
| `purchase-request` | `db/requests` | `demand-intake` |
| `purchase-order` | `db/purchase-orders` | `purchase-orders` |
| `invoice` | `db/invoices` | `accounts-payable` |
| `risk-assessment` | `db/risk-assessments` | `risk-register` |
| `catalogue-item` | `db/catalogue-items` | `catalogue` |
| `payment` | `db/payments` | `accounts-payable-master` |
| `support-ticket` | `db/tickets` | `support-desk` |
| `sourcing-event` | `db/sourcing-events` | `sourcing` |

`payment` is the supplier banking/payment master — a vendor-data **foundation** (not an upstream R1 flow);
its `iban`/`bic` are sensitive and must be masked when surfaced. Seed-backed today; the `db/payments`
module is the seam to the Neon store / a live AP source later.

`support-ticket` is the support queue. Its TTL is 60s rather than the hour used for reference data:
a queue is worked by several agents at once, so a stale list costs more here. Reads through the
connector are unscoped (the agent-side view); requester-scoped reads deliberately bypass it and call
`db/tickets`.`listTickets()` with the caller's name, because entitlement depends on who is asking and
a port has no notion of a current user.

`sourcing-event` is the RFx register. A 5-minute TTL sits between the support queue's 60s and the
hour used for reference data: an event's own fields change rarely once published, and what actually
moves — the response set — is read through `db/sourcing-responses` rather than this port. `requestId`
is filterable because the link is a column on the event; "which suppliers were invited" is a join, so
it is deliberately not a field test.

Note that `awardedSupplierId` and `status` move on award, so a consumer reading a *just-awarded*
event through this port can see a stale row for up to the TTL. That is acceptable for the register
and the connector's reporting consumers; anything acting on an award — the evaluation screen, the
re-apply repair — reads through `db/sourcing-events` directly instead, where there is no cache
between it and the decision.

Not yet wired (no own-store read module): `risk-screening`, `category-taxonomy`,
`form-submission` — these remain R1 hardening items before any R2 live connector is added.
Coverage is guarded by `npm run test:connectors` (drift guard).

## Reading data

Two hook pairs. Use the `*Record` form when you need provenance; use the plain
form (drop-in for a `db/hooks/use-*` hook) when you only need the domain data:

```ts
import {
  useSourceObject, useSourceList,   // → SourceRecord<T> (with provenance)
  useSourceDatum, useSourceData,     // → T | T[] (domain data only)
} from '@/lib/integrations';
import type { Supplier } from '@/data/types';

// Provenance-aware
const { data: record } = useSourceObject<Supplier>('supplier', supplierId); // SourceRecord<Supplier> | null
const { data: records } = useSourceList<Supplier>('supplier');               // SourceRecord<Supplier>[]

// Domain data only (drop-in replacement for useSuppliers(), etc.)
const { data: supplier } = useSourceDatum<Supplier>('supplier', supplierId); // Supplier | null
const { data: active = [] } = useSourceData<Supplier>('supplier', {
  filters: { riskRating: 'low' },
  search: 'logistics',
  limit: 20,
});                                                                          // Supplier[]
```

A `SourceRecord<T>` is `{ data, meta }`. `meta` carries the `sourceSystem`,
`mode` (`shadow` | `live`), `retrievedAt`, and an optional `freshnessTtlSeconds`,
so consumers can reason about freshness regardless of where the record came from.

The R1 implementation is the private Neon-backed own store. There is one database and no provider
switch. The read-only `/api/neon-health` dispatcher route reports safe connectivity and
error classes without exposing connection details.

### On the server

Submit decides a demand again on the server and refuses when the answer differs from the one the
requester reviewed ([ADR-0010](../../../docs/adr/0010-submit-decides-again.md)). That is only fair
when both decisions read the same data the same way, so the supplier, its contracts and its reusable
risk assessments are read on the server through the same connectors: `createSharedConnectors`
builds them for the server's client (`getDbAdmin()`), with the same read cores
(`src/lib/db/*-core.ts`) and mapping the browser uses. The server's client JSON-encodes its answers
as `/api/db` does, so a date is the same ISO string on both sides.

### Where the ports are bypassed today

The other server-side handlers — `api/_domains/*` and `api/governed-checkout.ts` — read with raw SQL
rather than through these ports. That is a **gap**, recorded here rather than argued away: the
ground rule in AGENTS.md (rule 2) says reads go through the ports, and these do not. Closing it means
moving them onto the shared connectors (adding an object there when a handler needs it), not adding
more direct reads.

## Consumers on the layer

The front-door **catalogue and contract checks** (the conversation page's
`new-request/conversation/use-route-checks.ts`) and
client-side assistant lookups read through `useSourceData`/`requireConnector`. (The
supplier and contract reads in `step-compliance.tsx` went with that step on
2026-09-26: the Channel page shows the determination, which already has them.) Risk **reuse-matching** reads through the risk port
(`findReusableRiskAssessments`, with the connector's `validAfter` filter) for the determination, the
risk stage and submit's second decision alike — it was a query of its own beside the port. The
server-side assistant action path still reads with SQL (see the layer's status in
`docs/roadmap/R1_BACKLOG_FIT_GAP.md`).

## The live-swap seam

To move an object type from the own store to a live upstream source in R2:

1. Implement the `SourceConnector<TKey, TRecord>` interface against the live
   source. Set `mode: 'live'` and return the same domain type.
2. Register it: `registerConnector(createLiveSupplierConnector())` — this
   replaces the own-store connector for that object. For the supplier, contract
   and risk assessment, swap it in `createSharedConnectors` instead, so the
   server reads the live source too — a browser and a server reading different
   sources would decide the same demand two ways, and submit would refuse it.
3. Consumers are unchanged.

The own-store connectors keep a `freshnessTtlSeconds` per object so a live
implementation can honour the same freshness expectations.

Contract matching is a domain read layered over the own-store contract connector: the browser calls
`/api/contract-match`, implemented by `api/_domains/contract-match.ts`, which loads effective-dated scope versions, deliverables and exclusions from
Neon and applies deterministic eligibility before optional Groq/Gemini reranking. Governed checkout
repeats that read server-side, so a client preview cannot authorize a call-off. A future CLM connector
can replace the source records without changing the matcher or its consumers.
