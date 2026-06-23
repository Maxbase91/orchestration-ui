# Procurement Orchestration — Requirements & Fit-Gap Analysis

**Benchmarks:** Zip · Oro Labs · SAP Ariba · **Compared against:** orchestration-ui (this app) · **Date:** June 2026
**Purpose:** a holistic capability/requirements baseline drawn from the three market leaders, scored against the current app, with a prioritized backlog to close gaps or improve existing features.

---

## 1. Executive summary

The app already implements the **shape** of a modern orchestration platform — a single intelligent intake, a no-code routing/workflow/forms layer, supplier 360, sourcing+evaluation, a P2P chain (PO → receipt → invoice → 3-way match → payment), analytics, a supplier portal, an admin control plane, and an AI assistant. That is genuinely broad and aligns conceptually with **Zip** and **Oro** (orchestration-first) more than with **SAP Ariba** (deep source-to-pay suite).

The gaps are mostly about **depth and "realness"**, not missing concepts:

1. **It's a prototype** — mock/Supabase data, simulated integrations, and a workflow engine that *renders* but doesn't *execute*. Zip/Oro/Ariba are transactional systems of record wired to ERPs, networks, and payment rails.
2. **No real integration ecosystem** — the single biggest differentiator of Zip/Oro is connecting to 50–100s of systems (ERP, CLM, HRIS, ITSM, e-sign, risk feeds). The app only *visualises* four integrations.
3. **Shallow P2P and spend analytics** — catalog/punchout, real invoice OCR + matching tolerances, payments, and a true spend cube/savings tracking are largely demonstrative.
4. **Contracts and supplier risk are thin** vs Ariba CLM (clause library, redlining, obligations) and SLP/Risk (third-party sanctions/financial/ESG feeds).
5. **AI is mostly UI-deep** — agents exist as config cards; competitors run agentic execution end-to-end.

None of this is surprising for a prototype. The fit-gap below turns it into a backlog: **what to make real, what to deepen, and what to add.**

---

## 2. Method & sources

Capabilities were compiled from the public product scope of the three platforms and mapped to a common capability model, then scored against the app (assessed in the prior functional audit + admin review). Coverage ratings:

- ✅ **Full** — implemented and functional.
- 🟡 **Partial** — present but shallow / not fully wired.
- 🧪 **Prototype** — UI exists but mock/non-executing.
- 🔴 **Gap** — not present.

Sources are listed in §7.

---

## 3. Platform scope at a glance

| Platform | Positioning | Core scope |
|---|---|---|
| **Zip** | AI procurement *orchestration* (intake-to-pay) | Intake-to-Procure, Procure-to-Pay, Supplier Onboarding, Sourcing, Risk Orchestration, AI Contract Orchestration, AI Procurement Concierge; capabilities: intake mgmt, no-code **workflow engine**, vendor mgmt, **integration ecosystem**, spend insights, AI agents; add-ons: Global Payments, Vendor Cards, Budgets, App Studio. |
| **Oro Labs** | AI-native procurement *orchestration* | AI **intake** with intelligent routing (process/systems/risk/stakeholders), no-code **workflow + AI-agent builder**, smart forms, reusable components, supplier onboarding/lifecycle/risk, approval mgmt, sourcing coordination, integrations. |
| **SAP Ariba** | Enterprise **source-to-pay** suite | Sourcing (RFx), Contracts/CLM, Buying & Invoicing, **Guided Buying**, Supplier Lifecycle & Performance (SLP), Supplier Risk, Business/Ariba **Network**, Spend Analysis, catalogs; next-gen AI-native suite on SAP BTP (2026) with generative/agentic AI. |

**Read:** Zip and Oro are the right role models for *this app's orchestration thesis*; Ariba is the reference for *transactional depth* (sourcing/contracts/P2P/network) you'd grow into.

---

## 4. Holistic requirements + fit-gap by capability domain

### A. Intake & Guided Buying
| # | Requirement (from Zip/Oro/Ariba) | App today | Cov. |
|---|---|---|---|
| A1 | Single "front door" intake for any request type | Command bar + 6-step wizard | ✅ |
| A2 | AI intent detection & category classification from free text | AI classifier (90%+) in wizard & command bar | ✅ |
| A3 | Intelligent routing/navigation to the *right process, systems, stakeholders, risk steps* (Oro) | Routing rules → buying channel + approval path | 🟡 (routing yes; not multi-system/stakeholder orchestration) |
| A4 | Guided/catalog buying with policy compliance at source (Ariba Guided Buying) | Catalogue browse + cart + threshold logic | 🟡 (no punchout/hosted catalog mgmt) |
| A5 | Conversational intake / SOW generation | AI chat intake + 9-section SOW | ✅ |
| A6 | Status transparency for requesters ("where is my request") | Request detail + tracking | ✅ |
| A7 | Intake analytics (volume, cycle, drop-off) | Partial dashboards | 🟡 |

### B. Orchestration / Workflow engine
| # | Requirement | App today | Cov. |
|---|---|---|---|
| B1 | No-code visual workflow builder | Workflow Designer (React Flow, 10 node types, templates) | 🧪 (builds & saves, but doesn't drive runtime lifecycle) |
| B2 | Rules engine for routing/policy (IF/THEN) | Routing Rules engine + test panel, wired to intake | ✅ |
| B3 | Smart, reusable forms triggered by stage/condition | Form Builder (8 templates, 11 field types, conditional) | ✅ |
| B4 | Parallel branches, decisions, timers, sub-workflows | Node types exist in designer | 🧪 |
| B5 | **Executable** workflow runtime (state machine drives stages/SLAs/integration calls) | Lifecycle hardcoded by buying channel | 🔴 (designer is decorative — see Admin Recommendations A2) |
| B6 | SLA tracking, escalation, bottleneck detection | SLA tracker, bottlenecks, heatmap, AI analysis | 🟡 (date-anchored data; SLAs hardcoded) |
| B7 | Workflow simulation / dry-run | Designer "Simulate" | 🧪 |

### C. Approvals
| # | Requirement | App today | Cov. |
|---|---|---|---|
| C1 | Multi-step approval chains by value/category/risk | 4 chains + threshold bands | 🟡 (chains don't persist/execute) |
| C2 | Parallel + sequential approvers, delegation, OOO | Shown in routing preview; OOO in user mgmt | 🟡 (delegation not auto-applied) |
| C3 | One-click approve/reject/request-info from queue, email, mobile | In-app approve works (verified) | 🟡 (no email/mobile actions) |
| C4 | AI approval recommendations / risk summaries | AI pre-validation cards | ✅ (UI) |
| C5 | Approval audit trail | Audit log | ✅ |

### D. Supplier Management (onboarding, lifecycle, risk, performance, network)
| # | Requirement | App today | Cov. |
|---|---|---|---|
| D1 | Supplier 360 / master data | Directory + 7-tab profile | ✅ |
| D2 | Self-service onboarding portal + qualification | Supplier portal + onboarding wizard | 🟡 (status view; some controls inert e.g. Submit Invoice) |
| D3 | Risk scoring & screening via **third-party feeds** (sanctions, financial, ESG, cyber) | Risk & compliance views, SRA statuses | 🔴 (no external feeds; static data) |
| D4 | Performance scorecards / SRM | Performance tab + scores | 🟡 |
| D5 | Supplier/Business **Network** (transacting with suppliers at scale: POs, invoices, catalogs) | Supplier portal only | 🔴 (no network) |
| D6 | Document & certificate lifecycle (expiry, renewals) | Documents tab | 🟡 |

### E. Sourcing & Evaluation
| # | Requirement | App today | Cov. |
|---|---|---|---|
| E1 | RFx event creation (RFI/RFP/RFQ), templates | Event list + new event wizard + 5 templates | 🟡 (publish/save persistence weak) |
| E2 | Supplier invitation, Q&A board, response tracking | Event detail tabs | 🟡 |
| E3 | Weighted scoring matrix + side-by-side comparison | Evaluation Centre | ✅ |
| E4 | AI-assisted scoring & award recommendation | AI scoring narrative | ✅ (UI) |
| E5 | Reverse auctions / advanced event types | Templates list mentions | 🔴 |
| E6 | Award → contract/PO handoff | Conceptual | 🟡 |

### F. Contracts / CLM
| # | Requirement | App today | Cov. |
|---|---|---|---|
| F1 | Contract register, lifecycle status, renewals/alerts | Register + renewals + detail | ✅ |
| F2 | Clause library, templates, authoring | Templates list | 🔴 (no clause library/authoring) |
| F3 | Redlining / version control / e-signature | — | 🔴 |
| F4 | Obligation & milestone management | Detail mentions obligations | 🟡 |
| F5 | Contract-to-spend linkage (leakage control) | Linked entities | 🟡 |
| F6 | AI contract review/extraction (Zip AI Contract Orchestration) | — | 🔴 |

### G. Procure-to-Pay (catalog, PO, receipt, invoice, match, pay)
| # | Requirement | App today | Cov. |
|---|---|---|---|
| G1 | PO creation & lifecycle | PO list/detail | 🧪 |
| G2 | Goods/services receipt | Goods Receipt form | 🟡 |
| G3 | Invoice capture with **AI OCR/extraction** | AI extraction (described) | 🧪 |
| G4 | **2/3-way match** with tolerances & variance handling | Three-Way Match (now computes mismatch) | 🟡 (single example; no tolerance config) |
| G5 | Payment scheduling/execution + **global payments** | Payment tracker | 🧪 / 🔴 (no real payments/global) |
| G6 | Catalog management / punchout | Catalogue browse | 🔴 (no punchout) |
| G7 | Budget checks / encumbrance (Zip Budgets) | — | 🔴 |
| G8 | Virtual/vendor cards (Zip Vendor Cards) | — | 🔴 |

### H. Spend Analysis & Analytics
| # | Requirement | App today | Cov. |
|---|---|---|---|
| H1 | Spend dashboards (category/supplier/dept, managed vs unmanaged) | Spend Overview + dashboards | 🟡 |
| H2 | Spend classification/enrichment (taxonomy, AI categorization) | Commodity codes | 🟡 |
| H3 | Savings & opportunity tracking, anomaly detection | KPIs + AI anomaly panel | 🟡 |
| H4 | Custom report builder + scheduled exports (PDF/Excel/CSV) | Report Builder + Exports | 🟡 (CSV export; PDF/Excel partial) |
| H5 | Real-time, drillable cube on live transactions | Aggregates on mock data | 🧪 |

### I. AI & Agents
| # | Requirement | App today | Cov. |
|---|---|---|---|
| I1 | Conversational procurement concierge (Q&A, lookups, actions) | AI assistant chatbot | 🟡 (tool-calling loop still failing per fix log) |
| I2 | Agent library w/ accuracy, governance, human-in-the-loop | 6 agents + config + analytics | 🟡 (config UI deep; only 2 wired) |
| I3 | Agentic execution across steps (intake→validate→source→pay) | — | 🔴 (agents don't execute) |
| I4 | Document AI (invoice/contract extraction) | Described | 🧪 |
| I5 | Anomaly/risk insights | Spend anomaly, bottleneck AI | 🟡 |

### J. Integrations & Ecosystem
| # | Requirement | App today | Cov. |
|---|---|---|---|
| J1 | Broad pre-built connector library (ERP/CLM/HRIS/ITSM/e-sign/risk) | Visualises 4 systems (Ariba/Coupa/Sirion/S4HANA) | 🔴 (simulated, not real) |
| J2 | Bi-directional ERP sync (vendors, POs, invoices, GL) | — | 🔴 |
| J3 | API/webhooks + iPaaS / app-builder (Zip App Studio) | — | 🔴 |
| J4 | SSO/SCIM provisioning | — | 🔴 |
| J5 | Integration status/health monitoring | System Health (mock) | 🧪 |

### K. Admin / No-code config / Governance
| # | Requirement | App today | Cov. |
|---|---|---|---|
| K1 | No-code config of rules/forms/workflows/agents | Admin suite | 🟡 (see ADMIN_RECOMMENDATIONS.md — some editors UI-only) |
| K2 | Configurable taxonomy (categories, channels, stages, thresholds, SLAs) | Hardcoded | 🔴 |
| K3 | Policy management linked to enforcement | Policy viewer | 🔴 (display-only) |
| K4 | Roles & permissions management | Code-defined matrix | 🟡 (now route-guarded; not admin-editable) |
| K5 | Audit log + change governance | Audit log + DB admin | ✅ |

### L. Platform & non-functional
| # | Requirement | App today | Cov. |
|---|---|---|---|
| L1 | RBAC across 6 roles | Implemented + route guards | ✅ |
| L2 | Authentication / enterprise identity | Role switcher (demo) | 🔴 (no real auth) |
| L3 | Notifications (in-app/email/push, quiet hours, digest) | In-app + prefs | 🟡 (prefs not persisted) |
| L4 | Mobile / responsive approvals | Desktop | 🔴 |
| L5 | Internationalization / multi-currency | EUR-centric | 🔴 (currency setting not applied) |
| L6 | Security/compliance (SOC2, data residency, encryption) | n/a (prototype) | 🔴 |

---

## 5. Gap scorecard (summary)

| Domain | Full ✅ | Partial 🟡 | Prototype 🧪 | Gap 🔴 |
|---|---|---|---|---|
| Intake & Guided Buying | 3 | 4 | 0 | 0 |
| Workflow engine | 2 | 1 | 3 | 1 |
| Approvals | 2 | 3 | 0 | 0 |
| Supplier mgmt | 1 | 3 | 0 | 2 |
| Sourcing | 2 | 3 | 0 | 1 |
| Contracts/CLM | 1 | 2 | 0 | 3 |
| Procure-to-Pay | 0 | 2 | 3 | 3 |
| Spend & analytics | 0 | 4 | 1 | 0 |
| AI & agents | 0 | 3 | 1 | 1 |
| Integrations | 0 | 0 | 1 | 4 |
| Admin/config | 1 | 2 | 0 | 2 |
| Platform/NFR | 1 | 1 | 0 | 4 |

**Headline:** strongest at **intake, approvals, sourcing evaluation, RBAC**; weakest at **integrations, P2P realness, contracts/CLM depth, configurable taxonomy, enterprise NFRs.**

---

## 6. Prioritized backlog to close gaps / improve

**P0 — make the orchestration core real (the differentiator Zip/Oro win on)**
1. **Executable workflow runtime (B5):** turn the Designer template into the state machine that drives stages, SLAs, forms, and integration steps per request. This unlocks B1/B4/B7 and connects to SLA/escalation/notifications.
2. **Persist & execute approval chains (C1/C2):** chain → generated approval entries, role→user resolution honoring OOO/delegate.
3. **Configurable taxonomy & thresholds (K2/K3):** categories, channels, stages, SLAs, value bands as admin tables feeding routing/approvals/policy (see ADMIN_RECOMMENDATIONS.md). One source of truth.

**P1 — depth where buyers feel it**
4. **Integration framework (J1–J3):** a real connector/adapter layer + webhooks/API; start with one ERP (S/4HANA) for vendors/PO/invoice sync, replacing the simulation. Add SSO (J4/L2).
5. **P2P realness (G1–G5):** functional PO issuance, invoice OCR + configurable match tolerances, and a payment step (even sandbox). Add budget checks (G7).
6. **Supplier risk feeds (D3):** wire one external screening source (sanctions/financial) into onboarding/risk so scores are live, not static.
7. **AI assistant + agent execution (I1–I4):** fix the tool-calling loop (per CLAUDE_CODE_FIX.md) and let at least the classifier/validator/compliance/recommender agents actually run and write results (e.g., populate the Compliance tab).

**P2 — breadth to approach suite parity**
8. **CLM depth (F2–F6):** clause library, templating, version/redline, e-sign integration, obligations, AI contract extraction.
9. **Spend cube & savings (H2/H3/H5):** real classification + savings/opportunity tracking on live data; finish PDF/Excel export.
10. **Catalog/punchout (G6), Vendor Cards (G8), Global Payments (G5):** the Zip add-on surface.
11. **Sourcing breadth (E5/E6):** reverse auctions, award→contract/PO automation.
12. **Platform NFRs (L3–L6):** persist notification prefs, responsive/mobile approvals, multi-currency/i18n, security posture.

---

## 7. Caveats
- Competitor capabilities are from public product/marketing material (June 2026); exact feature depth varies by edition/tier and is not independently verified.
- App ratings reflect the prior functional audit + admin review of this prototype (mock/Supabase, simulated integrations); a production build would change several 🧪 items.
- "Gap" doesn't always mean "build it" — for a demo/prototype, several enterprise items (network, global payments, SOC2) may be intentionally out of scope. Use the backlog to decide *make real* vs *deepen* vs *defer*.

## Sources
- [Zip — Platform overview](https://ziphq.com/platform-overview), [Intake-to-Procure](https://ziphq.com/products/intake-to-procure), [Workflow engine](https://ziphq.com/capabilities/workflow-engine), [AI agents](https://ziphq.com/ai)
- [Oro Labs — Smart procurement workflows](https://www.orolabs.ai/), [Intake Management](https://www.orolabs.ai/solutions/intake-management), [Platform overview](https://www.orolabs.ai/platform/overview)
- [SAP — Smart source-to-pay (Next-Gen Ariba)](https://www.sap.com/products/spend-management/smart-source-to-pay-procurement-software.html), [SAP Spend Management](https://www.sap.com/products/spend-management.html), [SAP Ariba modules & features 2026 (TheLinuxCode)](https://thelinuxcode.com/sap-ariba-modules-and-features-for-2026-procurement-teams/)
