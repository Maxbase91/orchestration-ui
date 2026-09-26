# Contract register and detail

The contract register and renewal controls are operated by Procurement,
Operations, and Admin roles. A stable `/contracts/:id` detail route is also
available to requesters so links from requests and expiring-contract alerts do
not fall back to Home. Requester access is read-only: coverage saves, renewal
actions, obligation changes, and purchase-order navigation remain restricted.

## Status comes from the dates

A contract's status on every screen here is the live one: read through
`contracts_with_derived`, a contract recorded active (or expiring) is **active**
until its renewal window opens, **expiring** while it ends within the window —
the Decisioning threshold `contractExpiryBufferDays` — and **expired** from the
day after its end date. Draft, under review, terminated and an expiry recorded
early stay as recorded. `lib/procurement/contract-status.ts` is the same rule in
TypeScript (the days-to-end figures, the renewal standing on the detail page),
and `test:contract-status` / `test:derived` hold the SQL and the TypeScript to
one answer. Stored rows are never rewritten: the Database admin edits the
recorded status and shows both where they differ.

The register, Renewals & Expiries, the Expiring Contracts widget and the
supplier profile used to apply their own 90 days (and 30/60 bands, and fixed
trend arrows); they now read the status and the governed window.
