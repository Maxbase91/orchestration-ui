# Purchasing lifecycle

Purchasing screens represent the internal request-to-payment simulation. A
supplier submits an invoice, Operations reviews and matches it, Procurement
approves it, and Admin schedules or releases payment. These actions update the
application-owned Neon records only; upstream ERP and bank writes remain R2.

The UI hides actions from roles that do not own the current stage and keeps
`/purchasing/payments` as the read-only tracker of the persisted invoice state.
