# Release 1 — Capability Roadmap & Fit/Gap Assessment

**Scope:** the Release-1 capability set for the Procurement Orchestration Platform — a regulated
"front door" (intake → classify → recommend → route) plus an internal AI assistant.
**Assessed against:** `orchestration-ui` (this repo) — React 19 SPA + Supabase, AI via Groq/Gemini.
**Positioning (confirmed):** this repo is the **foundation for Release 1**, not a throwaway demo.

> **ID scheme (this document's own).** Capability areas: **CFG** config & reference data · **SRC** own-data
> shadow/fast store · **CON** source connectors · **INT** intake & landing · **CLS** classification ·
> **CHK** catalogue/contract checks · **SUP** supplier selection · **RSK** risk & pre-assessment ·
> **DET** determination (channel/materiality/contract & sourcing type/approvals) · **RTE** routing & handoff ·
> **UX** design system · **PLT** platform/R2 stubs · **AST-Q/P/A/S/X** assistant (query/policy/actions/
> support/experience) · **GOV** AI governance & evaluation · **POL** policy defaults & decisions ·
> **WS-A..F** delivery workstreams. Suffixes: `-G` governance, `-B` backend/API, `-D` decision, `-W`
> workflow, `-T` tuning.

> Status legend: 🟢 **Built** (working analog exists) · 🟡 **Partial/mock** (some real logic, key gaps) · 🔴 **Gap** (not present).

---

## 1. What Release 1 locks

- Front door **classifies, recommends, routes** — does **not** execute (no writes; user acts via deep-links).
- **Staged intake**: light capture → try catalogue & contract first; full **service description** only when nothing fits.
- Service description is the **master capture** (8 best-practice elements); *"how it qualifies"* drives the **materiality / regulatory flag**.
- Contract matching runs **twice** (light at intake; rich vs full SD, surfacing frameworks/MSAs).
- Outcomes are **non-binary**: risk (reuse/amend/change/new) · contract type (MSA/SOW/amend/change/renew) · sourcing (new/renewal/benchmarking) · PR (refer/change).
- **Determination screen is the R1 endpoint** — every step with system, status, link; structured & exportable.
- Mini-IRQ in the front door; full IRQ stays in Coupa. Risk reuse needs service-owner confirm (RSK-05).

## 2. Guiding principle — own the data, defer the connections

**No live system connections exist for R1.** The build holds the equivalent data in **our own databases**
rather than calling Ariba/Coupa/Sirion/ServiceNow/SAP/GCP live — exactly what the
**SRC "Reference Data Shadow & Fast Store"** capability anticipates; we treat it as the R1 system of record.

- Model each named source object's **real data shape** as our own tables, populated with representative data.
- Read everything through a **connector interface (read ports)**: R1 impl reads our own DB; a later impl
  calls the real system. Consumers (front-door checks, risk reads, chatbot lookups) are unchanged when
  live integrations swap in.
- The integration spikes **POL-26 (Sirion) / POL-27 (Coupa) / POL-09 (GCP tables)** become *"confirm the real
  data shape so our tables match"* — they de-risk the future swap, not the R1 build.

---

## 3. Coverage summary

| Cluster | Built 🟢 | Partial 🟡 | Gap 🔴 |
|---|---|---|---|
| **Foundation & Platform** | Design system (UX) | Config & reference (CFG) | Shadow/fast-store (SRC), MCP connectors (CON) |
| **Front Door** | Intake & landing (INT) | Classify (CLS), Checks (CHK), Supplier (SUP), Channel (DET), Handoff (RTE) | Risk & mini-IRQ (RSK) |
| **Chatbot** | — | NL query (AST-Q), Policy Q&A (AST-P), Actions (AST-A), Support (AST-S), Experience (AST-X) | — |
| **Governance & AI** | — | — | Eval/guardrails/model-selection (GOV stories) |

**Read:** ~40–50% of Front-Door *flow/screen* stories have a working analog; **<15%** of Data-&-Integration,
regulated-decisioning (RSK / DET materiality), and Governance stories. The journey *shell* is built;
the regulated *decisioning + integrations* core is the gap.

---

## 4. Story-level fit/gap

### Cluster: Foundation & Platform

#### CFG — Configuration & Reference-Data Framework — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| CFG-01 | Routing & threshold rule engine | 🟡 | `evaluate-routing-rules.ts` real; **risk- and materiality-aware** (supplier risk tier + `material` flow into routing) |
| CFG-02 | Approval-chain & threshold-band config | 🟡 | Editor + `approval_chains` table exist (earlier "missing table" note was stale); re-verify saves end-to-end |
| CFG-03 | Taxonomy & category reference management | 🟡 | **Canonical taxonomy seeded & live** in the `procurement_categories` store (wizard reads it, admin edits it) + **configurable icons**. Pure-data/icons split keeps the server seed clean. Org-specific code scheme still pending |
| CFG-04 | PSL & competitive sourcing rule management | 🔴 | Not present |
| CFG-05 | Catalogue source & link-out config | 🟡 | Catalogue seed only; no source-type/link-out config |
| CFG-06 | Risk-reuse & contract-reuse criteria config | 🔴 | Only a `reusable` boolean on seed rows |
| CFG-07 | KB content management w/o change request | 🟢 | `kb-admin-page.tsx` CRUD to Supabase |
| CFG-08 | Config test & simulation panel | 🟢 | Routing-rules 3-panel tester exists; extend to new inputs |
| CFG-D0/3/5 | Architecture decisions / ring-fencing / scale | 🔴 | Not formalised |
| CFG-G3 | KB governance & sign-off | 🟡 | KB editable; no sign-off workflow |
| CFG-W0 | Config service skeleton & rule schema | 🟡 | Routing schema exists; reference-data schema gaps |

#### SRC — Reference Data Shadow & Fast Store (GCP) — 🔴 Gap
All stories (SRC-01..05, DEC-2): no GCP/BigQuery shadow; data is Supabase seed. **R1 re-scope:** build
these as the **own-DB shadow / fast store** (system of record) per §2.

#### CON — Real-Time Source Connectors (MCP) — 🟡 Partial (foundation built)
CON-01 (Ariba), CON-03 (ServiceNow), DEC-1 (MCP pattern): mock status records only. **R1 re-scope:**
express as **own-store read ports** behind the connector interface; live/MCP is a future swap.
**Done (WS-0 + WS-B breadth):** the standardised connector layer is in place —
`src/lib/integrations/{ports,registry}.ts`, `own-store/factory.ts`, `useSourceObject`/`useSourceList`
hooks, the documented live-swap seam (`src/lib/integrations/README.md`), and own-store connectors for
**eight objects** (supplier, contract, purchase-request, purchase-order, invoice, risk-assessment,
catalogue-item, **payment** — supplier banking/payment master, a vendor-data foundation behind the
ports); covered by `npm run test:connectors` (drift guard pins the object set).
**Consumers routed:** the front-door catalogue + contract checks (`step-pre-check.tsx`), the
supplier/contract reads in `step-compliance.tsx` (`useSourceData`), and the **assistant lookups**
(`src/lib/assistant/capabilities/lookup.ts` now reads suppliers/requests/contracts/POs/invoices/risk
through `requireConnector(...)` — so the chatbot and front door share one governed source).
**Remaining:** connectors for objects without an own-store read module yet (support-ticket,
risk-screening, category-taxonomy, form-submission); routing **risk reuse-matching** through the ports
(needs validity-window query support — WS-C) and the **server-side** assistant path (`api/chat.ts`
needs a server connector variant — WS-E).

#### UX — Design System & User Journeys — 🟢 Built
UX-01 component library 🟢; UX-02 journeys 🟡 (confirm from contextual inquiry, POL-10); DEC-7 env/rollback 🟡.

#### PLT — Sourcing/Award/Contract handoff (R2 stub) — out of R1 scope.

### Cluster: Front Door

#### INT — Front Door, Intake & Landing — 🟢 Built (strongest area)
| Story | Summary | State | Note |
|---|---|---|---|
| INT-01 | Role-based landing page | 🟢 | 5 role dashboards |
| INT-02 | Light intake | 🟢 | **Free text is the only commodity entry — there is no category selection.** Commodity categories (Goods/Services/…) are derived metadata, not a user choice; the fulfilment path (catalogue / contract / full request) is derived by the funnel. The catalogue is the one explicit alternative entry (INT-10) |
| INT-03 | Full service description + quality gates | 🟡 | **Unified, auto-composed capture** — the chat builds one service description (request key facts + SOW elements in one panel, no separate Summary/SOW tabs and **no manual "Generate SOW" button**); the conversation asks until all components are captured, then the document is **composed automatically** (quality score shown). Inline-editable; graceful offline. "how it qualifies" not yet driving materiality |
| INT-04 | Draft save & resume | 🟢 | Saves draft to Supabase |
| INT-05 | Edit in-flight demand | 🟡 | Partial |
| INT-06 | Demand validation — permissibility/prohibited | 🟡 | Some policy checks hardcoded |
| INT-07 | Status tracking | 🟢 | Stage history tracked |
| INT-08 | Notifications & actions-required | 🟢 | Notification feed |
| INT-09 | Show existing info, structured & exportable | 🟡 | Feeds the determination endpoint; export to confirm |
| INT-B0/1/3/7, DEC-4 | BFF + audit | 🟡 | APIs exist; audit/observability partial |

#### CLS — Classify & Translate to the Category Taxonomy — 🟡 Partial/mock
| Story | Summary | State | Note |
|---|---|---|---|
| CLS-01 | AI classification + catalogue/contract sufficiency | 🟡 | Real LLM (Groq/Gemini); now validates against the **configured taxonomy** (not a separate hardcoded list). The deterministic fallback classifier is centralised in `lib/procurement/classify.ts` (single source of truth, benchmarked) |
| CLS-02 | Category-code assignment & taxonomy translation | 🟡 | `lib/procurement/category-code.ts` — keyword → standardised code, **category-aware** with **per-category default codes** so every demand resolves; centralises the old commodity map. Organisation-specific code scheme pending |
| CLS-03 | Low-confidence handling & manual override | 🟢 | The AI classification is shown with extracted details before it's accepted; if it's wrong the user **re-describes** ("Try again") rather than picking from a commodity-category grid (which has been removed — categories are derived, not chosen) |
| CLS-G0 | AI governance & **model selection** | 🟢 | **Decided: keep Groq + Gemini** (governed providers, free tier, already connected); a paid provider (e.g. Claude) is **not** adopted and no new provider is added without explicit approval |
| CLS-G1 | Classification eval harness & baseline | 🟡 | `npm run test:classification-eval` — labelled benchmark over the deterministic classifier with a per-category breakdown and an **accuracy-baseline gate (≥85%)** so rule changes can't silently regress (currently 95.8%). LLM-tier eval still needs the governed endpoint |
| CLS-G6/7, AGT5/7 | Quality monitoring, model change mgmt, tuning, observability | 🔴 | Not present |
| CLS-B2 | Classification aggregation API | 🟡 | `/api/ai.ts` exists |

#### CHK — Demand Checks (Catalogue & Contract) — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| CHK-01 | Catalogue match — early exit to punchout | 🟢 | Match + early-exit read via the connector ports (`useSourceData`); now the **first gated stage** of the staged funnel (INT-10), not an eager parallel check. Punchout mocked |
| CHK-02 | Transactable contract — early exit to raise PR | 🟢 | Score-based match + early-exit via the connector ports; now **stage 2 of the funnel — reached only after catalogue is ruled out and the user enriches**, so no contract is asserted prematurely (INT-10) |
| CHK-03 | PSL enforcement at check | 🟡 | **Preferred-supplier (PSL) soft check + boost** centralised in `lib/procurement/supplier-preference.ts` (explicit `preferred` flag seam, else heuristic); surfaced in the determination + recommender. Hard PSL reference list pending |
| CHK-04 | Configurable intake-form engine (ASP/partial) | 🟡 | Partial |
| CHK-05 | Catalogue matching rules & info to collect | 🟡 | Heuristic; thresholds (POL-20) not configurable |
| CHK-06 | Contract matching rules & info to collect | 🟡 | Heuristic; thresholds (POL-21) not configurable |
| CHK-07 | **Second** contract check vs full SD + framework/MSA | 🟡 | `lib/procurement/second-contract-check.ts` — classifies the supplier's contracts as **transactable / framework (host a SOW) / expiring** and recommends transact/author-SOW/renew/new; "Contract coverage" panel on the determination. `isFramework` flag is the live-data seam |

#### INT-10 — Staged-Intake Funnel (entry-point + progressive-disclosure redesign) — 🟢 Built

> **Why this is a distinct requirement.** The checks of CHK-01/02 and the determination steps all
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
   derives category/commodity code (CLS) rather than asking the user to pre-classify. There is
   **no commodity-category selection at all** — Goods/Services/… are derived metadata, not a choice;
   to correct a misread the user re-describes ("Try again"), there is no category grid (CLS-03).
2. **Browse catalogue directly** — for users who already know they want a catalogue item; jumps
   straight to the punchout/catalogue-order early exit.

**Progressive, stage-gated derivation** (each stage runs *only* when the prior one fails to resolve,
and only once it has enough signal):

| Story | Stage | Behaviour | Exit |
|---|---|---|---|
| INT-10a | 1 · Capture | User types the demand in free text. | — |
| INT-10b | 2 · Catalogue derivation | System attempts a catalogue match on the captured text. Shown **only** when confidence clears the threshold (POL-20). | Catalogue match → **catalogue order** (early exit, lightest path). |
| INT-10c | 3 · Enrich-then-contract | No catalogue → prompt for *more* detail, then attempt a **transactable-contract** match (CHK-02). Not shown until step 3's added input exists. | Transactable contract → **transact / raise PR** (early exit). |
| INT-10d | 4 · Full service description | No contract → user completes the full SD (INT-03), the master capture. | — |
| INT-10e | 5 · Derive + final questions | System derives every downstream element from the SD (category-code, materiality, risk cascade, channel, contract/sourcing type) and asks **only the residual questions** that criteria demand (e.g. mini-IRQ delta when risk is unclear, "how it qualifies" when materiality is borderline). | → Determination screen (the R1 endpoint). |

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

**Related capabilities:** INT-02 (light intake — entry redesign), INT-03 (master SD as stage 4),
CLS-01/03 (derive category, low-conf override), CHK-01/02/05/06 (gated early exits + thresholds
POL-20/21), CHK-07 (second contract check already lives in stage 5), RSK-03 / DET-10
(criteria-triggered residual questions in stage 5).

**Open design decisions** (resolve before build):
- Stage-2/3 thresholds: reuse POL-20/21 defaults, or expose in the CFG simulation panel first?
- Catalogue-as-entry: does "browse catalogue" bypass the funnel entirely (pure order, no
  determination), or still produce a lightweight determination record for audit?
- Manual category override: keep as an always-available "not what I meant" affordance, or only
  surface it when classification confidence is low?

#### SUP — Supplier Identification & Selection — 🟡 Partial/mock
SUP-01 permissible supplier 🟡 (PSL soft-preference now in checks) · SUP-02 competitive sourcing & supplier-count 🟡 (**competitive-sourcing/competitive sourcing check** in `supplier-preference.ts` — threshold + exemptions for preferred route, exempt category, single-source justification) · SUP-03 screening display 🟡 (status shown, no real screening).

#### RSK — Risk & Mini-IRQ Pre-Assessment — 🟡 Partial (core decisioning now modelled)
| Story | Summary | State | Note |
|---|---|---|---|
| RSK-01 | Risk-segmentation cascade from SD | 🟡 | `lib/procurement/risk-segmentation.ts` — inherent-risk cascade (highest-attribute-wins over data sensitivity + supplier risk + value + access/critical-service); **drives routing** and surfaces on the determination screen |
| RSK-02 | Preliminary operational risk assessment | 🟢 | `lib/procurement/operational-risk-assessment.ts` — structured per-dimension screen (business continuity, data handling, concentration, regulatory exposure, access), **worst-dimension-wins** overall rating; complements the single-tier inherent-risk cascade. "Preliminary operational risk" panel on the risk step + in the export. Opaque acronym generalised to standardised dimensions |
| RSK-03 | Mini-IRQ in front door (delta only) | 🟢 | **Criteria-triggered** delta questionnaire (`residual-questions.ts`) on the risk step — each question (privileged access, critical service) shows only when the derived signals leave it open and states why ("Asked because…"); a low-value, low-sensitivity demand is asked nothing. Answers **refine the inherent-risk cascade + materiality live**. Fuller assessment still via the FORM-001 triage |
| RSK-04 | Reuse-matching against the third-party risk register | 🟡 | **Structured reuse model** (`lib/procurement/risk-reuse.ts`) — `evaluateReuse`/`selectReuseOutcome` decide reuse/amend/change/new by supplier, scope, data class, inherent tier & validity; drives the determination outcome |
| RSK-05 | Service-owner confirmation of reuse | 🟡 | Generic reviewer step exists |
| RSK-06 | Detailed assessment handoff (no front-door capture) | 🟡 | `lib/procurement/handoff.ts` — when reuse isn't possible the detailed assessment is a **routed step to the risk register** (deep-link, no front-door capture); shown in the determination's Next-steps panel |
| RSK-07 | Risk-required identification rules | 🟡 | Inherent-risk cascade (RSK-01) provides the tier; triage gate (`isTriageRequired`) decides when assessment runs |
| RSK-08 | Risk-reuse identification rules | 🟡 | The reuse model's per-dimension rules (supplier exact, scope/category, data-class no-higher, validity window, worst-dimension-wins) — `risk-reuse.ts` |
| RSK-09 | Risk outcome: reuse/amend/change/new | 🟡 | `determineRiskOutcome` — no reusable assessment → new; within assessed band → reuse; one tier above → amend; more → change. Surfaced on the determination screen |
| RSK-T6 | Risk-matching hardening | 🔴 | Not present |

#### DET — Buying-Channel Recommendation & Approvals — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| DET-01 | Sourcing strategy from SD | 🟡 | Via routing rules; not SD-driven |
| DET-02 | Threshold treatment & in/out-of-scope routing | 🟢 | Threshold rules exist |
| DET-03 | Review demand summary (business vs procurement-led) | 🟡 | Partial |
| DET-04 | **Determination screen** (the R1 endpoint) | 🟢 | Split into two lighter steps — **Risk & assessment** then **Determination** (channel, contract/sourcing type, materiality, Next-steps handoff with system/status/deep-link), and **exportable** (`Export` → structured Markdown download via `determination-export.ts`) |
| DET-05 | Approval-to-source: pre-sourcing validation gate | 🟢 | `lib/procurement/approval-to-source.ts` — standardised gate: **light** (demand validation + cost-centre) vs **full** (demand validation + intent-to-source + category approval), triggered by value ≥ threshold (POL-01), materiality, or high/critical inherent risk; transactable early exit ⇒ no gate. Surfaced as an "Approval to source" panel on the determination + in the export. Threshold seedable in the CFG sim panel |
| DET-07 | Sourcing scope determination rules | 🟡 | Partial |
| DET-08 | Contract type: MSA/SOW/amend/change/renew | 🟢 | `lib/procurement/determination.ts` `determineContractType` — none / renew / SOW / **amend** / **change** / new-MSA. Against an existing agreement the scope/headroom signals decide: material demand → change; extends scope or at capacity → amend; fits with headroom → SOW. Wired from materiality + the second contract check; surfaced on the determination |
| DET-09 | Sourcing type: new/renewal/benchmarking | 🟡 | `determineSourcingType` — none / renewal / benchmarking (incumbent) / new-event from channel + category + relationship; surfaced on the determination |
| DET-10 | **Materiality & criticality** (regulatory flag) | 🟡 | `lib/procurement/materiality.ts` — highest-attribute-wins from data sensitivity + supplier risk + value (+ explicit critical-service seam); **feeds routing** (`material` field) and **surfaces on the determination screen**. Explicit "how it qualifies" capture pending |
| DET-B4 | Recommendation composition API | 🟡 | Partial |

#### RTE — Route & Handoff — 🟡 Partial
RTE-01 processing scope (PO required) 🟢 · RTE-02 finalise record 🟢 · RTE-03 handoff triggers 🟡 (**structured next-steps with system + status + deep-link** via `handoff.ts`) · RTE-04 supplier-data issue 🟡 · RTE-05 sourcing handoff (no write) 🟡 · RTE-06 PR refer/change 🟢 (**demand disposition** in `lib/procurement/referral.ts` — proceed / request-change / refer-back, most-blocking-wins from completeness + policy + scope signals; headline banner on the determination + in the export) · DEC-6 write-path/idempotency 🔴 · WFL-7 hardening 🟡.

### Cluster: Chatbot

#### AST-Q — NL Data Query — 🟡 Partial
Real Groq tool-calling over **internal Supabase** (request, supplier, contract, PO, invoice, risk) + filter
(AST-Q-02 🟢) + partial aggregation (AST-Q-03 🟡). The **client-side assistant lookups now read through the
connector ports** (`capabilities/lookup.ts` → `requireConnector`), so the chatbot and front door share one
governed source with the provenance envelope; degrades gracefully on a source outage. Verified end-to-end by
`test:interactions-ui` (assistant returns connector-backed supplier data).
Per-source object stories — AST-Q-07 PR/PO (Ariba) · 08 Contract (Sirion) · 09 Catalogue · 10 Supplier ·
11 Invoice — are **🟡 (read via the own-store ports today)**; AST-Q-06 CSD (ServiceNow) · 12 Guided Buying ·
13 Sourcing Request · 14 Supplier Request · 15 TPRA (Coupa) · 16 Coupa status remain 🔴 (need own-store
objects modelled). The **server-side** `api/chat.ts` tool path still reads Supabase directly (WS-E).
AST-Q-G4 field masking (POL-28) 🔴 · AST-Q-B5 gateway 🟡 · AST-Q-T2 orchestration 🟢.

#### AST-P — Grounded Policy Q&A — 🟡 Partial
AST-P-01 policy Q&A 🟡 (real LLM over ~95 KB entries; no 8-domain structure) · AST-P-02 walk-through 🟡 ·
AST-P-03 replace TIM 🔴 · AST-P-G2 guardrail library 🔴 · AST-P-T1 KB ingestion/embedding (RAG) 🔴.

#### AST-A — Agentic Actions — 🟡 Partial
Propose→confirm-before-act + audit logging exist (AST-A-G5 🟢-ish; actions logged not executed).
AST-A-04 PR/PO actions 🟡 · AST-A-05 invoice actions 🟡 · AST-A-06 payment/banking hand-off (POL-29) 🔴 ·
AST-A-B6 action orchestration API 🟡.

#### AST-S — Support Assistance — 🟡 Partial
AST-S-01 raise ticket 🟢 · AST-S-02 schedule appointment 🔴 · AST-S-03 route to training 🔴.

#### AST-X — Conversation Experience — 🟡 Partial
AST-X-01 multi-conversation UI 🟡 (Web+overlay; **no Teams**) · AST-X-02 history & retention 🟢 ·
AST-X-03 eight-language 🔴 · AST-X-04 deep-link to source 🟢.

---

## 5. Build roadmap (workstreams)

| WS | Theme | Sprint | Lead stories |
|---|---|---|---|
| **WS-0** | Unblock platform — ✅ **connector interface built** (`src/lib/integrations`, tested); core tables already present; remaining: architecture decisions, data-shape spikes | S0–S1 | CFG-W0, CFG-D0, CLS-G0, POL-26/27/09 |
| **WS-A** | Decisioning data & reference plane (taxonomy, PSL, competitive sourcing, reuse criteria, routing table from POL-01); make routing risk/materiality-aware — 🟡 **risk- & materiality-aware routing**, **taxonomy generalised**, **PSL/competitive sourcing checks**, **materiality**, **category-code mapping**, **taxonomy store seeded/live** done; remaining: org-specific code scheme, hard PSL reference list | S1–S3 | CFG-01..06, CLS-02 |
| **WS-B** | Own data model behind connector ports — 🟢 **8 objects wired** (supplier, contract, request, PO, invoice, risk, catalogue, **payment**); remaining: ticket/screening/taxonomy/form objects + route remaining consumers through ports | S1–S4 | SRC-01..05, CON-01/03 |
| **WS-C** | Regulated risk & materiality engine — 🟢 **cascade + non-binary outcome + materiality + mini-IRQ delta + structured reuse model + assessment handoff + preliminary operational risk assessment** done; remaining: risk-matching hardening (RSK-T6) | S3–S5 | RSK-01..09, DET-10 |
| **WS-D** | Complete front-door determination — 🟢 **done**: contract/sourcing type (incl. amend/change), handoff, two-step split, exportable endpoint, 2nd contract check, approval-to-source gate | S4–S6 | CHK-07, DET-04/05/08/09, RTE |
| **WS-F** | Staged-Intake Funnel redesign — 🟢 **done**: free-text-primary entry + sequential catalogue→enrich→contract→full-SD funnel (no premature catalogue/contract assertions) + **criteria-triggered stage-5 residual questions** (`residual-questions.ts`) | S4–S6 | **INT-10**, INT-02, CLS-01/03, CHK-01/02/05/06 |
| **WS-E** | Chatbot to own-DB sources + governance — 🟡 **classification eval harness** (CLS-G1) + **client assistant lookups routed through the connector ports** (AST-Q, one governed source) done; remaining: server-side `api/chat.ts` path, more source objects, masking, RAG, payments hand-off, Teams/i18n | S2–S7 | AST-Q-06..16, AST-P-T1, AST-A-06, CLS-G1 |

Lead with **WS-A** (highest leverage — turns heuristics into data-driven decisioning); WS-0 defines the
connector interface so **WS-B** can proceed in parallel.

---

## 6. Open Items → engineering hooks

The Release-1 policy defaults (POL-xx) carry **recommended-default decisions** we can seed now and refine in the CFG
simulation panel before go-live:

| OI | Drives | Recommended default to seed |
|---|---|---|
| POL-01 | Routing/approval table | Catalogue/contract first; 10–250k + low/med risk → LIGHT (demand validation + cost centre); ≥250k or high/critical → FULL (demand validation + intent-to-source + category); default FULL |
| POL-20 | Catalogue match | Goods keyword ≥0.7 on 8-digit commodity; services at class; prefer level-2 punchout |
| POL-21 | Contract match | UNSPSC class (6-digit); scope overlap ≥0.6; expiry buffer 30–60d; framework headroom ≤ ceiling−committed |
| POL-22 | Materiality | Critical/important service → material → regulatory flag + heightened chain (Legal sign-off) |
| POL-18 | Risk tiering | Highest-attribute-wins (highly-confidential data / privileged access / critical service → CRITICAL) |
| POL-24 | Risk reuse | Reuse if supplier exact, scope in band, data class no higher, within refresh cycle; else delta only |
| POL-28 | Chatbot masking | Mask bank account / payment method by default; entitled roles only; bot never widens source perms |
| POL-29 | Payment actions | R1 captures request + hands off to payments team with a ticket; bot initiates no payment change |

---

## 7. Decisions to confirm

1. **Model selection** (CLS-G0): ✅ **decided — keep Groq + Gemini** (free tier, already connected); no paid provider (e.g. Claude) without explicit approval.
2. Accept the OI recommended-defaults (§6) as seed config, to refine in the simulation panel.
3. Confirm the own-DB approach covers **all** named source objects and the data volume needed for credible demos/UAT.
4. Which workstream to start: **WS-0** (unblock) is the natural first step; **WS-A** delivers the most visible value.

> Cross-reference: reconcile with `docs/REQUIREMENTS_AND_FIT_GAP.md` and `docs/IMPLEMENTATION_ASSESSMENT_AND_FIXES.md` to retire overlap. Full roadmap detail in the approved plan file.
