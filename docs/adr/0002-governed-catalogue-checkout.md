# ADR-0002: Governed catalogue and contract checkout

## Context

Catalogue items previously jumped from a match to a one-click order, which lost delivery and accounting context and skipped the contract, supplier-risk, and audit linkage required for a defensible purchase. Contract call-offs needed the same lightweight requester experience without bypassing governance.

## Decision

Use a dedicated catalogue item-detail route and a shared checkout for catalogue orders and contract call-offs. Persist a complete request, first-class purchase requisition, and durable request lines. Create an internal PO only after the PR passes configured policy; valid orders below the configurable whole-request catalogue threshold (EUR 1,000 by default) auto-approve, while higher values use the existing approval policy. Contract validity/capacity and supplier identity are mandatory gates. An expired risk assessment submits with a risk-review workflow stage; an expired contract blocks submission until amended.

The checkout reads approved delivery and accounting defaults from a procurement profile and asks requesters only for missing or changed values. It never writes to upstream purchasing systems, preserving the R1 read-and-route boundary.

## Consequences

Requesters get a specific item screen and a short, understandable checkout. Procurement retains supplier, contract, risk, accounting, routing, PR, and PO evidence in the platform’s own store. The schema gains additive profile, requisition, and line tables, and downstream PO creation must consume the PR lifecycle rather than the old catalogue fast path.
