# Purchasing lifecycle

Purchasing screens represent the internal request-to-payment simulation. A
supplier submits an invoice, Operations reviews and matches it, Procurement
approves it, and Admin schedules or releases payment. These actions update the
application-owned Neon records only; upstream ERP and bank writes remain R2.

The UI hides actions from roles that do not own the current stage and keeps
`/purchasing/payments` as the read-only tracker of the persisted invoice state.

Goods-receipt writes refresh the linked PO's partial/complete receipt status
and invalidate the purchase-order queue. Supplier invoice submission resolves
the supplier from the referenced PO rather than from the active simulator
persona, so downstream matching and payment tracking retain the correct
identity after a reload.
