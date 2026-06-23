# WS-F — Staged-Intake Funnel (FD-E3-10)

## Goal
Rework request-creation intake into the backlog's staged funnel: two entry points
(free text / browse catalogue) and progressive, stage-gated derivation —
catalogue → (enrich) → contract → full SD. No premature catalogue/contract assertions.

## Tasks
- [x] 1. Rewrite step-pre-check.tsx as a sequential funnel (stage: catalogue → contract).
      Contracts must NOT render until catalogue is ruled out AND enrichment input exists.
- [x] 2. Wire onEnrich in new-request-page.tsx so enrichment text carries forward.
- [x] 3. Make step-category.tsx free-text-primary; tile grid behind a disclosure (manual override fallback).
- [x] 4. Update wizard UI smoke to drive the new staged flow + assert no premature contract.
- [x] 5. Verify: tsc, lint touched, test:ui, regression suites.
- [x] 6. Docs: flip FD-E3-10/FD-E3-02/FD-E5-01/02 statuses, WS-F, README, TEST_PLAYBOOK.
- [x] 7. Commit + push.

## Open decisions (defaults chosen)
- Thresholds: reuse existing match thresholds (score>0.3); sim-panel config deferred to FD-E1.
- Catalogue-as-entry: jumps to catalogue early-exit (pure order).
- Manual category: kept as available fallback behind a disclosure (FD-E4-03).
