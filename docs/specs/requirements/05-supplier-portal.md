# FR-05: Supplier Portal

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `supplier` (external)

---

## Purpose

The supplier portal is a self-service interface for external suppliers. It is completely isolated from the internal app — the `supplier` role is redirected to `/portal` on login and cannot reach any internal route.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR05-01 | supplier | I can see my dashboard showing open invoices, active contracts, and recent activity | Must |
| FR05-02 | supplier | I can submit an invoice and track its approval status | Must |
| FR05-03 | supplier | I can complete onboarding tasks and upload required documents | Must |
| FR05-04 | supplier | I can respond to sourcing events (RFx) I've been invited to | Should |
| FR05-05 | supplier | I can view and download my documents and certificates | Should |

---

## Portal Tabs (7)

| Tab | Path | Content |
|-----|------|---------|
| Dashboard | `/portal` | Open invoices count, active contracts, onboarding progress, recent messages |
| Profile | `/portal/profile` | Company details, contact info, certifications |
| Onboarding | `/portal/onboarding` | Onboarding checklist with milestone progress |
| Sourcing | `/portal/sourcing` | RFx events the supplier has been invited to; submit responses |
| Invoices | `/portal/invoices` | Invoice pipeline (submitted → under-review → approved → scheduled → paid); **Submit Invoice** dialog |
| Documents | `/portal/documents` | Document list with expiry dates; upload capability |
| Messages | `/portal/messages` | Internal ↔ external message thread |

---

## Submit Invoice (FR05-10 — implemented)

FR05-10 · Submit Invoice button opens a `Dialog` with fields: Invoice Number (text), Invoice Date (date), Due Date (date), Amount (EUR), PO Reference (optional).
FR05-11 · Validation: all required fields must be filled; Amount must be positive.
FR05-12 · On submit: `useCreateInvoice().mutateAsync()` inserts to `invoices` with `status = 'submitted'`, `supplierId = PORTAL_SUPPLIER_ID`.
FR05-13 · Invoice appears immediately in the status pipeline.

---

## Isolation Rules

FR05-20 · `SupplierPortalLayout` checks `currentRole === 'supplier'`; non-suppliers → redirect to `/`.
FR05-21 · The portal layout is separate from `AppLayout` — no internal navigation is rendered.
FR05-22 · `PORTAL_SUPPLIER_ID = 'SUP-001'` (hardcoded for demo; replaced with `auth.user.supplier_id` in production).

---

## Key Files

- `src/features/suppliers/portal/portal-*.tsx` (7 portal pages)
- `src/components/layout/supplier-portal-layout.tsx`
