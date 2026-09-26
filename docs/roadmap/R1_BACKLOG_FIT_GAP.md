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
| Front door and requester UX | **Door 2, the Catalogue page**: a basket across suppliers placed as one order per supplier, approved on the basket total (ADR-0009); **the conversation page** (Door 1, the Intake Prototype, 2026-09-26): one transcript in three phases — What you need · How it is bought · What it needs — with **Your request** building beside it (where each value came from, inputs edited in place, "N of M known" counting what the route needs), ending on *Buying channel confirmed* only when submit would accept the request, and every question asked before any conclusion is shown; **the Channel page** — every stage of the channel's template with *Applies / If … / Skipped* and why, from the server's landing rule and the engine's own branch walk, what the requester does at each stage, the approvers submit will write, who sourcing will invite, the checks, and the workings with Export — for full requests and contract call-offs alike; the catalogue and the contracts checked first and the way to buy offered in its channel's own words (configured per channel on its workflow template; routing decides only business-led vs procurement-led, and the catalogue and a call-off come from a real item or contract), a catalogue item naming the words it matched on; **Home's two doors** — describe what you need (Door 1), or, for those who buy, the catalogue beside it (Door 2); every Home answer is an "Understood as" card first — a demand before intake opens, a catalogue hit with Order this into the Door 2 basket; policy and status questions on Home answered in place from the configuration (Decisioning thresholds, approval chains, the linked knowledge base; the Status Answers agent); a contract's renewal starts from the contract (Start renewal → Door 1, recognised by the contract check), with no separate renewal or supplier-onboarding process; describe/upload → confirm → route → what it needs → the Channel page → submit journey, specific commodity candidates, requester home, drafts, status, catalogue item detail | In-flight edit depth, attachment blob storage and richer guidance quality/fallback observability | External guided-buying/punchout | Role switching is simulation-only |
| Decisioning and governance | Classification, category codes (configured per category in Admin → Categories), catalogue/contract checks, risk/materiality, approval-to-source, handoff, and the **intake determination as a pure, benchmarked module** — deterministic (`now` injected), density-blind, and the single source of the compliance record both modes write; every threshold shows where code uses it and which configuration names it, and one with no reader is flagged | Hard PSL, reuse matching, policy governance and richer evidence; **no duplicate search exists** and the record says so rather than claiming one ran | External risk feeds and policy services | Authorization is not server-derived; **intake submit stores the determination the browser computed** rather than deciding again (ARCHITECTURE §10) |
| Internal procurement lifecycle | Request → PR → conditional internal PO, request lines, supplier/contract/risk/accounting links; atomic governed checkout with replay-safe idempotency | Recovery reporting for pre-existing partial aggregates and P2P exception depth | ERP/CLM/payment writes | No production identity boundary |
| Workflow and approvals | Templates, instances, stage history, approval entries, admin configuration, **atomic stage transitions** — the request update and both stage-history writes commit together, an owner change is recorded even when the stage does not move, and the SLA deadline is re-clocked from the node for the stage being entered (written on every change, including as NULL, so a request can no longer carry a stage it has left). The template is the **single** definition of a lifecycle: stages, order, owner role, SLA days, gate and branch conditions. Every request names the template that claims its channel; `sla_targets` keeps only its ticket rows and `routing_rules.match_count` is gone | Fallback execution, timers and parallelism | External orchestration systems | **A stage's exit is decided in the browser** — the stage action, an approval or an award writes the move through `/api/db` after the page has checked its gates. The board is view-only and the server's own endpoint makes only refer-back, reassign and cancel (2026-09-26, spec §5.3); Cancel is server-owned: a reason, approvals withdrawn, the workflow stopped |
| Suppliers, sourcing and contracts | Supplier directory/profile, onboarding gates, a named shortlist of candidates carried from intake into sourcing, sourcing events, responses, scoring and award; **a contract's status read from its end date** against the governed renewal window (2026-09-26) — every contract screen, the checkout, the contract match and the assistant agree, and none counts its own 90 days | Obligations, documents, Q&A, performance depth and award transactionality | Supplier network, e-signature, live screening | **Demonstration panels presented as real** — the supplier profile's summary, spend split, performance and documents; supplier messages; the portal's dashboard, documents, messages, bank details and onboarding list; the sourcing Q&A board and template gallery; contract obligations, documents and the committed figure (spec §7–§9). Supplier screening and the SRA are recorded only on evidence since 2026-09-26 (a screening's reference; a completed, in-date assessment), and onboarding completes only on a clear screening |
| Assistant and AI | One question route with the Home box (status, catalogue, policy, demand, then the model); grounded knowledge (figures linked to the live configuration; the same entries are the Help page, by topic), object lookup governed by the **Status Answers agent** (which attributes, whose records, per role — admin-configured), intake assistance, support handoff, conversation history, **confirmed internal actions that actually write** — delegate/out-of-office, reassignment, and four request types raised as SLA-bearing tickets, each audited in the same transaction | Masking, fallback observability; the two actions with no store (watchers, approver substitution) refuse explicitly rather than claiming success | Teams, vector RAG and external agent actions | Mock fallback must not be mistaken for live AI |
| Data and connectors | Private Neon API boundary, own-store connectors for core objects, administered cost-centre and delivery-location reference data enforced server-side, migration validation, **one query path** — the second PostgREST-shaped dialect is gone and the compatibility client returns one shape from both branches | Screening/taxonomy/form ports and remaining consumers | Live ERP/CLM/payment/risk connectors | No authenticated API principal |
| Analytics and reporting | Internal dashboards, KPIs, pipeline and cycle-time views, per-role default layouts covering purchasing/vendor work and persisted widget customisation | Scheduled reports, PDF/Excel exports, spend depth | External data warehouse/cube | **Not labelled:** the Report Builder, Scheduled Reports and Exports run on sample data (spec §11); the workflow heatmap is partly random and the bottlenecks escalation feed is sample content (spec §5.2) |
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
9. **Act on the functional-spec audit (2026-09-26).** The spec now marks each demonstration surface
   "— a demonstration" and each wrong behaviour "Known defect"; every one is either built for real,
   labelled in the product, or removed — the exit criterion below is not met while any is unlabelled.
   Defects first — Cancel, the unrun screening recorded by risk Approve and the form id reuse are
   fixed (2026-09-26), and so is the board's stage move (view-only; the endpoint makes only
   refer-back, reassign and cancel); still open: intake submit's browser-computed determination,
   the editable audit log, notifications with no recipient (list in `tasks/todo.md`).

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

- [ADR-0008 — one standardised requester UI](../adr/0008-one-standardised-requester-ui.md) (supersedes [ADR-0001 — dual-mode requester experience](../adr/0001-dual-mode-requester-experience.md))
- [ADR-0002 — governed catalogue and contract checkout](../adr/0002-governed-catalogue-checkout.md)
- [ADR-0003 — private Neon database](../adr/0003-private-neon-database-migration.md)

The older [`REQUIREMENTS_AND_FIT_GAP.md`](REQUIREMENTS_AND_FIT_GAP.md) remains the market-benchmark
baseline, but its implementation ratings are reconciled to this roadmap in the current update.
