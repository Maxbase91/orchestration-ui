# ADR-0007: Atomic intake submission and lifecycle stabilisation

## Context

The adaptive intake previously persisted the request, service description,
compliance result and workflow in separate browser calls. A failed later call
could leave an intake record that looked submitted but had no supporting
evidence. Date answers could also be prose, and the shared catalogue checkout
treated an empty draft date as missing even when the rest of the order was
ready.

## Decision

Route completed full-demand intake through `/api/intake-submit`. The handler
validates the confirmed ISO date, route, accounting and beneficiary and uses a
single Neon transaction for the request, structured description, compliance,
stage history, workflow instance and initial approval entry where required.
The server selects the first actionable stage; the client only navigates after
the response confirms persistence. The legacy `business_justification` field
remains nullable for compatibility and is not populated with duplicated
service-description text.

Date slots accept explicit or deterministically parsed dates only. Invalid
prose is rejected with an inline correction prompt. An empty catalogue draft
date is treated as an unhydrated default and replaced with a concrete date
before the Review order readiness check.

Receipt writes refresh the PO fulfilment status, invoices derive supplier
identity from the referenced PO, and assistant latest-PO answers remain
requester-scoped and free of tool/source metadata. These are internal Neon
behaviours; external purchasing, payment and identity systems remain R2.

## Consequences

Failed full-intake submissions no longer create partial records, and reviewers
see the structured evidence that drove routing. The server boundary is now the
source of truth for stage selection, while simulation role switching remains
unchanged and is not an authorization mechanism. Neon live transaction tests
must be run with network access to the configured database.
