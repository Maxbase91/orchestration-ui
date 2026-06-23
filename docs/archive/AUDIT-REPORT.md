# Functional Audit — Procurement Orchestration UI

**Target:** https://orchestration-ui-khaki.vercel.app/ (deployed Vercel build)
**Date of audit:** 1 June 2026
**Method:** Live black-box testing in Chrome (all 6 roles) + white-box codebase cross-reference (`src/`)
**Scope requested:** Full holistic sweep, all roles, deep interactions. Findings reported with a fix-brief for Claude Code (no code changed during the audit).

---

## 1. Executive Summary

The platform is broad and largely well-built: role-based dashboards, the Kanban workflow board, supplier directory/profiles, routing-rules engine, workflow designer, analytics dashboards, sourcing evaluation, and the supplier portal all render and behave close to spec. AI intake classification and conversational extraction in the New Request wizard are genuinely strong.

However, the audit found **two release-blocking defects and several high-severity issues** that break core promises of the product:

1. **BLOCKER — New Request wizard crashes at the Compliance step** (React infinite-render loop). A user cannot complete a full (non-catalogue) request. This is the platform's primary flow.
2. **CRITICAL — No route-level access control.** Any role can reach admin-only screens (e.g. `/admin/users` with Add/Deactivate/Reset-PW) by typing the URL. The sidebar hides links but nothing guards the route.
3. **HIGH — AI Assistant tool-calling is broken in production (Groq).** It prints the tool call as text ("search_knowledge: …") and stalls; no grounded answer ever returns. Fails the Claude Code brief's acceptance scenarios.
4. **HIGH — Three-Way Match reports "Matched" on a €360k mismatch.** Match flags are not computed from PO/GR/Invoice values, defeating the financial control.
5. **HIGH — Reporting export/exports are stubs** ("coming soon" toasts; no file generation).

A second, pervasive theme is **date-anchoring**: the demo data is dated 2024–2025 while the system clock is June 2026. Every "current-month / trailing-window / expiring-soon" computation therefore reads empty or "overdue", making several headline widgets look broken (Compliance Rate 0%, Avg Cycle Time 0 days, Monthly Summary 0/0/0, "expiring within 90 days" = 0, most 12-month spend €0). The logic is correct; the data needs re-anchoring to "now" (or pin a fixed demo "today").

**Tally:** 1 Blocker · 1 Critical · 5 High · 6 Medium · 4 Low/Cosmetic · plus spec-deviations and date-anchor cascade.

---

## 2. Severity Index

| ID | Severity | Area | One-line |
|----|----------|------|----------|
| F14 | **BLOCKER** | Requests / Intake | New Request Step 4 (Compliance) crashes — React #185 infinite loop |
| F7 | **CRITICAL** | Security / RBAC | No route guards; any role opens `/admin/*` by URL |
| F18 | HIGH | AI Assistant | Groq tool-calling broken — leaks tool call as text, never answers |
| F20 | HIGH | Purchasing | Three-Way Match shows "Matched" despite €360k invoice-vs-PO gap |
| F8 | HIGH | Analytics | Report Builder Export/Schedule/Save are toast stubs |
| F9 | HIGH | Analytics | Exports page download disabled / not implemented |
| F12 | HIGH | AI Assistant | Assistant actions are not role-gated (guardrail gap) |
| F1 | MEDIUM | Dashboard | Avg Cycle Time 0d & Compliance Rate 0% (date-anchor) |
| F3 | MEDIUM | Dashboard | Monthly Summary 0/0/0 on every role (date-anchor) |
| F13 | MEDIUM | Contracts | "Expiring soon" empty, 14 expired (date-anchor) |
| F16 | MEDIUM | Requests | Detail page has 5 tabs; spec requires 8 (no Compliance/Documents tab) |
| F21 | MEDIUM | Admin | Workflow Designer: "Catalogue Purchase" template canvas empty |
| F22 | MEDIUM | Sourcing | Listed event SRC-004 opens to "event not found" |
| F15 | MEDIUM | AI / UI | Confidence rendered as "0.92% Low" (should be ~92%) — systematic |
| F4 | MEDIUM | Command bar | No inline catalogue match while typing (requires Enter+AI) |
| F5 | LOW | Catalogue | Cart qty display desync (card stepper vs order line) |
| F6 | LOW | Global | Status badge casing: "Po" instead of "PO" (systematic) |
| F17 | LOW | Requests | All Requests table: sort/advanced-filter not evident |
| F19 | LOW | Contracts | "Total Renewal Value £0" uses £ (GBP) not € (EUR) |
| F10 | (code) HIGH | Sourcing | New Event Publish/Save don't persist (toast only) |
| F11 | (code) MEDIUM | Sourcing | Event detail divide-by-zero risk on 0-response events |

---

## 3. Findings (detail)

### F14 — BLOCKER: New Request wizard Step 4 (Compliance) crashes
**Repro:** `/requests/new` → describe "We need someone to review our cybersecurity posture" → *Accept & continue* → Pre-check → *Proceed to full request* → answer budget/timeline in chat → *Next*. Step 4 ("Supplier, risk, sourcing") renders the error boundary: *"Something went wrong in this step — Minified React error #185"* + *Start Over*.
**Console:** `Step error: … Minified React error #185` (Maximum update depth exceeded) with an `Array.map` render loop.
**Root cause (code-confirmed):** `src/features/requests/new-request/step-compliance.tsx` (~L233–237) destructures react-query hooks with default empty arrays — `const { data: suppliers = [] } = useSuppliers();` (also `matches`, `routingRules`, `workflowTemplates`). When data is `undefined`/loading, `= []` creates a **new array reference each render**; those vars are in the `useMemo` deps (~L301), so `result` recomputes every render, the effect (~L308) calls `onUpdate(result)` → `updateFormData` → parent re-render → infinite loop.
**Impact:** No role can complete a full (non-catalogue) request. Primary flow broken.

### F7 — CRITICAL: No route-level access control
**Repro:** As **Procurement Manager** (a non-admin), navigate directly to `https://…/admin/users`. The full **User Management** admin screen renders (12 users, *Add User*, *Edit Role*, *Reset PW*, *Deactivate*). Sidebar correctly hides the link, but the route is unguarded.
**Root cause:** `src/App.tsx` mounts every route under one `<AppLayout>` with no per-route role guard. `app-layout.tsx` only redirects the `supplier` role to `/portal`. (Note: `/portal` *is* guarded against non-suppliers — the inverse works.)
**Impact:** Permission matrix (spec §2.2) is unenforced for `/admin/*`, `/analytics/*`, etc. via direct URL.

### F18 — HIGH: AI Assistant tool-calling/grounding broken (deployed Groq mode)
**Repro:** Open AI overlay → "What is the approval threshold for consulting engagements?" → reply: *"I'll search for the relevant policy. / search_knowledge: approval threshold for consulting engagements / Please wait for the results."* then stalls forever. No answer, no source chip, no deep-link. Reproduced on a second query.
**Network:** exactly **one** `POST /api/chat → 200`, then nothing — the model emits the tool call as plain **text** rather than a structured tool_call; the client never executes `search_knowledge` nor makes the follow-up call with results.
**Impact:** Core assistant capability non-functional in prod; fails the Claude Code brief strawman scenario 1. Could not reach propose/confirm/execute or deep-link turns because the loop stalls at the first tool call. (Recent commits b31ccad/f23835e attempted to fix tool-calling + add a Gemini fallback — still failing on this deploy.)
**Suggested triage:** test with `VITE_ASSISTANT_PROVIDER=mock` to isolate UI vs provider; fix tool-call parsing / the second round-trip in `api/chat.ts` + `src/lib/assistant/groqProvider.ts`.

### F20 — HIGH: Three-Way Match reports "Matched" on large mismatch
**Repro:** `/purchasing/match`, INV-001 vs PO-001. Matrix: Total Amount PO €480,000 / GR €480,000 / **Invoice €120,000** → labelled **"Matched"** (green). Line Items and Invoice Date (15 Jun / 30 Sep / 01 Oct 2024) likewise "Matched". *Auto-Approve* is offered.
**Assessment:** match flags appear hardcoded to "Matched" rather than computed by diffing PO/GR/Invoice. Spec §10.2 expects Matched/Partial/Unmatched/Variance with a variance amount (e.g. INV-002 AWS €2,400 variance; INV-011 Accenture unmatched). A €360k gap auto-approvable defeats the control.

### F8 / F9 — HIGH: Reporting export is non-functional
- **F8 Report Builder** (`/analytics/reports`): *Export* → toast "Export functionality coming soon"; *Schedule* → "coming soon"; *Save Report* → success toast with no persistence; format buttons → "`<fmt>` export coming soon". (`report-builder-page.tsx`.) Preview charts themselves do render once animation completes.
- **F9 Exports page** (`/analytics/exports`): download disabled, title "Export download ships with the reporting phase"; `handleExport` only toasts. No xlsx/pdf/csv generation anywhere in analytics.
**Impact:** Spec §11.3/§11.4 (PDF/Excel/CSV export, scheduled reports) advertised but not implemented.

### F12 — HIGH: AI Assistant actions not role-gated
**Code:** `src/lib/assistant/capabilities/action.ts` `executeAction` has no role checks. A Requestor could propose/execute `approver_substitution`, `reassign_request`, `request_risk_reassessment`, etc. Confirm-before-execute **is** present (good) and there is no master-data write-back (good), but the brief requires role-filtered actions ("a requestor gets 'raise a demand'; an Operations Lead does not"). (Live verification blocked by F18.)

### F1 / F3 / F13 — MEDIUM: Date-anchor cascade (data dated 2024–25 vs clock June 2026)
- **F1** Home (Procurement Manager): **Avg Cycle Time 0 days**, **Compliance Rate 0%**. `use-live-kpis.ts` derives these from completed requests in the trailing-12-month window ending "now"; no completed requests fall in Jul 2025–Jun 2026 → 0. (Open Demand, which is date-agnostic, renders 26/€6.877M correctly.)
- **F3** **Monthly Summary** widget shows Submitted/Approved/Completed = 0 on every role (counts "this calendar month" = June 2026 = empty).
- **F13** `/contracts/renewals`: Expiring <30d = 0, <90d = 0, **Expired = 14**; rows read "152d overdue" etc. Spec §9.1 expected 3 contracts expiring soon. The dashboard "Expiring Contracts (90d)" widget will be empty too.
**Note:** time-in-stage / overdue logic on the Ops dashboard and Kanban works correctly (42d, 35d) — so the issue is specifically computations keyed to *current month / future window*. **Fix = re-anchor demo data relative to today, or pin a fixed demo "today".** Logic is sound.

### F16 — MEDIUM: Request Detail has 5 tabs, spec requires 8
**Actual:** Overview, Workflow, Approvals, Activity, Links. **Spec §4.6:** Overview, Compliance, Workflow, Comments, Approvals, Documents, Related, Audit. Missing dedicated **Compliance** tab (the PR Compliance Agent 6-category report — a headline feature, §6.3) and **Documents** tab; Comments+Audit appear merged into "Activity"; Related→"Links". The PR Compliance report isn't surfaced as described — confirm it exists anywhere in the UI. (Lifecycle stepper + expandable step cards per §5.4 work.)

### F21 — MEDIUM: Workflow Designer "Catalogue Purchase" template empty
`/admin/workflows`: selecting **Catalogue Purchase** → blank canvas + blank minimap (even after fit-view). **Standard Procurement** renders the full graph correctly. So the designer works; Catalogue Purchase (and possibly Contract Renewal / Supplier Onboarding) templates have no node data. Verify seed rows in `workflow_templates`.

### F22 — MEDIUM: Listed sourcing event 404s
`/sourcing` lists 6 events; clicking **SRC-004** (Draft, 0 suppliers) → *"Sourcing event not found."* SRC-001 opens fine (Response Rate 50% = 3/6 computed correctly). List and detail read inconsistent data, or detail omits Draft/0-supplier events. A listed row that 404s is a broken link.

### F15 — MEDIUM: AI confidence rendered as a sub-1 percentage
AI cards show "**0.92% Low**" / "**0.82% Low**" (Request Detail summary, Supplier 360 summary, Evaluation Centre). The 0–1 confidence fraction is printed with `%` without ×100; should read ~92%/82%, and the "Low" label is wrong for high confidence. Systematic across all AI summary cards — single shared formatter to fix.

### F4 — MEDIUM: Command bar not inline-as-you-type (spec deviation)
Spec §4.1: typing "coffee" should show up to 3 inline catalogue matches live. Actual: nothing while typing; on **Enter** it runs AI "Analysing…" then shows category tiles + the Coffee Beans card (works, with cart + correct "<€5k no approval"). Behaviour is arguably better but differs from spec and adds latency. Minor: the AI label said "office supplies" while correctly showing Catering & Pantry/coffee.

### F5 / F6 / F17 / F19 — LOW / Cosmetic
- **F5** Catalogue cart: after qty 2 + Add, the card stepper resets to "1" while the order line shows "2 × €22 = €44" — display desync.
- **F6** Status badge casing: PO-stage badge renders "**Po**" (title-case) across Requestor widget and All Requests list — acronym mangled by a generic capitalize().
- **F17** All Requests table: spec §5.1 promises multi-column sort + advanced filtering; no filter controls visible and sort affordance unconfirmed — verify.
- **F19** `/contracts/renewals` "Total Renewal Value **£0**" uses GBP symbol; rest of app is €.

### F10 / F11 — flagged from code (not fully UI-walked)
- **F10** `new-event-page.tsx` Publish/Save Draft only toast + navigate; no persistence — a published event won't appear in the list.
- **F11** `event-detail-page.tsx:181` `responseRate / event.supplierResponses.length` has no zero-guard → NaN/Infinity for 0-response events (currently masked because such events 404 — see F22; still worth guarding).

---

## 4. What works well (PASS)

- All 5 internal-role dashboards: correct widgets, quick actions, role-filtered sidebar (matches spec §3.2/§3.3); no console errors on load.
- New Request **Steps 1–3**: AI classification (cybersecurity→Consulting @90%), contract call-off pre-check, AI chat intake extracting value/timeline + auto commodity code (81111800). Excellent.
- Active Workflows Kanban: stage columns, value subtotals, quick filters, system-integration badges (Coupa/Ariba), Kanban/Table/Timeline toggle.
- Supplier Directory (23, filters, grid/table) + 7-tab Supplier 360 profile.
- Routing Rules Engine 3-panel + working Test panel; Workflow Designer canvas (Standard Procurement graph, 10-node palette, fit-view, minimap).
- Spend Overview (anomaly AI + monthly/category/top-supplier charts); Evaluation Centre (AI scoring narrative + editable weighted matrix).
- Sourcing event list + populated event detail (response-rate math correct).
- Supplier Portal: distinct layout, 7-tab horizontal nav, isolation from internal app; portal correctly guards non-suppliers.
- Role switcher across all 6 roles.

---

## 5. Coverage & limitations

- **Deep-tested:** dashboards (5 roles), command bar + catalogue cart, New Request wizard (steps 1–4), a request detail (Overview/Workflow), AI assistant chat, Active Workflows Kanban, Supplier Directory + profile, Routing Rules + test, Workflow Designer (2 templates), Three-Way Match, Spend dashboard, Report Builder, Contract Renewals, Sourcing list + detail + Evaluation Centre, User Management, Supplier Portal (dashboard + onboarding), route-guard bypass.
- **Code-scanned** (white-box): data layer, KPI derivation, role guards, AI guardrails, export stubs, date logic, div-by-zero.
- **Load-verified / not deep-tested this pass** (recommend a follow-up sweep): Approvals & Delegation, Tasks (my/team), Pipeline (demand/sourcing), Bottlenecks, Supplier Onboarding/Risk/Messages pages, Contract Register & detail, PO list/detail + Goods Receipt, Invoice Queue + Payment Tracker, Analytics (Compliance/Pipeline/Supplier-Performance dashboards), Admin (Form Builder, Approval Chains, AI Agents, Policy Management, System Health, Audit Log, KB Admin, Database Admin, AI Analytics), portal Profile/Sourcing/Invoices/Documents/Messages, Notifications, Settings, Help.
- **Tooling note:** no state-changing/write actions were fired (a permission prompt to do so failed to reach the user); flows were driven up to the final confirm/submit. The Chrome `find` tool was unavailable (org OAuth restriction) so `read_page`/screenshots/JS were used.

---

## 6. Fix-brief for Claude Code

Ordered by priority. Each item is self-contained.

**P0 — Unblock the intake wizard (F14).**
In `src/features/requests/new-request/step-compliance.tsx`, stop creating new array references each render. Either (a) define module-level constants `const EMPTY: T[] = []` and destructure `const { data: suppliers = EMPTY } = useSuppliers()` for every query (suppliers, matches, routingRules, workflowTemplates, validatorAgent), or (b) drop the `= []` defaults at the call site and coalesce inside the `useMemo` (`const list = suppliers ?? []`), keeping only stable references in the `useMemo` dependency array. Then confirm the `useEffect` that calls `onUpdate(result)` only fires when `result` actually changes (guard with a deep/stable compare or include only primitive deps). Verify by completing the wizard end-to-end for a Consulting request.

**P0 — Add route-level RBAC (F7).**
Introduce a guard wrapper (e.g. `<RequireRole roles={[...]}>`) or a loader/guard in `src/App.tsx`/`app-layout.tsx` that checks `useAuthStore().currentRole` against each route's `visibleTo` (reuse the `navigation.ts` metadata as the single source of truth). Redirect unauthorized direct-URL access to `/` (or a 403 page). Cover all `/admin/*`, `/analytics/*`, `/workflows/*`, `/sourcing/*`, `/suppliers/*`, `/contracts/*`, `/purchasing/*` per the spec §2.2 matrix.

**P1 — Fix AI assistant tool-calling (F18).** In `api/chat.ts` + `src/lib/assistant/groqProvider.ts`, ensure the model returns structured tool_calls (set tools + `tool_choice: "auto"`), the client executes the tool against mock/Supabase data, and a **second** `/api/chat` call is made with the tool result and `tool_choice: "none"` to produce the grounded answer. Add a fallback so that if the provider emits a tool call as text, it is parsed/executed rather than shown. Validate the 4 strawman scenarios in both `mock` and `groq` modes.

**P1 — Compute Three-Way Match status (F20).** Replace hardcoded "Matched" labels with a comparator that diffs PO vs GR vs Invoice (amount, line items, dates) and yields Matched / Partial / Unmatched / Variance (+ variance amount), per spec §10.2. Gate Auto-Approve behind a clean match.

**P1 — Implement or hide reporting export (F8/F9).** Either wire real export (the repo already depends on `docx`/`pptxgenjs`; add `xlsx`/CSV/PDF generation) for Report Builder + Exports + audit log, or disable/relabel the buttons honestly until shipped. Remove "coming soon" toasts from primary CTAs.

**P1 — Role-gate assistant actions (F12).** In `src/lib/assistant/capabilities/action.ts`, filter both offered and executable actions by `currentRole` against the permission matrix before building/executing them.

**P2 — Re-anchor demo data (F1/F3/F13 + €0 spend).** Shift seed dates so they are relative to "now" (e.g. generate dates as offsets from `new Date()` at seed time), or introduce a single configurable "demo today" used by all date math. This single change fixes Compliance Rate, Avg Cycle Time, Monthly Summary, Expiring-Contracts, and most 12-month spend zeros.

**P2 — Request Detail tabs (F16).** Add the missing **Compliance** tab (surface the PR Compliance Agent report, §6.3) and **Documents** tab, or update the spec if the merge into Activity/Links is intentional.

**P2 — Misc:** seed nodes for all Workflow Designer templates (F21); fix list/detail data source for sourcing so listed events open (F22); fix the AI confidence formatter to `Math.round(conf*100)%` with a correct Low/Med/High band (F15); persist sourcing New Event publish/save (F10); guard the response-rate division (F11).

**P3 — Polish:** status-badge acronym handling ("PO" not "Po", F6); EUR symbol on Total Renewal Value (F19); catalogue cart qty display sync (F5); add table sort/filter to All Requests (F17); decide whether command-bar live inline matching is required (F4).
