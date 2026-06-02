# FR-09: Analytics & Reporting

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `procurement-manager`, `operations-lead`, `admin`

---

## Purpose

Analytics covers spend dashboards, compliance KPIs, pipeline cycle time, supplier performance, a drag-and-drop report builder, scheduled reports, and data exports.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR09-01 | proc-manager | I can see spend broken down by category, supplier, and department | Must |
| FR09-02 | proc-manager | I can see the average cycle time per stage and where requests are stuck | Must |
| FR09-03 | proc-manager | I can build a custom report by dragging data sources onto a canvas | Should |
| FR09-04 | proc-manager | I can export any report as CSV | Must |
| FR09-05 | admin | I can schedule a report to be delivered on a recurring basis | Should |

---

## Spend Overview

FR09-10 · `useRequests()` + `useContracts()` + `usePurchaseOrders()` aggregate spend by:
  - Category (pie chart)
  - Supplier (top-10 bar)
  - Department (stacked bar)
  - Month (line/bar trend)
FR09-11 · AI-004 (Spend Anomaly Detector) surfaces anomalies on the spend dashboard card.
FR09-12 · All spend figures use currency from `useSettingsStore().currency` (configurable).

---

## Dashboard KPIs

FR09-20 · **Compliance Rate**: % of completed requests with `referBackCount === 0` in trailing 6 months.
FR09-21 · **Avg Cycle Time**: mean days from `createdAt` to `updatedAt` for completed requests.
FR09-22 · **Monthly Summary**: submitted/approved/completed counts for the current calendar month.
FR09-23 · **Expiring Contracts**: contracts with `endDate ≤ today + 90 days`.
FR09-24 · All KPIs use `new Date()` as reference (production-ready; 0.3 fix removed demo anchor).

---

## Report Builder

FR09-30 · Drag data sources (Requests, Suppliers, Contracts, Spend, Compliance) onto canvas.
FR09-31 · Widget types: Bar, Line, Pie, Table, Scatter.
FR09-32 · "Export CSV" downloads all widget data as a `Blob` CSV (no extra dependency).
FR09-33 · Per-widget CSV export downloads that widget's data only.
FR09-34 · PDF/Excel export buttons disabled with "Coming soon" title until a PDF library is added.

---

## Exports Page

FR09-40 · `/analytics/exports` allows ad-hoc exports: select data type, date range, format (CSV now; Excel/PDF future).
FR09-41 · CSV export uses native `Blob + URL.createObjectURL` — no library dependency.
FR09-42 · Recent exports table shows historical exports with download links (CSV files only active).

---

## Key Files

- `src/features/analytics/spend-dashboard-page.tsx`
- `src/features/analytics/compliance-kpi-page.tsx`
- `src/features/analytics/pipeline-dashboard-page.tsx`
- `src/features/analytics/report-builder-page.tsx`
- `src/features/analytics/exports-page.tsx`
- `src/features/dashboard/use-live-kpis.ts`
