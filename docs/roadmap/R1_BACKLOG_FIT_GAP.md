# Release 1 — Current Capability Roadmap

**Status:** living roadmap and fit/gap assessment
**Last reviewed:** 30 August 2026
**Evidence index:** [`R1_IMPLEMENTATION_EVIDENCE.md`](R1_IMPLEMENTATION_EVIDENCE.md)
**Story detail:** [`R1_STORY_FIT_GAP.md`](R1_STORY_FIT_GAP.md) — the per-story fit/gap and the
`POL-xx` policy defaults this summary replaced, kept because 111 references across the repo cite
those ids

## R1 definition

R1 is an internally operated procurement-orchestration platform backed by private Neon PostgreSQL.
It owns the request, purchase requisition, internal purchase order, workflow, sourcing, supplier,
contract, risk, catalogue, ticket, conversation and audit records.

R1 includes internal writes and lifecycle transitions. It does **not** write to external ERP, CLM,
payment, supplier-network or risk-provider systems. External integrations are R2. The current role
switcher is intentionally retained as a simulation and UAT mechanism; it is not authentication or
production authorization. Authentication hardening is deferred and is not part of this roadmap update.

The platform's operating model is:

> describe → classify → check → recommend → route → create internal records → track and govern

## Status model

- **Built:** implemented internally and covered by code/schema plus repeatable tests or live evidence.
- **Partial:** a working surface exists, but important depth, persistence, reliability, or governance is incomplete.
- **Deferred/R2:** intentionally outside the current internal R1 boundary.
- **Not production-ready:** prototype controls or security assumptions acceptable for simulation but not real external users.

> The story-level breakdown of these capabilities — epics, features, user
> stories with acceptance criteria, and the decision rules behind each — is
> [PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md). This document tracks *position*;
> that one is what you hand to a delivery team.

## Capability matrix

| Area | Built | Partial | Deferred/R2 | Not production-ready |
|---|---|---|---|---|
| Front door and requester UX | **One four-step intake engine** (Describe → How you'll buy → Details → Review & submit) driving both densities from a single step config, with every question asked before any conclusion is shown; all three buying routes on one screen in requester language with evidence behind a disclosure; a home demand routed straight into intake and a catalogue hit named with a link to its checkout; describe/upload → clarify → route → details → submit journey, specific commodity candidates, requester home, drafts, status, catalogue item detail | In-flight edit depth, attachment blob storage and richer guidance quality/fallback observability | External guided-buying/punchout | Role switching is simulation-only |
| Decisioning and governance | Classification, category codes, catalogue/contract checks, risk/materiality, approval-to-source, handoff, and the **intake determination as a pure, benchmarked module** — deterministic (`now` injected), density-blind, and the single source of the compliance record both modes write | Hard PSL, reuse matching, policy governance and richer evidence; **no duplicate search exists** and the record says so rather than claiming one ran | External risk feeds and policy services | Authorization is not server-derived |
| Internal procurement lifecycle | Request → PR → conditional internal PO, request lines, supplier/contract/risk/accounting links; atomic governed checkout with replay-safe idempotency | Recovery reporting for pre-existing partial aggregates and P2P exception depth | ERP/CLM/payment writes | No production identity boundary |
| Workflow and approvals | Templates, instances, stage history, approval entries, admin configuration | Fallback execution, timers, parallelism and atomic transitions | External orchestration systems | Some controls remain prototype-grade |
| Suppliers, sourcing and contracts | Supplier directory/profile, onboarding gates, sourcing events, responses, scoring and award | Obligations, documents, Q&A, performance depth and award transactionality | Supplier network, e-signature, live screening | Static/demo records in some panels |
| Assistant and AI | Grounded knowledge, object lookup, intake assistance, support handoff, conversation history | Server-path consistency, masking, fallback observability, agent execution | Teams, vector RAG and external agent actions | Mock fallback must not be mistaken for live AI |
| Data and connectors | Private Neon API boundary, own-store connectors for core objects, migration validation | Screening/taxonomy/form ports and remaining consumers | Live ERP/CLM/payment/risk connectors | No authenticated API principal |
| Analytics and reporting | Internal dashboards, KPIs, pipeline and cycle-time views, per-role default layouts covering purchasing/vendor work and persisted widget customisation | Scheduled reports, PDF/Excel exports, spend depth | External data warehouse/cube | Simulated heatmaps and sample panels remain labelled |
| Platform and NFRs | Responsive shell, keyboard-accessible mode switch, role-aware deep links, route guards, audit records | Mobile/a11y depth, locale/currency, observability and retention | SSO/SCIM, multi-tenant enterprise controls | Prototype authorization and open-policy assumptions |

Every Built row is expanded in the [implementation evidence index](R1_IMPLEMENTATION_EVIDENCE.md).

## Ordered backlog

### R1 hardening

1. ~~Make request → PR → line → PO submission atomic and replay-safe, including failure recovery.~~ **Complete in this tranche:** `/api/governed-checkout` recomputes policy server-side and commits the internal aggregate transactionally; replay and conflict behavior is covered by the evidence index.
2. ~~Make dashboard and request-detail deep links role-aware and prevent unauthorized visible links from falling back to Home.~~ **Complete:** supplier and contract details are requester-readable; mutations remain role-gated and navigation is covered by static and deployed browser checks.
3. Make workflow transitions, sourcing award write-back and approval completion transactional and server-owned.
4. Remove remaining direct/compatibility-only consumers from the Neon path and standardise domain repositories.
5. Add missing own-store connector ports for screening, taxonomy and form submissions.
6. Finish contract capacity/risk evidence, supplier documents, sourcing Q&A and P2P exception handling.
7. Make assistant fallback, masking, tool authorization and operational failures visible and measurable.
8. Complete responsive accessibility, locale/currency handling, error boundaries and production observability.

### R2 integrations and enterprise hardening

1. ERP/CLM/payment/supplier-network and external catalogue connectors.
2. External supplier-risk and sanctions/financial/ESG feeds.
3. Punchout, upstream PO/invoice/payment execution and e-signature.
4. Authentication, server-derived roles, SSO/SCIM, tenant isolation and formal compliance controls.
5. Data warehouse/spend cube, advanced reporting and enterprise retention/residency.

## R1 exit criteria

R1 is internally complete when:

- all Built capabilities in the evidence index pass their listed tests;
- Neon is the active database and browser bundles contain no database credentials;
- internal request/PR/PO/workflow/sourcing writes are atomic and idempotent;
- every route and role-switch simulation path has a documented browser smoke result;
- partial/demo surfaces are visibly labelled and do not imply upstream execution;
- external integrations and authentication are explicitly deferred rather than represented as silently working.

## Verification

The release test inventory is maintained in [`docs/testing/TEST_PLAYBOOK.md`](../testing/TEST_PLAYBOOK.md).
The current suite includes build/lint gates, integration scripts, UI smoke, full-app route sweeps,
Neon validation, catalogue/checkout, sourcing, workflow, assistant, responsive and keyboard checks.

## Related decisions

- [ADR-0001 — dual-mode requester experience](../adr/0001-dual-mode-requester-experience.md)
- [ADR-0002 — governed catalogue and contract checkout](../adr/0002-governed-catalogue-checkout.md)
- [ADR-0003 — private Neon database](../adr/0003-private-neon-database-migration.md)

The older [`REQUIREMENTS_AND_FIT_GAP.md`](REQUIREMENTS_AND_FIT_GAP.md) remains the market-benchmark
baseline, but its implementation ratings are reconciled to this roadmap in the current update.
