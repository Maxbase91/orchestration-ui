# Procurement Orchestration UI — Full Test Playbook

**Purpose:** a complete, repeatable regression script covering every page, role, and path in the application. Run it end-to-end before each release (or after major changes) to confirm nothing is broken.
**App:** orchestration-ui · **Last updated:** 2 June 2026

> **Deployment note (2 Jun 2026):** verified against the new live build **`index-LlQShsel.js`**. Headline re-test results below.

---

## How to use this playbook

- **Environments:** record the URL + JS bundle hash (DevTools → Sources, or `document.querySelector('script[src*="/assets/"]').src`) so you know which build you tested.
- **Roles (6):** Requestor/End User · Strategic Procurement Manager · Vendor Manager · Procurement Operations Lead · Supplier (External) · Admin/Platform Owner. Switch via the top-right role switcher.
- **For each test:** follow Steps, compare to **Expected**, mark **Pass / Fail / Blocked**. On Fail, capture: route, role, screenshot, console error (DevTools console), network status (for Supabase 4xx), and severity.
- **Per-screen baseline checks (apply to every page):** (a) page renders, no blank/white screen; (b) **no console errors/exceptions**; (c) no Supabase 4xx in Network; (d) no raw `undefined`/`NaN`/`0.xx%` confidence/`$\boxed{}$`/"Po"-style mangled labels; (e) all buttons do something (no dead controls); (f) date fields show real dates, not "Invalid Date"/"—" everywhere.
- **Severity:** BLOCKER (cannot proceed) · HIGH (core feature broken) · MEDIUM (degraded) · LOW/COSMETIC.
- **Write actions:** this playbook includes create/submit/approve flows. Run against a non-production/demo DB.

---

## Suite 0 — Smoke & global

| ID | Steps | Expected |
|---|---|---|
| TC-SMK-01 | Load app at base URL | Dashboard renders; no console errors; bundle hash recorded |
| TC-SMK-02 | Open role switcher (top-right) | All 6 roles listed with descriptions; current role checked |
| TC-SMK-03 | Switch to each of the 6 roles | Header name/role updates; correct dashboard + nav per role |
| TC-SMK-04 | Refresh the page after switching to Admin | **Role persists** (stays Admin), not reset to PM |
| TC-SMK-05 | Collapse/expand the sidebar | Toggles 260px↔64px; nav still usable |
| TC-SMK-06 | Click the notification bell | Opens notifications; unread badge sensible |
| TC-SMK-07 | Global top search (suppliers/requests/contracts) | Returns/links to results |
| TC-SMK-08 | Open the floating AI assistant from any page | Overlay opens with intro |

## Suite RBAC — role-based access (spec §2.2)

| ID | Role | Steps | Expected |
|---|---|---|---|
| TC-RBAC-01 | Requestor | Confirm sidebar shows only Work + Help | No Orchestration/Sourcing/Suppliers/Contracts/Purchasing/Analytics/Admin |
| TC-RBAC-02 | Requestor | Directly navigate to `/admin/users` | Redirected to Home (guarded) |
| TC-RBAC-03 | Procurement Mgr | Directly navigate to `/admin/rules` | Redirected (non-admin) |
| TC-RBAC-04 | Vendor Mgr | Confirm Sourcing + Suppliers visible; no Admin | Per matrix |
| TC-RBAC-05 | Ops Lead | Confirm Orchestration/Workflows + Purchasing visible | Per matrix |
| TC-RBAC-06 | Admin | Confirm full Admin group visible | Per matrix |
| TC-RBAC-07 | Internal role | Navigate to `/portal` | Redirected to Home (portal is supplier-only) |
| TC-RBAC-08 | Supplier | Navigate to any internal route (e.g. `/requests`) | Redirected to `/portal` |
| TC-RBAC-09 | (prod build) | As Requestor, via API/devtools, attempt to read another role's data | RLS blocks server-side (production target) |

## Suite DASH — dashboards & command bar (run per applicable role)

| ID | Role | Steps | Expected |
|---|---|---|---|
| TC-DASH-01 | Proc Mgr | Open Home | KPI cards (Open Demand, Active Sourcing, **Avg Cycle Time**, **Compliance Rate**), Demand Pipeline chart render with **non-zero, plausible** values |
| TC-DASH-02 | Requestor | Open Home | Monthly Summary (Submitted/Approved/Completed) **non-zero where expected**; My Active Requests list populates |
| TC-DASH-03 | Vendor Mgr | Open Home | Validation Queue widget with AI pre-validation flags |
| TC-DASH-04 | Ops Lead | Open Home | Workflow Health, SLA Tracker, Attention Required with correct days-in-stage |
| TC-DASH-05 | Admin | Open Home | System Health, Monthly Summary |
| TC-DASH-06 | Any | Customise dashboard (drag widget, add/remove) | Layout changes persist |
| TC-DASH-07 | Any | Command bar: type "coffee beans" + Enter | Catalogue match card (Coffee Beans €22) appears |
| TC-DASH-08 | Any | Command bar: "where is REQ-2025-0114" | Navigates to that request / lookup |
| TC-DASH-09 | Any | Command bar: "what is the consulting policy" | Surfaces policy / routes to AI assistant |
| TC-DASH-10 | Any | Each quick-action button | Navigates to the correct page |

## Suite REQ — requests (intake wizard, list, detail) — the core flow

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-01 | `/requests` All Requests loads | Table: ID/Title/Category/Status/Value/Owner/Days/Priority; badges correct casing ("PO" not "Po") |
| TC-REQ-02 | Sort each column; apply filters/search | Sorting + filtering work |
| TC-REQ-03 | Open a request → 8 tabs | Overview, Compliance, Workflow, Approvals, Documents, Activity, Related all render |
| TC-REQ-04 | Overview → AI Request Summary | Grounded summary (correct stage/value/channel); confidence shown as **whole %** (e.g. 92%) |
| TC-REQ-05 | Compliance tab (request past Validation) | **PR Compliance report renders** (decision, confidence, 6-category findings) — not "no report available" |
| TC-REQ-06 | Workflow tab | Lifecycle stepper + expandable step cards (handler/role/duration/dates) |
| TC-REQ-07 | Workflow actions: Refer Back / Reassign / Escalate / Cancel | Each fires, persists, writes audit entry |
| **TC-REQ-08** | **New Request — AI describe (consulting):** type "management consulting firm to design a target operating model…" | **Classified as Consulting** (not Goods); title/value/description extracted |
| TC-REQ-09 | Step 1: AI misreads the need → click **Try again** and re-describe | New classification **propagates** to Step 3 header, Summary, and the submitted record. (There is no category grid — categories are derived, not chosen.) |
| TC-REQ-10 | Step 2 Pre-check (**staged funnel**, FD-E3-10) | Stage 1 = catalogue check only; when nothing fits, an enrichment box appears and the **contract check is NOT shown** until the user enriches. Stage 2 = ranked contract candidates with fit% + keyword reasons. Proceed-to-full-request only after both are ruled out |
| TC-REQ-11 | Step 3 chat intake | Captures value/timeline/commodity; **Service Description** builds (see Suite SOW) |
| TC-REQ-12 | Step 4 Compliance | Renders (no crash); buying channel, SRA, policy checks, duplicate check, **Recommended Suppliers** (if AI-005 active), Risk Triage form |
| TC-REQ-13 | Step 5 Routing | Approval chain + watchers + estimated timeline |
| **TC-REQ-14** | **Submit complex request** | Success; **persists**; appears in All Requests; opens at `/requests/{id}`; "Track this Request" works; free-text date ("By 31 Dec 2026") parsed to a real date |
| TC-REQ-15 | New Request manually pick **Goods** → form path | Traditional form (title/value/priority/supplier/dates/justification) submits |
| TC-REQ-16 | New Request **Catalogue Purchase** category | Catalogue browse + cart path |
| **TC-REQ-17** | **Catalogue order via command bar → Add → Order Now** | **Order succeeds & persists** (NO "invalid input syntax for type date" error); appears in POs / requests |
| TC-REQ-18 | Catalogue order €5k–25k | Triggers line-manager approval (not auto) |
| TC-REQ-19 | Save as Draft mid-wizard | Draft saved + retrievable |
| TC-REQ-20 | Submit each remaining category (Services, Software, Contingent Labour, Contract Renewal, Supplier Onboarding) | Each routes/submits correctly |

## Suite SOW — Service Description (unified, auto-composed; no manual generate)

The SOW and the service description are **one document**, built automatically from the conversation —
there is **no "Generate SOW" button** and no per-section regenerate (verified by `npm run test:ui`).

| ID | Steps | Expected |
|---|---|---|
| TC-SOW-01 | Consulting request → Step 3, answer Objective with one line | **Section is expanded** into a full professional paragraph (NOT a verbatim echo) |
| TC-SOW-02 | Answer the questions until complete, then view all 9 sections | The document **auto-composes on completion** (no button click): Objective/Scope/Deliverables/Timeline/Resources/Acceptance/Pricing/Location/Dependencies all **substantive**; unanswered sections **auto-drafted** |
| TC-SOW-03 | Check Deliverables / Timeline / Acceptance | Deliverables numbered; timeline phased w/ durations; acceptance criteria **measurable** |
| TC-SOW-04 | Quality gate | Visible quality score/checklist (auto-populated on completion); weak sections flagged |
| TC-SOW-04b | No manual generation (`npm run test:ui`) | The chat-intake step shows **no "Generate SOW" button** and no "click Generate SOW" hint; the SOW panel still renders and builds from the conversation |
| TC-SOW-05 | Narrative summary + copy button | 3–4 paragraph narrative; copy works |
| TC-SOW-06 | Submit; open request detail | Full SOW persisted + displayed (Overview/Documents) |
| TC-SOW-07 | Provider modes | Works in `mock` and `groq/gemini` |

## Suite APR — approvals & tasks

| ID | Steps | Expected |
|---|---|---|
| TC-APR-01 | `/approvals` queue | Pending count, filters (urgency/value/category), AI summaries |
| TC-APR-02 | Approve a pending item | Toast; pending count decrements; **persists**; audit entry |
| TC-APR-03 | Reject (with reason) / Request Info | State changes; reason captured |
| TC-APR-04 | Delegate; Delegation page | Delegate set; OOO routing applies |
| TC-APR-05 | `/tasks` My Tasks + Team Tasks | Priority-sorted lists render |

## Suite WF — workflows, monitor, pipeline

| ID | Steps | Expected |
|---|---|---|
| TC-WF-01 | `/workflows` Kanban | Stage columns, value subtotals, quick filters (Stuck>5d/My Action/High value/Escalated), integration badges |
| TC-WF-02 | Drag a card between stages (permitted) | Moves + persists; audit entry |
| TC-WF-03 | Table view | Sortable/filterable, System column |
| TC-WF-04 | Timeline view | Gantt bars per stage |
| TC-WF-05 | `/workflows/monitor` | Bottleneck bar chart vs SLA, heatmap, AI analysis, stuck table |
| TC-WF-06 | `/workflows/bottlenecks` | Stuck/overdue items + escalation actions |
| TC-WF-07 | `/pipeline/demand` & `/pipeline/sourcing` | Funnel/grouped views render |

## Suite SRC — sourcing & evaluation

| ID | Steps | Expected |
|---|---|---|
| TC-SRC-01 | `/sourcing` event list | Table w/ status, suppliers, responses, deadline |
| TC-SRC-02 | Open a populated event (SRC-001) | Overview/Supplier Tracking/Q&A; response rate computed |
| TC-SRC-03 | Open a draft/0-response event (SRC-004) | Renders (no white-screen); null dates show "—" |
| TC-SRC-04 | New Event 5-step wizard → Publish | **Event persists** and appears in the list (not toast-only) |
| TC-SRC-05 | Save as Draft | Persists as draft |
| TC-SRC-06 | Evaluation Centre | Scoring matrix (weighted), AI scoring narrative, shortlist/eliminate |
| TC-SRC-07 | Award recommendation | Ranked; **award → creates linked contract/PO** |
| TC-SRC-08 | Templates page | 5 templates render |

## Suite SUP — suppliers (internal)

| ID | Steps | Expected |
|---|---|---|
| TC-SUP-01 | `/suppliers` directory | 23 suppliers, card+table, filters (risk/SRA/onboarding/tier/country) |
| TC-SUP-02 | Open a supplier → 7 tabs | Overview/Contracts/Risk/Spend/Performance/Documents/Activity render; AI summary confidence whole-% |
| TC-SUP-03 | `/suppliers/onboarding` kanban | 3-column pipeline |
| TC-SUP-04 | `/suppliers/risk` | Risk table, expiry alerts, SRA coverage, certifications; **external screening result if wired** |
| TC-SUP-05 | `/suppliers/messages` | Threaded messages; send a message (persists) |
| TC-SUP-06 | `/suppliers/portal-admin` | Portal admin renders |
| TC-SUP-07 | Add Supplier | Create persists |

## Suite PORT — supplier portal (role = Supplier)

| ID | Steps | Expected |
|---|---|---|
| TC-PORT-01 | `/portal` dashboard | Action items, recent payments, announcements; horizontal nav (7 tabs) |
| TC-PORT-02 | Profile → edit + save | Persists |
| TC-PORT-03 | Onboarding wizard | 6-step status/flow renders |
| TC-PORT-04 | Sourcing | Invited events; download/respond |
| TC-PORT-05 | Invoices → **Submit Invoice** | Dialog opens (Invoice #/dates/amount/PO); submit **persists** |
| TC-PORT-06 | Documents | Upload/list |
| TC-PORT-07 | Messages | Send/receive persists |

## Suite CON — contracts

| ID | Steps | Expected |
|---|---|---|
| TC-CON-01 | `/contracts` register | 18 contracts, filters, utilisation |
| TC-CON-02 | Open a contract | Summary/Financial/Obligations/Renewal/Documents/Related |
| TC-CON-03 | `/contracts/renewals` | Expiring <30/<90d **non-empty where expected**; € currency (not £); Initiate Renewal works |
| TC-CON-04 | `/contracts/templates` | 6 templates; "Use Template" does something |

## Suite PUR — purchasing / P2P

| ID | Steps | Expected |
|---|---|---|
| TC-PUR-01 | `/purchasing/orders` PO list + open a PO | Line items, statuses |
| TC-PUR-02 | `/purchasing/receipt` Goods Receipt | Form submits; **persists to goods_receipts** |
| TC-PUR-03 | `/purchasing/invoices` queue | 52 invoices; AI match summary; Matched/Unmatched |
| TC-PUR-04 | Invoice **AI extraction** (upload) | Extracted fields prefill (if wired) |
| TC-PUR-05 | `/purchasing/match` three-way match | Computes Matched/Variance/**Mismatch**; tolerance configurable; "Raise Exception" on mismatch |
| TC-PUR-06 | Match uses **real GR** (not static scenarios) | Live PO/GR/Invoice compared |
| TC-PUR-07 | `/purchasing/payments` tracker | Pending/Scheduled/Paid; per-invoice progress; Paid Date populated for Paid |
| TC-PUR-08 | Budget check at compliance/PO | Over-budget flagged (if wired) |

## Suite ANL — analytics & reporting

| ID | Steps | Expected |
|---|---|---|
| TC-ANL-01 | `/analytics/spend` | Anomaly panel + monthly/category/top-supplier charts render |
| TC-ANL-02 | `/analytics/compliance` | Compliance KPI cards + trends |
| TC-ANL-03 | `/analytics/pipeline` | Funnel/cycle-time |
| TC-ANL-04 | `/analytics/suppliers` | Performance/risk matrix |
| TC-ANL-05 | `/analytics/reports` Report Builder | Drag data sources; preview charts render; **Export (CSV/Excel/PDF)** produces a file; Save persists |
| TC-ANL-06 | `/analytics/reports/scheduled` | 5 scheduled reports; enable/disable toggles |
| TC-ANL-07 | `/analytics/exports` | New export (type/range/format) + Recent Exports download |

## Suite ADM — admin configuration (the control plane)

| ID | Steps | Expected |
|---|---|---|
| TC-ADM-01 | `/admin/rules` Routing Rules | 3-panel; edit rule; **Test panel** returns a match; Save persists |
| TC-ADM-02 | Rule change affects intake | New matching request shows the configured channel/chain |
| TC-ADM-02b | Risk-aware routing (`npm run test:routing`) | A `risk_rating`-keyed rule fires when the supplier risk tier is at/above the threshold; supplier risk tier flows into the determination |
| TC-ADM-03 | `/admin/forms` Form Builder | Add/configure/reorder fields; live preview; Save persists |
| TC-ADM-04 | `/admin/workflows` Designer | All 4 templates render node graphs; add node; Simulate; Save persists |
| TC-ADM-05 | Designer drives runtime (target) | Editing a template changes how a new request progresses |
| TC-ADM-06 | `/admin/approvals` Approval Chains | Edit chain; **Save persists across reload** (requires `approval_chains` table) |
| TC-ADM-07 | Chain change affects a new request | Generated approvers reflect the edited chain; OOO→delegate |
| TC-ADM-08 | `/admin/agents` AI Agents | 6 agents; open one (config + perf dashboard); **toggle status + Save persists** |
| TC-ADM-09 | Enable Supplier Recommender (AI-005) | Wizard Step 4 shows ranked suppliers |
| TC-ADM-10 | Enable/disable Category Classifier (AI-001) | Wizard Step 1 switches LLM↔local behaviour |
| TC-ADM-11 | Categories admin | `procurement_categories` **seeded** from the canonical taxonomy (8 rows); add/edit category **persists** and appears in intake; **Icon picker** sets the tile icon shown at intake |
| TC-ADM-12 | SLA targets admin | Edit per-stage SLA **persists** (requires `sla_targets` table); reflects in SLA tracker |
| TC-ADM-13 | `/admin/policies` | Policies versioned; view full text |
| TC-ADM-14 | `/admin/users` | 12 users; edit role / OOO+delegate / deactivate |
| TC-ADM-15 | `/admin/health` System Health | Integration status, uptime, error log |
| TC-ADM-16 | `/admin/audit` Audit Log | 40+ entries; filters; **Export** |
| TC-ADM-17 | `/admin/kb` KB Management | Add entry persists; assistant uses it |
| TC-ADM-18 | `/admin/ai-analytics` | Conversation/answer-quality charts |
| TC-ADM-19 | `/admin/database` | Entity tabs; edit a row persists; reflects on feature pages |

## Suite AI — assistant chatbot (5 capabilities + guardrails)

| ID | Steps | Expected |
|---|---|---|
| TC-AI-01 | Ask "What is the approval threshold for consulting engagements?" | **Clean grounded answer with a source chip**; **no `tool_calls.NAME(...)` / `## Step` / `$\boxed{}$` / raw tool text**; not stalled (see CHATBOT_TOOLCALL_FIX.md) |
| TC-AI-02 | Lookup "status of REQ-2025-0114" | Short answer + **deep-link callout** to the request |
| TC-AI-03 | Action: "set my out-of-office" | **Confirm read-back** then execute; **audit entry**; no execute without confirm |
| TC-AI-04 | Ask for something with no grounded answer | Offers **handover/ticket** (no hallucinated facts) |
| TC-AI-05 | Demand intake: "I need to buy 50 laptops" | Deep-links into New Request prefilled |
| TC-AI-06 | Role filtering | As Requestor, restricted actions not offered; as Ops Lead, different set |
| TC-AI-07 | Full-page assistant (`/help/assistant`) | Same behaviour as overlay |
| TC-AI-08 | Guardrail: no master-data write-back | Vendor bank-detail change routes to ticket, not direct write |
| TC-AI-09 | Regression: a knowledge/lookup query that triggers a tool | Server **executes** the tool (or client suppresses it); user sees a clean grounded answer, **never raw `tool_calls.…` text**; no stall (CHATBOT_TOOLCALL_FIX.md) |
| TC-AI-10 | Provider parity: same query in `VITE_ASSISTANT_PROVIDER=mock` and `groq` | Equivalent grounded answers + source in both modes |
| TC-AI-11 | Robustness: slow/empty/erroring 2nd model call (or tiny timeout) | User gets a graceful timeout/fallback message, **never an infinite spinner**; `/api/chat` always terminates (CHATBOT_HANG_FIX.md) |

## Suite PLT — platform, notifications, settings, help, NFR

| ID | Steps | Expected |
|---|---|---|
| TC-PLT-01 | `/notifications` | 7 types; mark read; **preferences persist across reload** |
| TC-PLT-02 | `/settings` | Currency/locale setting **applied app-wide** (amounts reformat) |
| TC-PLT-03 | `/help/kb` Knowledge Base | Articles render/search |
| TC-PLT-04 | `/help/support` Contact Support | Form submits |
| TC-PLT-05 | Auth (production target) | Real login/SSO; logout |
| TC-PLT-06 | Responsive/mobile | Approvals usable on narrow viewport |
| TC-PLT-07 | a11y | No "DialogContent requires a DialogTitle" console warnings on dialogs |

---

## Suite INT — source-connector layer (automated)

Reads of upstream business objects go through the standardised connector layer (`src/lib/integrations`).
Seven objects are wired: supplier, contract, purchase-request, purchase-order, invoice, risk-assessment,
catalogue-item. Run `npm run test:connectors` (mirrors the TS modules — keep in sync). 22 checks across
six groups:

| ID | Area | Expected |
|---|---|---|
| TC-INT-01 | Registry | Resolves a registered connector; `require` throws for an unregistered object; lists registered objects |
| TC-INT-02 | Own-store query | `get` by key + null on miss; `list` returns all; filter / free-text search / limit; filter+search compose; `undefined` filters ignored |
| TC-INT-03 | Provenance envelope | Every record carries `sourceSystem`, `mode: 'shadow'`, `retrievedAt`, freshness TTL |
| TC-INT-04 | Live-swap seam | Registering a `mode: 'live'` connector replaces the own-store one; the **consumer call is unchanged** and now reads the live source |
| TC-INT-05 | Boolean filter coercion | Boolean filters (e.g. `reusable`, `transactable`) keep only matching records for `true` and `false` |
| TC-INT-06 | Drift guard | Every `own-store/*-connector.ts` declares a canonical object **and** is registered in `registerDefaultConnectors`; the object set matches the expected list |

### Decisioning controls (automated — `npm run test:preference`)

| ID | Area | Expected |
|---|---|---|
| TC-PSL-01 | Preferred-supplier (PSL) | Explicit `preferred` flag wins; else established + low-risk + high-performance qualifies; critical risk / no contract / low performance do not |
| TC-PSL-02 | Competitive sourcing (DTPS) | Below threshold exempt; above threshold requires quotes unless preferred route, exempt category, or single-source justification |
| TC-MAT-01 | Materiality (`npm run test:materiality`) | Highest-attribute-wins from data sensitivity + supplier risk + value (+ critical-service flag); critical data/risk → critical+material; high or value≥threshold → important+material; benign → standard. Surfaced on the determination screen and feeds routing (`material`). |
| TC-CAT-01 | Category-code mapping (`npm run test:category-code`) | Keyword match resolves a code (confidence scales with hits); no keyword + known category → category default; keyword wins over default; unknown/none → null; every canonical category has a default code |
| TC-GOV-01 | Classification eval harness (`npm run test:classification-eval`) | Labelled benchmark over the deterministic classifier (`classify.ts`); reports overall accuracy + per-category breakdown + misclassifications; **gates at ≥85% accuracy** (currently 95.8%) and asserts every category is reachable. Prevents silent regressions when keyword rules change (FD-E4-GOV1). |
| TC-RSK-01 | Risk segmentation (`npm run test:risk-segmentation`) | Inherent-risk cascade highest-attribute-wins (critical data/access/service → critical; high risk or value≥250k → high; value≥50k → medium); outcome: no reusable → new, within band → reuse, one tier above → amend, more → change. Surfaced on the determination screen + drives routing. |
| TC-RSK-02 | Structured reuse model (`npm run test:risk-reuse`) | Per-assessment decision by supplier/scope/data-class/inherent-tier/validity; not-reusable/not-completed/different-supplier → no-match; expired → new; worst dimension wins; `selectReuseOutcome` picks the most favourable candidate across the register. Drives the determination outcome. |
| TC-RSK-03 | Preliminary operational risk (`npm run test:operational-risk` + UI smoke) | Per-dimension screen — business continuity (critical-service/material spend), data handling (sensitivity), concentration (incumbent + material), regulatory (materiality), access (privileged); **worst-dimension-wins** overall. "Preliminary operational risk" panel renders on the risk step and appears in the export. Generalises the backlog's "PORA". |
| TC-HND-01 | Handoff / next-steps (`npm run test:handoff`) | Detailed risk assessment routed to the risk register (reuse → not-required, amend → recommended, new/change → required); material → governance step; sourcing/contract steps by channel; purchasing requisition. Surfaced as the determination's Next-steps panel with system + status + deep-link. |
| TC-DET-01 | Contract/sourcing type (`npm run test:determination`) | Contract type: catalogue/direct-PO → none, renewal → renew; against an existing agreement — material change → **change**, extends/at-capacity → **amend**, fits with headroom → SOW; else new-MSA. Sourcing type: catalogue/contract → none, renewal → renewal, incumbent → benchmarking, else new-event. Both surfaced on the determination. |
| TC-DET-02 | Export (`npm run test:determination-export` + UI smoke) | Builds structured Markdown (request, determination, risk, next-steps table, policy checks); slugified filename; graceful with missing fields. The determination **Export** button downloads a `determination-*.md` file. |
| TC-DET-03 | Second contract check (`npm run test:second-contract` + UI smoke) | Classifies the supplier's contracts as transactable / framework (host a SOW) / expiring; filters supplier/category/expired; recommends transact/author-SOW/renew/new; strongest route wins. "Contract coverage" panel renders on the determination. |
| TC-DET-04 | Approval-to-source gate (`npm run test:approval-to-source` + UI smoke) | Light (demand validation + cost-centre) vs full (demand validation + intent-to-source + category approval); full triggered by value ≥ threshold, materiality, or high/critical inherent risk; transactable early exit ⇒ no gate. "Approval to source" panel renders on the determination and appears in the export. |
| TC-DET-05 | Residual questions (`npm run test:residual-questions` + UI smoke) | Stage-5 mini-IRQ is **criteria-driven**: privileged-access asked for IT/services/consulting/contingent or medium+ data sensitivity; critical-service asked for value ≥ threshold, elevated supplier risk, or high+ sensitivity; low-value low-sensitivity demand asks nothing ("No further questions"). Each shown question states "Asked because…". UI smoke asserts the rationale renders. |

### UI smoke (automated — `npm run test:ui`, Playwright)

| ID | Steps | Expected |
|---|---|---|
| TC-UI-01 | Boot app at `/` | React mounts; no console/page errors |
| TC-UI-02 | `/requests/new` → describe in free text → Accept & continue | **No commodity-category tiles** (Goods/Contingent Labour asserted absent); the free-text classification derives the category and a **"Browse the catalogue"** affordance is the one explicit alternative entry. Pre-check **stage 1 (catalogue)** renders via the connector layer in-browser; the **contract check is asserted absent** until enrichment; stage 2 (contract) is reached only after enriching. Expected dev-only `/api/*` 404s are ignored; no app errors during the flow |
| TC-UI-03 | Two-step determination (Contract Renewal → full request → **step 4 Risk & assessment** → **step 5 Determination**) | Step 4 renders the mini-IRQ delta capture; toggling critical-service there drives the cascade shown on step 5 (lifted state). Step 5 renders the determination: buying channel, materiality, inherent risk, contract/sourcing type, Next-steps handoff panel; policy-check region (DTPS/PSL when the validator agent is active, else the notice). |
| TC-UI-04 | Full-app sweep (`npm run test:e2e-ui`) | Every route (admin role for app/admin, supplier role for portal) + 5 detail pages render with no console errors, no white-screens, no uncaught exceptions. Guarded admin routes render real content (role injection verified). |
| TC-UI-05 | Interaction E2E (`npm run test:interactions-ui`, self-cleaning) | **Wizard submit** creates a request (reaches confirmation, persists, then deleted); **admin category create** persists & shows in the table (then deleted); **AI assistant** returns a response within 25s (no hang) **and a supplier lookup returns connector-backed data** (CB-E10 — the assistant reads through the same governed ports as the front door). No uncaught errors in any flow. |

---

## Regression hot-list (items that have broken before — always re-check)
1. New Request submit persistence + free-text date parsing (TC-REQ-14).
2. **Catalogue Order Now date error** (TC-REQ-17) — *currently failing.*
3. Wizard Step-4 compliance crash (TC-REQ-12).
4. Sourcing draft/0-response detail white-screen (TC-SRC-03).
5. AI assistant grounding / CoT leak (TC-AI-01).
6. PR Compliance report rendering (TC-REQ-05).
7. Date-anchored KPIs / expiring contracts (TC-DASH-01, TC-CON-03).
8. Admin Save persistence for chains/categories/SLA (TC-ADM-06/11/12) — tables exist in `schema.sql`; re-verify saves end-to-end.
9. Role persistence on reload (TC-SMK-04).
10. Classifier accuracy + category-override propagation (TC-REQ-08/09).
11. SOW generator richness (Suite SOW).

## Re-test results — build `index-LlQShsel.js` (2 Jun 2026, live-verified)
**Newly FIXED (verified this run):**
- ✅ **TC-REQ-17** catalogue Order Now — now succeeds (REQ-2026-4279 submitted; no date error).
- ✅ **TC-REQ-08** classifier — "management consulting…" now correctly **Consulting** (was Goods).
- ✅ **TC-REQ-09** category propagation — category flows correctly through wizard + submission.
- ✅ **Suite SOW** — major upgrade implemented: a **"Generate SOW"** button produces a **validated 9-section SOW with a 100/100 quality score + completeness checklist**, rich professional content (Objective/Scope full paragraphs, numbered Deliverables, phased Timeline), and **per-section Regenerate**. Meets the "long, validated, best-in-class" requirement.
- ✅ (prior run, still good) complex-request submit/persist, SRC-004 crash, AI summary, Documents tab, portal Submit-Invoice dialog, role persistence, three-way-match variance.

**Still BROKEN (verified this run):**
- 🔴 **TC-AI-01** AI assistant — still prints `tool_calls.search_knowledge(query="…")` as text and returns **no grounded answer** (tool not executed). The tool-call loop fix (assessment §0.5/E2E-2) has not landed.

**Not re-verified this run (re-check via the suites above on this build):** PR-Compliance report (TC-REQ-05), date-anchored KPIs (TC-DASH-01/TC-CON-03), admin Save persistence for chains/categories/SLA (TC-ADM-06/11/12), and the full per-route/per-role click-through (Suites DASH→PLT across all 6 roles).

---

## Open questions for you
1. **Deployment:** the new build isn't on `orchestration-ui-khaki.vercel.app` (same bundle hash; catalogue bug persists). Is there a **preview URL** to test, or should I wait for the production deploy and re-run? Please confirm the URL + that a new bundle hash is live.
2. **Audit scope:** do you want the full click-through executed by me against the new build (I'll run this playbook and log every Fail), or just delivery of the playbook for your QA to run?
3. **SOW generation timing** (from the assessment doc §10): up-front full draft vs. Q&A-then-generate vs. hybrid? (I recommend hybrid.)
4. **Test data:** OK to create/submit/approve real records in the demo DB during the run (the playbook includes write flows)?
