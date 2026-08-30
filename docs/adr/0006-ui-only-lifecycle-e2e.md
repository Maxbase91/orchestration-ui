# ADR 0006: UI-only procurement lifecycle verification

## Status

Accepted for UAT verification.

## Decision

The release test for catalogue orders, contract call-offs and full requests is
performed through the deployed UI with the visible role switcher. No test step
uses direct database writes, API calls, localStorage impersonation or hidden
admin mutations. Temporary records are retained with a `UI-E2E-<timestamp>`
prefix so reviewers can trace the complete request, PR, PO, receipt, invoice
and payment history.

Payment is an internal simulation: the supplier submits an invoice, Operations
matches it, Procurement approves it, and Admin marks it scheduled/paid. No
external ERP, bank or payment-system write is made.

## Rationale and constraints

Role switching is a simulation/UAT mechanism and does not provide production
authorization. Every action remains visible only to the role that owns the
current stage. Screenshots and a manifest are stored under
`docs/testing/artifacts/ui-e2e/<run-id>/`.

The application must remain within the Vercel Hobby limit of twelve deployable
functions; new lifecycle behavior therefore uses existing domain endpoints or
the API dispatcher rather than adding a function per action.
