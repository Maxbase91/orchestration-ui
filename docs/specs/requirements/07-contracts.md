# FR-07: Contracts & CLM

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `procurement-manager`, `operations-lead`, `admin`

> **Current R1 status:** contract coverage, validity, capacity, risk linkage, and governed call-offs are internal Neon capabilities. CLM authoring, e-signature, and upstream contract writes remain R2; see the [current roadmap](../../roadmap/R1_BACKLOG_FIT_GAP.md).

---

## Purpose

Contract management covers the register, lifecycle statuses, renewals, expiry alerts, and linked spend. Clause library / redlining / e-signature are deferred (see §6).

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR07-01 | proc-manager | I can see all active, expiring, and expired contracts in one register | Must |
| FR07-02 | proc-manager | I receive alerts when contracts are expiring within 90 / 30 days | Must |
| FR07-03 | proc-manager | I can see utilisation % against contract value for each contract | Should |
| FR07-04 | ops-lead | I can initiate a contract renewal request from the renewal screen | Should |

---

## Contract Lifecycle Statuses

`draft` → `active` → `expiring` → `expired` | `terminated` | `on-hold`

FR07-10 · Status `expiring` is set when `endDate < today + 90 days` (system computes, not admin-set).
FR07-11 · Renewals page uses `new Date()` as reference (not demo anchor) — updated in 0.3 fix.

---

## Contract Register

FR07-20 · Table columns: ID, title, supplier, value, status, start/end date, utilisation %, owner.
FR07-21 · Filters: status, supplier, department, category.
FR07-22 · Click → contract detail page with linked requests, POs, invoices.

---

## Renewals & Expiries

FR07-30 · `/contracts/renewals` shows 3 tabs: All, Expiring (<90d), Expired.
FR07-31 · KPI cards: Expiring <30d, Expiring <90d, Expired, Total Renewal Value (€).
FR07-32 · "Initiate Renewal" button creates a new `contract-renewal` category request.
FR07-33 · Total Renewal Value uses EUR (not GBP — F19 fix applied).

---

## Templates

FR07-40 · `/contracts/templates` shows a list of contract templates.
FR07-41 · Templates are for reference only in this phase; full authoring/clause library deferred.

---

## Data Model

```
contracts
  id, title, supplierId → suppliers, supplierName, value, currency
  startDate, endDate, renewalDate, status
  ownerId, ownerName, department, category
  utilisationPercentage, linkedRequestIds[]
```

---

## Key Files

- `src/features/contracts/contract-register-page.tsx`
- `src/features/contracts/renewals-page.tsx`
- `src/lib/db/contracts.ts`
