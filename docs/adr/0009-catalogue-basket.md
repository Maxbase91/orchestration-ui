# ADR-0009 — A catalogue basket is one order per supplier, approved on its total

**Status:** Accepted · 2026-09-25 · extends [ADR-0002](0002-governed-catalogue-checkout.md)

## Context

The Intake Prototype's second door is a catalogue page with a basket that can
hold items from several suppliers. An order in this platform — request,
purchase requisition, internal purchase order — has exactly one supplier and one
contract (ADR-0002), and the governed checkout refuses lines that mix them.

Two ways to reconcile that were on the table: a basket limited to one supplier,
or a basket split into one order per supplier. Splitting matches the prototype,
but it opens the classic gap: catalogue orders up to the auto-approval threshold
(€1,000 by default) go straight to a PO, so a €1,500 basket split into €800 and
€700 would pass as two automatic orders. Splitting to stay under a threshold is
exactly what the threshold exists to stop.

## Decision

- A basket is placed as **one order per supplier and contract**, each a normal
  governed checkout aggregate (request → requisition → lines → PO when allowed,
  workflow instance, stage history, approvals).
- **Approval is judged on the basket total.** `GovernedCheckoutInput` carries
  `approvalBasisValue`; the approval decision and the approval chain's value band
  use `max(order value, basket total)`. A lone order is judged on its own value,
  as before.
- **The server computes the total**, from the stored prices of every line in the
  basket (`api/governed-checkout.ts`, basket mode). The browser's figure is
  advisory, like the rest of its decision; a client claiming a smaller total
  changes nothing.
- **All orders or none**: the orders are written in one transaction. A retry of a
  placed basket returns the same orders (per-order idempotency keys derived from
  the basket); a basket only some of whose orders exist is refused
  (`basket_partially_placed`) rather than completed in part.
- No new serverless function: basket mode is a payload shape of the existing
  checkout endpoint (the Hobby plan caps functions at 12).

## Consequences

- A requester can fill one basket across catalogues; each supplier receives its
  own PO, and approval behaves as if the basket were one order.
- A basket's orders are separate requests afterwards — approved, received and
  invoiced on their own — which is how the supplier sees them too.
- The per-order preparation (`prepareOrder`) builds its writes without running
  them, so the single-order and basket paths share every read and check.
- Pinned by `test:catalogue-basket`: the pure grouping and the anti-splitting
  rule, and against the live store a basket straddling the threshold, a
  client-supplied total being ignored, replay, partial refusal and key reuse.
