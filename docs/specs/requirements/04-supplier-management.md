# FR-04: Supplier Management

**Version:** 1.0 · **Date:** 30 August 2026 · **Roles:** `procurement-manager`, `vendor-manager`, `operations-lead`, `admin`

> **Current R1 status:** supplier, screening, onboarding, risk, and performance records are application-owned Neon data. External screening feeds remain R2; see the [current roadmap](../../roadmap/R1_BACKLOG_FIT_GAP.md).

---

## Purpose

Supplier management covers the full supplier lifecycle: directory, 360 profile, onboarding pipeline, risk & compliance, and performance tracking.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR04-01 | vendor-manager | I can search and filter the supplier directory by risk rating, SRA status, category, country | Must |
| FR04-02 | vendor-manager | I can view a 360 profile of any supplier with 7 information tabs | Must |
| FR04-03 | vendor-manager | I can see which suppliers need SRA renewal in the next 90 days | Must |
| FR04-04 | proc-manager | I can manage the onboarding pipeline and see where each supplier is in the process | Should |
| FR04-05 | admin | I can configure risk band thresholds for supplier screening | Should |

---

## Supplier 360 Profile — 7 Tabs

| Tab | Content |
|-----|---------|
| Overview | Key metrics (risk rating, SRA status, spend 12m, active contracts, performance score), AI summary |
| Contracts | Active/expiring/expired contracts linked to this supplier |
| Spend | 12-month spend trend, category breakdown, AI spend insight |
| Risk & Compliance | SRA details, risk flags, certifications, screening status |
| Performance | Scorecard (quality, delivery, compliance, responsiveness, value) |
| Documents | Document list with expiry tracking |
| Messages | Internal message thread |

FR04-10 · AI summary on the Overview tab uses `getAISummary('supplier', id)` — falls back to detail cache if list cache not loaded.
FR04-11 · Confidence badges normalise 0–1 fractions → 0–100% via `normalizeConfidence()`.

---

## Risk & Compliance

FR04-20 · SRA status: `valid` | `expiring` | `expired` | `not-assessed`.
FR04-21 · Screening status: `clear` | `flagged` | `pending`.
FR04-22 · Risk rating: `low` | `medium` | `high` | `critical` — drives approval chain selection and compliance checks.
FR04-23 · The Risk & Compliance page (`/suppliers/risk`) aggregates all suppliers requiring attention.
FR04-24 · **Screening is recorded, never decided** (2026-09-26). On the supplier's Risk & Compliance tab a vendor manager or administrator records a screening result — clear or flagged — with the **reference** of the screening that was performed and the day it was performed (not in the future); the platform runs no screening itself. The reference and date are stored on the supplier and shown beside the status, and the record is audited.
FR04-25 · **The SRA stands on an assessment.** It is set by linking a completed, in-date risk assessment of this supplier from the register; the SRA takes the assessment's expiry and id, and the link is audited. Neither record touches onboarding. These replaced "Approve risk" and "Refer back", which wrote the SRA valid and screening clear or flagged with nothing behind them (`lib/procurement/supplier-evidence.ts`, `test:supplier-evidence`, `test:supplier-evidence-ui`).

---

## Onboarding Pipeline

FR04-30 · `/suppliers/onboarding` shows a pipeline of suppliers in onboarding with milestone progress.
FR04-31 · Milestones: Initial Review → Due Diligence → SRA Assessment → Approval → Active.
FR04-32 · Supplier completes their side via the portal (`/portal/onboarding`); saving starts onboarding and never takes back a completed one.
FR04-33 · **Completing onboarding** (procurement manager, administrator) needs a clear screening on record, and the completion note — what was checked — is kept in the audit log.

---

## Data Model

```
suppliers
  id, name, country, riskRating, tier, duns, address
  primaryContact { name, email, phone }
  sraStatus, sraExpiryDate, sraAssessmentId, screeningStatus, screeningReference, screeningDate
  activeContracts, totalSpend12m
  performanceScore, onboardingStatus
  categories[], spendHistory[]
```

---

## Key Files

- `src/features/suppliers/supplier-directory-page.tsx`
- `src/features/suppliers/supplier-profile-page.tsx`
- `src/features/suppliers/onboarding-pipeline-page.tsx`
- `src/features/suppliers/risk-compliance-page.tsx`
- `src/lib/db/suppliers.ts`
