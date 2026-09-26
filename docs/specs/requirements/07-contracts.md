# FR-07: Contracts & CLM

**Version:** 1.0 · **Date:** 30 August 2026 · **Roles:** `procurement-manager`, `operations-lead`, `admin`

> **Current R1 status:** contract coverage, validity, capacity, risk linkage, and governed call-offs are internal Neon capabilities. CLM authoring, e-signature, and upstream contract writes remain R2; see the [current roadmap](../../roadmap/R1_BACKLOG_FIT_GAP.md).

---

## Purpose

Contract management covers the register, lifecycle statuses, renewals, expiry alerts, and linked spend. Clause library / redlining / e-signature are deferred (see §6).

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR07-01 | proc-manager | I can see all active, expiring, and expired contracts in one register | Must |
| FR07-02 | proc-manager | I see which contracts are in their renewal window — the Expiring status, the register, Renewals & Expiries and the dashboard widget; no notification is sent yet | Must |
| FR07-03 | proc-manager | I can see utilisation % against contract value for each contract | Should |
| FR07-04 | ops-lead | I can initiate a contract renewal request from the renewal screen | Should |

---

## Contract Lifecycle Statuses

`draft` → `active` → `expiring` → `expired` | `terminated` | `on-hold`

FR07-10 · **The status is read from the dates** (decided 2026-09-26). A contract recorded `active` (or `expiring`) is `active` until its renewal window opens, `expiring` while it ends within the window — the Decisioning threshold `contractExpiryBufferDays`, the same number the intake's contract check reads — and `expired` from the day after its end date, so it is in force through its last day. `draft`, `under-review`, `terminated` and an expiry recorded early stay as recorded. The contracts view computes it (`contracts_with_derived.status_live`), `lib/procurement/contract-status.ts` is the same rule in TypeScript, and stored rows are never rewritten; an administrator edits the recorded status and sees both where they differ.
FR07-11 · Every reader takes the live status: the register, Renewals & Expiries, the Expiring Contracts widget, the supplier profile, the governed checkout, the intake's contract match and the assistant; a supplier's active-contract count leaves out a contract past its end date.

---

## Contract Register

FR07-20 · Table columns: ID, title, supplier, value, status, start/end date, utilisation %, owner.
FR07-21 · Filters: status, supplier, department, category.
FR07-22 · Click → contract detail page with linked requests, POs, invoices.

---

## Renewals & Expiries

FR07-30 · `/contracts/renewals` shows 3 tabs: All, Expiring (within the renewal window), Expired — each the live status.
FR07-31 · KPI cards: Expiring within the window, Expired, Value up for renewal (€). No trend arrows: the ones shown were fixed numbers.
FR07-32 · "Start renewal" (Renewals & Expiries and contract detail) opens Door 1 with the renewal written as the demand (`renewalDemandHref`); the contract check recognises the expiring contract. There is no renewal category or side process (retired 2026-09-25).
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

### Contract coverage and demand matching (R1)

Each contract may have one or more effective-dated `contract_scope_versions`. A version stores
the service-family narrative, eligible categories, geography/business-unit coverage, call-off
requirements, completeness and provenance. `contract_scope_deliverables` and
`contract_scope_exclusions` hold normalized outcomes, aliases and excluded terms. Incomplete or
expired scope versions remain visible in the register but cannot produce a confident call-off.

`POST /api/contract-match` applies hard eligibility gates and explainable weighted scoring before
the server-side Groq → Gemini reranker may reorder eligible candidates. A requester needs a service
family, deliverable/outcome and one contextual discriminator; otherwise the pre-check asks up to
three targeted questions before routing to full intake. `/api/governed-checkout` repeats the match
against current Neon data and persists scope-version, score, reasons, algorithm version and input
fingerprint on the requisition. Client-side previews never authorize a call-off.

---

## Key Files

- `src/features/contracts/contract-register-page.tsx`
- `src/features/contracts/renewals-page.tsx`
- `src/lib/db/contracts.ts`
- `src/lib/procurement/contract-matching.ts` and `api/_domains/contract-match.ts` (served at `/api/contract-match`)
- `api/_domains/contract-scope.ts` (Coverage & Matching administration, served at `/api/contract-scope`)
