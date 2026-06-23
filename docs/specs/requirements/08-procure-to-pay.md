# FR-08: Procure-to-Pay (P2P)

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `procurement-manager`, `operations-lead`, `admin`

---

## Purpose

P2P covers the operational chain from PO issuance through goods receipt, invoice matching, and payment. POs and invoices are real Supabase records; three-way match now computes live.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR08-01 | ops-lead | When a request reaches the PO stage, I can create a PO pre-filled from the request | Must |
| FR08-02 | ops-lead | I can record goods receipt against a PO with line-item quantities | Must |
| FR08-03 | ops-lead | The three-way match computes whether an invoice matches the PO and GR | Must |
| FR08-04 | ops-lead | Match tolerance is configurable in Settings without a code change | Should |
| FR08-05 | ops-lead | I can approve an invoice for payment when it matches within tolerance | Must |

---

## Purchase Orders

FR08-10 · PO list (`/purchasing/orders`) shows all POs with status, supplier, value, delivery date.
FR08-11 · "Create PO" button in request detail action-buttons.tsx appears when `request.status === 'po'`.
FR08-12 · Create PO dialog pre-fills supplier, value, delivery date from the request; calls `useCreatePurchaseOrder()`.
FR08-13 · On success: navigates to `/purchasing/orders/{id}`.

**PO statuses:** `draft` → `submitted` → `acknowledged` → `received` | `partially-received` → `closed`

---

## Goods Receipt

FR08-20 · `/purchasing/receipt` lists POs in `submitted | acknowledged | partially-received` status.
FR08-21 · Selecting a PO opens `GoodsReceiptForm` with line items.
FR08-22 · On confirm: `createGoodsReceipt()` inserts to `goods_receipts` with `poId`, `receivedBy`, `lineItems[]`, `status = complete | partial`.
FR08-23 · `goods_receipts` table: id, po_id, request_id, received_by, received_at, notes, line_items (jsonb), status.

---

## Three-Way Match

FR08-30 · Match compares: PO amount vs GR amount vs Invoice amount.
FR08-31 · `computeAmountStatus(po, gr, invoice, toleranceFraction)`:
  - diff = 0 → `match`
  - diff/po < tolerance → `minor-variance` (with variance string)
  - diff/po ≥ tolerance → `mismatch`
  - gr = null → `mismatch (No GR)`
FR08-32 · `toleranceFraction = useSettingsStore().matchTolerancePct / 100` (default 2%).
FR08-33 · Auto-Approve enabled only when all fields = `match` AND `gr != null`.

---

## Invoice Queue

FR08-40 · `/purchasing/invoices` shows all invoices with match status and actions.
FR08-41 · AI-003 (Document Extractor) will pre-fill invoice fields from upload (future phase).
FR08-42 · Invoice statuses: `submitted` → `under-review` → `matched` | `approved` → `scheduled` → `paid`.

---

## Payment Tracker

FR08-50 · `/purchasing/payments` shows payment timeline: Match Date → Approved → Scheduled → Paid.
FR08-51 · Paid Date column populated when `paidDate` field is set on the invoice.

---

## Key Files

- `src/lib/db/goods-receipts.ts` + `src/lib/db/hooks/use-goods-receipts.ts`
- `src/features/purchasing/goods-receipt-page.tsx`
- `src/features/purchasing/three-way-match-page.tsx`
- `src/features/purchasing/invoice-queue-page.tsx`
- `src/stores/settings-store.ts` — `matchTolerancePct`
- `src/lib/db/purchase-orders.ts`, `src/lib/db/invoices.ts`
