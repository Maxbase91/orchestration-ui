# Source connectors

A standardised, single-interface layer for reading upstream business objects
(requests, orders, invoices, contracts, suppliers, tickets, risk records, …).

The platform reads everything through these **ports**. The default implementation
reads the platform's **own store** — the system of record for this release — so
no live upstream connection is required. A later release can register a live
implementation for any object type; because every consumer depends only on the
ports, that swap needs **no change at the call site**.

Nothing here is specific to any organisation or industry. The upstream
`sourceSystem` is a free-form, deployment-configured identifier.

## Layout

| File | Responsibility |
|---|---|
| `ports.ts` | The `SourceConnector` interface + provenance envelope (`SourceRecord`, `SourceMeta`). |
| `registry.ts` | Resolve a connector by object type; register/replace implementations. |
| `own-store/factory.ts` | `createOwnStoreConnector` — builds a connector for any object from own-store reads with uniform filter / search / limit semantics. |
| `own-store/*-connector.ts` | One own-store connector per object type. |
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

`payment` is the supplier banking/payment master — a vendor-data **foundation** (not an R1 flow);
its `iban`/`bic` are sensitive and must be masked when surfaced. Seed-backed today; the `db/payments`
module is the seam to a Supabase table / live AP source later.

Not yet wired (no own-store read module): `support-ticket`, `risk-screening`, `category-taxonomy`,
`form-submission` — add a connector behind the ports when their data lands.
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

## Consumers on the layer

The front-door **catalogue and contract checks** (`step-pre-check.tsx`) and the
supplier/contract reads in `step-compliance.tsx` read through `useSourceData`.
Risk **reuse-matching** (`findMatchingRiskAssessments`) and the assistant lookups
are not yet routed — see the layer's status in `docs/roadmap/R1_BACKLOG_FIT_GAP.md` (they
need, respectively, validity-window query support and a server-side connector).

## The live-swap seam

To move an object type from the own store to a live upstream source:

1. Implement the `SourceConnector<TKey, TRecord>` interface against the live
   source. Set `mode: 'live'` and return the same domain type.
2. Register it: `registerConnector(createLiveSupplierConnector())` — this
   replaces the own-store connector for that object.
3. Consumers are unchanged.

The own-store connectors keep a `freshnessTtlSeconds` per object so a live
implementation can honour the same freshness expectations.
