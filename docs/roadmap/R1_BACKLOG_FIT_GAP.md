# R1 Backlog — Fit/Gap Assessment & Build Roadmap

**Source backlog:** `R1_Backlog_Deepened_1.xlsx` v1.2 (22 Jun 2026) — 121 stories, 17 epics, 4 clusters.
**Assessed against:** `orchestration-ui` (this repo) — React 19 SPA + Supabase, AI via Groq/Gemini.
**Positioning (confirmed):** this repo is the **foundation for R1**, not a throwaway demo.
**Date:** 23 Jun 2026.

> Status legend: 🟢 **Built** (working analog exists) · 🟡 **Partial/mock** (some real logic, key gaps) · 🔴 **Gap** (not present).

---

## 1. What R1 locks (from the backlog Read-me)

- Front door **classifies, recommends, routes** — does **not** execute (no writes; user acts via deep-links).
- **Staged intake**: light capture → try catalogue & contract first; full **service description** only when nothing fits.
- Service description is the **master capture** (8 best-practice elements); *"how it qualifies"* drives the **materiality / regulatory flag**.
- Contract matching runs **twice** (light at intake; rich vs full SD, surfacing frameworks/MSAs).
- Outcomes are **non-binary**: risk (reuse/amend/change/new) · contract type (MSA/SOW/amend/change/renew) · sourcing (new/renewal/benchmarking) · PR (refer/change).
- **Determination screen is the R1 endpoint** — every step with system, status, link; structured & exportable.
- Mini-IRQ in the front door; full IRQ stays in Coupa. Risk reuse needs service-owner confirm (FD-E7-05).

## 2. Guiding principle — own the data, defer the connections

**No live system connections exist for R1.** The build holds the equivalent data in **our own databases**
rather than calling Ariba/Coupa/Sirion/ServiceNow/SAP/GCP live — exactly what the backlog's
**FD-E2A "Reference Data Shadow & Fast Store"** anticipates; we treat it as the R1 system of record.

- Model each named source object's **real data shape** as our own tables, populated with representative data.
- Read everything through a **connector interface (read ports)**: R1 impl reads our own DB; a later impl
  calls the real system. Consumers (front-door checks, risk reads, chatbot lookups) are unchanged when
  live integrations swap in.
- The integration spikes **OI-26 (Sirion) / OI-27 (Coupa) / OI-09 (GCP tables)** become *"confirm the real
  data shape so our tables match"* — they de-risk the future swap, not the R1 build.

---

## 3. Coverage summary

| Cluster | Built 🟢 | Partial 🟡 | Gap 🔴 |
|---|---|---|---|
| **Foundation & Platform** | Design system (FD-E15) | Config & reference (FD-E1) | Shadow/fast-store (FD-E2A), MCP connectors (FD-E2B) |
| **Front Door** | Intake & landing (FD-E3) | Classify (FD-E4), Checks (FD-E5), Supplier (FD-E6), Channel (FD-E8), Handoff (FD-E9) | Risk & mini-IRQ (FD-E7) |
| **Chatbot** | — | NL query (CB-E10), Policy Q&A (CB-E11), Actions (CB-E12), Support (CB-E13), Experience (CB-E14) | — |
| **Governance & AI** | — | — | Eval/guardrails/model-selection (GOV stories) |

**Read:** ~40–50% of Front-Door *flow/screen* stories have a working analog; **<15%** of Data-&-Integration,
regulated-decisioning (FD-E7 / FD-E8 materiality), and Governance stories. The journey *shell* is built;
the regulated *decisioning + integrations* core is the gap.

---

## 4. Story-level fit/gap

### Cluster: Foundation & Platform

#### FD-E1 — Configuration & Reference-Data Framework — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| FD-E1-01 | Routing & threshold rule engine | 🟡 | `evaluate-routing-rules.ts` real; **risk- and materiality-aware** (supplier risk tier + `material` flow into routing) |
| FD-E1-02 | Approval-chain & threshold-band config | 🟡 | Editor + `approval_chains` table exist (earlier "missing table" note was stale); re-verify saves end-to-end |
| FD-E1-03 | Taxonomy & category reference management | 🟡 | **Canonical taxonomy seeded & live** in the `procurement_categories` store (wizard reads it, admin edits it) + **configurable icons**. Pure-data/icons split keeps the server seed clean. Org-specific code scheme still pending |
| FD-E1-04 | PSL & DTPS rule management | 🔴 | Not present |
| FD-E1-05 | Catalogue source & link-out config | 🟡 | Catalogue seed only; no source-type/link-out config |
| FD-E1-06 | Risk-reuse & contract-reuse criteria config | 🔴 | Only a `reusable` boolean on seed rows |
| FD-E1-07 | KB content management w/o change request | 🟢 | `kb-admin-page.tsx` CRUD to Supabase |
| FD-E1-08 | Config test & simulation panel | 🟢 | Routing-rules 3-panel tester exists; extend to new inputs |
| FD-E1-ARC0/3/5 | Architecture decisions / ring-fencing / scale | 🔴 | Not formalised |
| FD-E1-GOV3 | KB governance & sign-off | 🟡 | KB editable; no sign-off workflow |
| FD-E1-WF0 | Config service skeleton & rule schema | 🟡 | Routing schema exists; reference-data schema gaps |

#### FD-E2A — Reference Data Shadow & Fast Store (GCP) — 🔴 Gap
All stories (FD-E2A-01..05, ARC2): no GCP/BigQuery shadow; data is Supabase seed. **R1 re-scope:** build
these as the **own-DB shadow / fast store** (system of record) per §2.

#### FD-E2B — Real-Time Source Connectors (MCP) — 🟡 Partial (foundation built)
FD-E2B-01 (Ariba), FD-E2B-03 (ServiceNow), ARC1 (MCP pattern): mock status records only. **R1 re-scope:**
express as **own-store read ports** behind the connector interface; live/MCP is a future swap.
**Done (WS-0 + WS-B breadth):** the standardised connector layer is in place —
`src/lib/integrations/{ports,registry}.ts`, `own-store/factory.ts`, `useSourceObject`/`useSourceList`
hooks, the documented live-swap seam (`src/lib/integrations/README.md`), and own-store connectors for
**seven objects** (supplier, contract, purchase-request, purchase-order, invoice, risk-assessment,
catalogue-item); covered by `npm run test:connectors` (22 checks incl. a drift guard).
**Consumers routed:** the front-door catalogue + contract checks (`step-pre-check.tsx`), the
supplier/contract reads in `step-compliance.tsx` (`useSourceData`), and the **assistant lookups**
(`src/lib/assistant/capabilities/lookup.ts` now reads suppliers/requests/contracts/POs/invoices/risk
through `requireConnector(...)` — so the chatbot and front door share one governed source).
**Remaining:** connectors for objects without an own-store read module yet (support-ticket, payment,
risk-screening, category-taxonomy, form-submission); routing **risk reuse-matching** through the ports
(needs validity-window query support — WS-C) and the **server-side** assistant path (`api/chat.ts`
needs a server connector variant — WS-E).

#### FD-E15 — Design System & User Journeys — 🟢 Built
FD-E15-01 component library 🟢; FD-E15-02 journeys 🟡 (confirm from contextual inquiry, OI-10); ARC7 env/rollback 🟡.

#### FD-E16 — Sourcing/Award/Contract handoff (R2 stub) — out of R1 scope.

### Cluster: Front Door

#### FD-E3 — Front Door, Intake & Landing — 🟢 Built (strongest area)
| Story | Summary | State | Note |
|---|---|---|---|
| FD-E3-01 | Role-based landing page | 🟢 | 5 role dashboards |
| FD-E3-02 | Light intake | 🟢 | **Free text is the only commodity entry — there is no category selection.** Commodity categories (Goods/Services/…) are derived metadata, not a user choice; the fulfilment path (catalogue / contract / full request) is derived by the funnel. The catalogue is the one explicit alternative entry (FD-E3-10) |
| FD-E3-03 | Full service description + quality gates | 🟡 | **Unified, auto-composed capture** — the chat builds one service description (request key facts + SOW elements in one panel, no separate Summary/SOW tabs and **no manual "Generate SOW" button**); the conversation asks until all components are captured, then the document is **composed automatically** (quality score shown). Inline-editable; graceful offline. "how it qualifies" not yet driving materiality |
| FD-E3-04 | Draft save & resume | 🟢 | Saves draft to Supabase |
| FD-E3-05 | Edit in-flight demand | 🟡 | Partial |
| FD-E3-06 | Demand validation — permissibility/prohibited | 🟡 | Some policy checks hardcoded |
| FD-E3-07 | Status tracking | 🟢 | Stage history tracked |
| FD-E3-08 | Notifications & actions-required | 🟢 | Notification feed |
| FD-E3-09 | Show existing info, structured & exportable | 🟡 | Feeds the determination endpoint; export to confirm |
| FD-E3-BFF0/1/3/7, ARC4 | BFF + audit | 🟡 | APIs exist; audit/observability partial |

#### FD-E4 — Classify & Translate to GP Taxonomy — 🟡 Partial/mock
| Story | Summary | State | Note |
|---|---|---|---|
| FD-E4-01 | AI classification + catalogue/contract sufficiency | 🟡 | Real LLM (Groq/Gemini); now validates against the **configured taxonomy** (not a separate hardcoded list). The deterministic fallback classifier is centralised in `lib/procurement/classify.ts` (single source of truth, benchmarked) |
| FD-E4-02 | Category-code assignment & taxonomy translation | 🟡 | `lib/procurement/category-code.ts` — keyword → standardised code, **category-aware** with **per-category default codes** so every demand resolves; centralises the old commodity map. Organisation-specific code scheme pending |
| FD-E4-03 | Low-confidence handling & manual override | 🟢 | The AI classification is shown with extracted details before it's accepted; if it's wrong the user **re-describes** ("Try again") rather than picking from a commodity-category grid (which has been removed — categories are derived, not chosen) |
| FD-E4-GOV0 | AI governance & **model selection** | 🔴 | No governance; runs Groq/Gemini (recommend Claude) |
| FD-E4-GOV1 | Classification eval harness & baseline | 🟡 | `npm run test:classification-eval` — labelled benchmark over the deterministic classifier with a per-category breakdown and an **accuracy-baseline gate (≥85%)** so rule changes can't silently regress (currently 95.8%). LLM-tier eval still needs the governed endpoint |
| FD-E4-GOV6/7, AGT5/7 | Quality monitoring, model change mgmt, tuning, observability | 🔴 | Not present |
| FD-E4-BFF2 | Classification aggregation API | 🟡 | `/api/ai.ts` exists |

#### FD-E5 — Demand Checks (Catalogue & Contract) — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| FD-E5-01 | Catalogue match — early exit to punchout | 🟢 | Match + early-exit read via the connector ports (`useSourceData`); now the **first gated stage** of the staged funnel (FD-E3-10), not an eager parallel check. Punchout mocked |
| FD-E5-02 | Transactable contract — early exit to raise PR | 🟢 | Score-based match + early-exit via the connector ports; now **stage 2 of the funnel — reached only after catalogue is ruled out and the user enriches**, so no contract is asserted prematurely (FD-E3-10) |
| FD-E5-03 | PSL enforcement at check | 🟡 | **Preferred-supplier (PSL) soft check + boost** centralised in `lib/procurement/supplier-preference.ts` (explicit `preferred` flag seam, else heuristic); surfaced in the determination + recommender. Hard PSL reference list pending |
| FD-E5-04 | Configurable intake-form engine (ASP/partial) | 🟡 | Partial |
| FD-E5-05 | Catalogue matching rules & info to collect | 🟡 | Heuristic; thresholds (OI-20) not configurable |
| FD-E5-06 | Contract matching rules & info to collect | 🟡 | Heuristic; thresholds (OI-21) not configurable |
| FD-E5-07 | **Second** contract check vs full SD + framework/MSA | 🟡 | `lib/procurement/second-contract-check.ts` — classifies the supplier's contracts as **transactable / framework (host a SOW) / expiring** and recommends transact/author-SOW/renew/new; "Contract coverage" panel on the determination. `isFramework` flag is the live-data seam |

#### FD-E3-10 — Staged-Intake Funnel (entry-point + progressive-disclosure redesign) — 🟢 Built

> **Why this is a distinct requirement.** The checks of FD-E5-01/02 and the determination steps all
> work, but the *intake shell* in front of them contradicted the R1 model (line 15: "light capture →
> try catalogue & contract first; full service description only when nothing fits"). The old wizard
> presented **eight category tiles as parallel entry points that all converged on the same path**, and
> a **catalogue + contract pre-check that fired eagerly on category selection** — surfacing a contract
> candidate before the user had described what they need. This block reframed intake as **one
> progressive funnel with two real entry points and stage-gated derivation**.
>
> **Built (WS-F).** `step-category.tsx` now leads with free text and has **no commodity-category
> selection at all** — Goods/Services/… are derived metadata, not a choice (the path is catalogue /
> contract / full request, decided by the funnel), with the catalogue as the one explicit alternative
> entry. `step-pre-check.tsx` is now a **sequential funnel** (`stage: 'catalogue' → 'contract'`):
> stage 1 checks the catalogue only; when nothing fits it asks for a short enrichment before stage 2
> ever computes — **the contract check is gated and never rendered until catalogue is ruled out and
> enrichment exists** (verified by the UI smoke). Enrichment carries forward into the request. The
> full SD is reached only when neither early exit fires.

**Two entry points only** (replacing the tile grid):
1. **Free-text intake** — the default. The user describes the need in natural language; the system
   derives category/commodity code (FD-E4) rather than asking the user to pre-classify. There is
   **no commodity-category selection at all** — Goods/Services/… are derived metadata, not a choice;
   to correct a misread the user re-describes ("Try again"), there is no category grid (FD-E4-03).
2. **Browse catalogue directly** — for users who already know they want a catalogue item; jumps
   straight to the punchout/catalogue-order early exit.

**Progressive, stage-gated derivation** (each stage runs *only* when the prior one fails to resolve,
and only once it has enough signal):

| Story | Stage | Behaviour | Exit |
|---|---|---|---|
| FD-E3-10a | 1 · Capture | User types the demand in free text. | — |
| FD-E3-10b | 2 · Catalogue derivation | System attempts a catalogue match on the captured text. Shown **only** when confidence clears the threshold (OI-20). | Catalogue match → **catalogue order** (early exit, lightest path). |
| FD-E3-10c | 3 · Enrich-then-contract | No catalogue → prompt for *more* detail, then attempt a **transactable-contract** match (FD-E5-02). Not shown until step 3's added input exists. | Transactable contract → **transact / raise PR** (early exit). |
| FD-E3-10d | 4 · Full service description | No contract → user completes the full SD (FD-E3-03), the master capture. | — |
| FD-E3-10e | 5 · Derive + final questions | System derives every downstream element from the SD (category-code, materiality, risk cascade, channel, contract/sourcing type) and asks **only the residual questions** that criteria demand (e.g. mini-IRQ delta when risk is unclear, "how it qualifies" when materiality is borderline). | → Determination screen (the R1 endpoint). |

**Defect to fix as part of this:** the step-2 pre-check (`step-pre-check.tsx`) must not display a
contract (or catalogue) result on a fresh request before stage gating is satisfied; "no premature
assertions" is an explicit acceptance criterion.

**Acceptance criteria.** (a) ✅ Free text is the only commodity entry — there is **no category grid**;
the fulfilment path is derived, not chosen, and the catalogue is the one explicit alternative entry.
(b) ✅ Catalogue is the first derivation and only lists matches above
the score threshold. (c) ✅ The contract stage is never reached or rendered until catalogue is ruled
out *and* enrichment input exists (asserted by the smoke). (d) ✅ Full SD appears only when neither
early exit fires. (e) ✅ Stage 5 asks **criteria-triggered residual questions** — `residual-questions.ts`
surfaces a delta question only when the derived signals leave it open and it would change the
determination (privileged access for IT/services/sensitive data; critical-service for material spend
/ elevated supplier risk / high sensitivity); a low-value, low-sensitivity demand is asked nothing.
(f) ✅ Each stage — and each residual question ("Asked because…") — shows why it's being asked.

**Maps to backlog:** FD-E3-02 (light intake — entry redesign), FD-E3-03 (master SD as stage 4),
FD-E4-01/03 (derive category, low-conf override), FD-E5-01/02/05/06 (gated early exits + thresholds
OI-20/21), FD-E5-07 (second contract check already lives in stage 5), FD-E7-03 / FD-E8-10
(criteria-triggered residual questions in stage 5).

**Open design decisions** (resolve before build):
- Stage-2/3 thresholds: reuse OI-20/21 defaults, or expose in the FD-E1 simulation panel first?
- Catalogue-as-entry: does "browse catalogue" bypass the funnel entirely (pure order, no
  determination), or still produce a lightweight determination record for audit?
- Manual category override: keep as an always-available "not what I meant" affordance, or only
  surface it when classification confidence is low?

#### FD-E6 — Supplier Identification & Selection — 🟡 Partial/mock
FD-E6-01 permissible supplier 🟡 (PSL soft-preference now in checks) · FD-E6-02 DTPS & supplier-count 🟡 (**competitive-sourcing/DTPS check** in `supplier-preference.ts` — threshold + exemptions for preferred route, exempt category, single-source justification) · FD-E6-03 screening display 🟡 (status shown, no real screening).

#### FD-E7 — Risk & Mini-IRQ Pre-Assessment — 🟡 Partial (core decisioning now modelled)
| Story | Summary | State | Note |
|---|---|---|---|
| FD-E7-01 | Risk-segmentation cascade from SD | 🟡 | `lib/procurement/risk-segmentation.ts` — inherent-risk cascade (highest-attribute-wins over data sensitivity + supplier risk + value + access/critical-service); **drives routing** and surfaces on the determination screen |
| FD-E7-02 | Preliminary operational risk assessment (generalises "PORA") | 🟢 | `lib/procurement/operational-risk-assessment.ts` — structured per-dimension screen (business continuity, data handling, concentration, regulatory exposure, access), **worst-dimension-wins** overall rating; complements the single-tier inherent-risk cascade. "Preliminary operational risk" panel on the risk step + in the export. Opaque acronym generalised to standardised dimensions |
| FD-E7-03 | Mini-IRQ in front door (delta only) | 🟢 | **Criteria-triggered** delta questionnaire (`residual-questions.ts`) on the risk step — each question (privileged access, critical service) shows only when the derived signals leave it open and states why ("Asked because…"); a low-value, low-sensitivity demand is asked nothing. Answers **refine the inherent-risk cascade + materiality live**. Fuller assessment still via the FORM-001 triage |
| FD-E7-04 | Reuse-matching against the third-party risk register | 🟡 | **Structured reuse model** (`lib/procurement/risk-reuse.ts`) — `evaluateReuse`/`selectReuseOutcome` decide reuse/amend/change/new by supplier, scope, data class, inherent tier & validity; drives the determination outcome |
| FD-E7-05 | Service-owner confirmation of reuse | 🟡 | Generic reviewer step exists |
| FD-E7-06 | Detailed assessment handoff (no front-door capture) | 🟡 | `lib/procurement/handoff.ts` — when reuse isn't possible the detailed assessment is a **routed step to the risk register** (deep-link, no front-door capture); shown in the determination's Next-steps panel |
| FD-E7-07 | Risk-required identification rules | 🟡 | Inherent-risk cascade (FD-E7-01) provides the tier; triage gate (`isTriageRequired`) decides when assessment runs |
| FD-E7-08 | Risk-reuse identification rules | 🟡 | The reuse model's per-dimension rules (supplier exact, scope/category, data-class no-higher, validity window, worst-dimension-wins) — `risk-reuse.ts` |
| FD-E7-09 | Risk outcome: reuse/amend/change/new | 🟡 | `determineRiskOutcome` — no reusable assessment → new; within assessed band → reuse; one tier above → amend; more → change. Surfaced on the determination screen |
| FD-E7-AGT6 | Risk-matching hardening | 🔴 | Not present |

#### FD-E8 — Buying-Channel Recommendation & Approvals — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| FD-E8-01 | Sourcing strategy from SD | 🟡 | Via routing rules; not SD-driven |
| FD-E8-02 | Threshold treatment & in/out-of-scope routing | 🟢 | Threshold rules exist |
| FD-E8-03 | Review demand summary (business vs GP-led) | 🟡 | Partial |
| FD-E8-04 | **Determination screen** (the R1 endpoint) | 🟢 | Split into two lighter steps — **Risk & assessment** then **Determination** (channel, contract/sourcing type, materiality, Next-steps handoff with system/status/deep-link), and **exportable** (`Export` → structured Markdown download via `determination-export.ts`) |
| FD-E8-05 | Approval-to-source: pre-sourcing validation gate | 🟢 | `lib/procurement/approval-to-source.ts` — standardised gate: **light** (demand validation + cost-centre) vs **full** (demand validation + intent-to-source + category approval), triggered by value ≥ threshold (OI-01), materiality, or high/critical inherent risk; transactable early exit ⇒ no gate. Surfaced as an "Approval to source" panel on the determination + in the export. Threshold seedable in the FD-E1 sim panel |
| FD-E8-07 | Sourcing scope determination rules | 🟡 | Partial |
| FD-E8-08 | Contract type: MSA/SOW/amend/change/renew | 🟢 | `lib/procurement/determination.ts` `determineContractType` — none / renew / SOW / **amend** / **change** / new-MSA. Against an existing agreement the scope/headroom signals decide: material demand → change; extends scope or at capacity → amend; fits with headroom → SOW. Wired from materiality + the second contract check; surfaced on the determination |
| FD-E8-09 | Sourcing type: new/renewal/benchmarking | 🟡 | `determineSourcingType` — none / renewal / benchmarking (incumbent) / new-event from channel + category + relationship; surfaced on the determination |
| FD-E8-10 | **Materiality & criticality** (regulatory flag) | 🟡 | `lib/procurement/materiality.ts` — highest-attribute-wins from data sensitivity + supplier risk + value (+ explicit critical-service seam); **feeds routing** (`material` field) and **surfaces on the determination screen**. Explicit "how it qualifies" capture pending |
| FD-E8-BFF4 | Recommendation composition API | 🟡 | Partial |

#### FD-E9 — Route & Handoff — 🟡 Partial
FD-E9-01 processing scope (PO required) 🟢 · FD-E9-02 finalise record 🟢 · FD-E9-03 handoff triggers 🟡 (**structured next-steps with system + status + deep-link** via `handoff.ts`) · FD-E9-04 supplier-data issue 🟡 · FD-E9-05 sourcing handoff (no write) 🟡 · FD-E9-06 PR refer/change 🟡 · ARC6 write-path/idempotency 🔴 · WF7 hardening 🟡.

### Cluster: Chatbot

#### CB-E10 — NL Data Query — 🟡 Partial
Real Groq tool-calling over **internal Supabase** (request, supplier, contract, PO, invoice, risk) + filter
(CB-E10-02 🟢) + partial aggregation (CB-E10-03 🟡). The **client-side assistant lookups now read through the
connector ports** (`capabilities/lookup.ts` → `requireConnector`), so the chatbot and front door share one
governed source with the provenance envelope; degrades gracefully on a source outage. Verified end-to-end by
`test:interactions-ui` (assistant returns connector-backed supplier data).
Per-source object stories — CB-E10-07 PR/PO (Ariba) · 08 Contract (Sirion) · 09 Catalogue · 10 Supplier ·
11 Invoice — are **🟡 (read via the own-store ports today)**; CB-E10-06 CSD (ServiceNow) · 12 Guided Buying ·
13 Sourcing Request · 14 Supplier Request · 15 TPRA (Coupa) · 16 Coupa status remain 🔴 (need own-store
objects modelled). The **server-side** `api/chat.ts` tool path still reads Supabase directly (WS-E).
CB-E10-GOV4 field masking (OI-28) 🔴 · CB-E10-BFF5 gateway 🟡 · CB-E10-AGB2 orchestration 🟢.

#### CB-E11 — Grounded Policy Q&A — 🟡 Partial
CB-E11-01 policy Q&A 🟡 (real LLM over ~95 KB entries; no 8-domain structure) · CB-E11-02 walk-through 🟡 ·
CB-E11-03 replace TIM 🔴 · CB-E11-GOV2 guardrail library 🔴 · CB-E11-AGB1 KB ingestion/embedding (RAG) 🔴.

#### CB-E12 — Agentic Actions — 🟡 Partial
Propose→confirm-before-act + audit logging exist (CB-E12-GOV5 🟢-ish; actions logged not executed).
CB-E12-04 PR/PO actions 🟡 · CB-E12-05 invoice actions 🟡 · CB-E12-06 payment/banking hand-off (OI-29) 🔴 ·
CB-E12-BFF6 action orchestration API 🟡.

#### CB-E13 — Support Assistance — 🟡 Partial
CB-E13-01 raise ticket 🟢 · CB-E13-02 schedule appointment 🔴 · CB-E13-03 route to training 🔴.

#### CB-E14 — Conversation Experience — 🟡 Partial
CB-E14-01 multi-conversation UI 🟡 (Web+overlay; **no Teams**) · CB-E14-02 history & retention 🟢 ·
CB-E14-03 eight-language 🔴 · CB-E14-04 deep-link to source 🟢.

---

## 5. Build roadmap (workstreams)

| WS | Theme | Sprint | Lead stories |
|---|---|---|---|
| **WS-0** | Unblock platform — ✅ **connector interface built** (`src/lib/integrations`, tested); core tables already present; remaining: architecture decisions, data-shape spikes | S0–S1 | FD-E1-WF0, FD-E1-ARC0, FD-E4-GOV0, OI-26/27/09 |
| **WS-A** | Decisioning data & reference plane (taxonomy, PSL, DTPS, reuse criteria, routing table from OI-01); make routing risk/materiality-aware — 🟡 **risk- & materiality-aware routing**, **taxonomy generalised**, **PSL/DTPS checks**, **materiality**, **category-code mapping**, **taxonomy store seeded/live** done; remaining: org-specific code scheme, hard PSL reference list | S1–S3 | FD-E1-01..06, FD-E4-02 |
| **WS-B** | Own data model behind connector ports — 🟢 **7 objects wired** (supplier, contract, request, PO, invoice, risk, catalogue); remaining: ticket/payment/screening/taxonomy/form objects + route consumers through ports | S1–S4 | FD-E2A-01..05, FD-E2B-01/03 |
| **WS-C** | Regulated risk & materiality engine — 🟢 **cascade + non-binary outcome + materiality + mini-IRQ delta + structured reuse model + assessment handoff + preliminary operational risk assessment** done; remaining: risk-matching hardening (FD-E7-AGT6) | S3–S5 | FD-E7-01..09, FD-E8-10 |
| **WS-D** | Complete front-door determination — 🟢 **done**: contract/sourcing type (incl. amend/change), handoff, two-step split, exportable endpoint, 2nd contract check, approval-to-source gate | S4–S6 | FD-E5-07, FD-E8-04/05/08/09, FD-E9 |
| **WS-F** | Staged-Intake Funnel redesign — 🟢 **done**: free-text-primary entry + sequential catalogue→enrich→contract→full-SD funnel (no premature catalogue/contract assertions) + **criteria-triggered stage-5 residual questions** (`residual-questions.ts`) | S4–S6 | **FD-E3-10**, FD-E3-02, FD-E4-01/03, FD-E5-01/02/05/06 |
| **WS-E** | Chatbot to own-DB sources + governance — 🟡 **classification eval harness** (FD-E4-GOV1) + **client assistant lookups routed through the connector ports** (CB-E10, one governed source) done; remaining: server-side `api/chat.ts` path, more source objects, masking, RAG, payments hand-off, Teams/i18n | S2–S7 | CB-E10-06..16, CB-E11-AGB1, CB-E12-06, FD-E4-GOV1 |

Lead with **WS-A** (highest leverage — turns heuristics into data-driven decisioning); WS-0 defines the
connector interface so **WS-B** can proceed in parallel.

---

## 6. Open Items → engineering hooks

The backlog's Open Items carry **recommended-default decisions** we can seed now and refine in the FD-E1
simulation panel before go-live:

| OI | Drives | Recommended default to seed |
|---|---|---|
| OI-01 | Routing/approval table | Catalogue/contract first; 10–250k + low/med risk → LIGHT (DVMO+cost centre); ≥250k or high/critical → FULL (DVMO+NTI+category); default FULL |
| OI-20 | Catalogue match | Goods keyword ≥0.7 on 8-digit commodity; services at class; prefer level-2 punchout |
| OI-21 | Contract match | UNSPSC class (6-digit); scope overlap ≥0.6; expiry buffer 30–60d; framework headroom ≤ ceiling−committed |
| OI-22 | Materiality | Critical/important service → material → regulatory flag + heightened chain (Legal sign-off) |
| OI-18 | Risk tiering | Highest-attribute-wins (highly-confidential data / privileged access / critical service → CRITICAL) |
| OI-24 | Risk reuse | Reuse if supplier exact, scope in band, data class no higher, within refresh cycle; else delta only |
| OI-28 | Chatbot masking | Mask bank account / payment method by default; entitled roles only; bot never widens source perms |
| OI-29 | Payment actions | R1 captures request + hands off to payments team with a ticket; bot initiates no payment change |

---

## 7. Decisions to confirm

1. **Model selection** (FD-E4-GOV0): recommend **Claude** for classification + assistant tiers (currently Groq/Gemini).
2. Accept the OI recommended-defaults (§6) as seed config, to refine in the simulation panel.
3. Confirm the own-DB approach covers **all** named source objects and the data volume needed for credible demos/UAT.
4. Which workstream to start: **WS-0** (unblock) is the natural first step; **WS-A** delivers the most visible value.

> Cross-reference: reconcile with `docs/REQUIREMENTS_AND_FIT_GAP.md` and `docs/IMPLEMENTATION_ASSESSMENT_AND_FIXES.md` to retire overlap. Full roadmap detail in the approved plan file.
