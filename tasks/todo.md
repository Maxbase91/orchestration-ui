# Buying channels: only what Door 1 can realistically reach

Asked by the product owner (2026-09-25): keep only buying channels the intake
can actually reach; clean up Direct PO, P-card, and the side processes; Door 1
decides business-led vs procurement-led by threshold and category; WF-006 must
have Contracting.

Decisions taken (2026-09-25):
- Side processes WF-003 (supplier onboarding) and WF-004 (contract renewal)
  are **removed**. Onboarding stays the "Vendor Onboarding" stage inside a
  request when the supplier is new; a renewal comes in through Door 1 like any
  demand. The "Contract renewal" and "Supplier onboarding" categories go too
  (set inactive live — requests that carry them keep their history).
- Always procurement-led, whatever the value: **consulting and contingent
  labour** (plus the value rules: software over the budget-approval threshold,
  anything over the materiality threshold). Contingent labour reaches a call-off
  only when the contract check finds a framework.

## What exists today (live, 2026-09-25)
- Direct PO: one rule (RR-009), 3 live requests. P-card: thresholds only, no
  rule reaches it, 0 requests. WF-003/WF-004: 0 instances ever.
- Routing rules send Door 1 demands to channels that need a real match: RR-900
  (< €25k → catalogue), RR-002/RR-007 (→ catalogue), RR-004/RR-903 (contingent
  labour → call-off).
- Defect: intake derives the template by CATEGORY (≈ always WF-001) and submit
  prefers it over the channel's template.

## Commits
1. [x] fix: a request runs on the template that claims its channel — submit
       ignores the browser's template; category derivation removed.
2. [x] feat: WF-006 business-led gets Contracting (Legal, 10 days) — seed, live,
       tests, docs.
3. [x] refactor: routing decides only business-led vs procurement-led — drop
       rules that route to catalogue / call-off / direct-po / renewal /
       onboarding and the duplicate consulting catch-all; add contingent labour
       → procurement-led. Catalogue and call-off come from real matches only.
4. [ ] refactor: remove Direct PO and P-card — channel list, WF-005/WF-007,
       RR-009, P-card thresholds and eligibility, 3 live direct-po requests
       moved to business-led.
5. [ ] refactor: remove the side processes and the renewal / onboarding
       categories — WF-003/WF-004, side-process screen, classifier rules, form
       path; categories inactive live.
6. [ ] Mock: only the reachable channels; business-led Contracting no longer
       "proposed"; notes.

## Verification
tsc, lint, test:all, the offline browser suites, live backfills idempotent and
read back; the production interaction suite after deploy.
