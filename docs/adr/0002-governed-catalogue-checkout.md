# ADR-0002: Governed catalogue and contract checkout

## Context

Catalogue items previously jumped from a match to a one-click order, which lost delivery and accounting context and skipped the contract, supplier-risk, and audit linkage required for a defensible purchase. Contract call-offs needed the same lightweight requester experience without bypassing governance.

## Decision

Use a dedicated catalogue item-detail route and a shared checkout for catalogue orders and contract call-offs. Persist a complete request, first-class purchase requisition, and durable request lines. Create an internal PO only after the PR passes configured policy; valid orders below the configurable whole-request catalogue threshold (EUR 1,000 by default) auto-approve, while higher values use the existing approval policy. Contract validity/capacity and supplier identity are mandatory gates. An expired risk assessment submits with a risk-review workflow stage; an expired contract blocks submission until amended.

The checkout reads approved delivery and accounting defaults from a procurement profile and asks requesters only for missing or changed values. Both Simple and Expert callers submit to `/api/governed-checkout`; that endpoint reloads supplier, contract, risk, catalogue, profile and policy data from Neon, recomputes the decision, and persists request, PR, lines and conditional PO in one Neon transaction. The requisition stores a deterministic payload fingerprint: a matching retry returns the aggregate, while reuse with different data returns a 409 conflict. The client decision is advisory and cannot override the server result.

It creates internal Neon request, PR, line, and conditional PO records in R1; it never writes to upstream purchasing systems. External purchase execution remains an R2 integration boundary. Policy threshold edits are stored in the singleton `procurement_policy_configs` record so browser previews and server writes use the same configuration.

## Consequences

Requesters get a specific item screen and a short, understandable checkout. Procurement retains supplier, contract, risk, accounting, routing, PR, and PO evidence in the platform’s own Neon store. The schema gains additive profile, requisition, line, fingerprint and policy tables, and downstream PO creation consumes the PR lifecycle rather than the old catalogue fast path. A failed transaction leaves no partial internal aggregate; an already-partial legacy aggregate is reported for recovery instead of silently repaired.
