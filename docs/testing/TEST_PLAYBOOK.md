# Procurement Orchestration UI — Full Test Playbook

**Purpose:** a complete, repeatable regression script covering every page, role, and path in the application. Run it end-to-end before each release (or after major changes) to confirm nothing is broken.
**App:** orchestration-ui · **Last updated:** 30 August 2026

The roadmap status and implementation references are maintained in the [R1 roadmap](../roadmap/R1_BACKLOG_FIT_GAP.md)
and its [implementation evidence index](../roadmap/R1_IMPLEMENTATION_EVIDENCE.md).

> **Deployment note (30 Aug 2026):** the current live alias is `https://orchestration-ui.vercel.app` and the latest verified deployment is commit `0bf9a93`.

---

## How to use this playbook

- **Environments:** record the URL + JS bundle hash (DevTools → Sources, or `document.querySelector('script[src*="/assets/"]').src`) so you know which build you tested.
- **Roles (6):** Requestor/End User · Strategic Procurement Manager · Vendor Manager · Procurement Operations Lead · Supplier (External) · Admin/Platform Owner. Switch via the top-right role switcher.
- **For each test:** follow Steps, compare to **Expected**, mark **Pass / Fail / Blocked**. On Fail, capture: route, role, screenshot, console error (DevTools console), network status (for `/api/db` or other API failures), and severity.
- **Per-screen baseline checks (apply to every page):** (a) page renders, no blank/white screen; (b) **no console errors/exceptions**; (c) no unexpected API 4xx/5xx; (d) no raw `undefined`/`NaN`/`0.xx%` confidence/`$\boxed{}$`/"Po"-style mangled labels; (e) all buttons do something (no dead controls); (f) date fields show real dates, not "Invalid Date"/"—" everywhere.
- **Severity:** BLOCKER (cannot proceed) · HIGH (core feature broken) · MEDIUM (degraded) · LOW/COSMETIC.
- **Write actions:** this playbook includes create/submit/approve flows. Run against a non-production/demo DB.

## Suite NEON — database migration and cutover

Run `npm run test:neon-migration` before any live copy. It verifies the dependency, environment
contract, non-destructive migration script, API relation/function allowlists, and ADR. With a Neon
connection configured, run `npm run migrate:supabase-to-neon` and retain its source/target count
report, then run `npm run test:neon-live` for read-only schema, relationship, and catalogue-governance
checks. If the source catalogue predates explicit governance columns, run
`npm run backfill:neon-catalogue-governance` before that validation. Validate representative request,
catalogue, contract, risk, PR, PO, audit, ticket, and conversation records before switching
`DATABASE_PROVIDER` and `VITE_DATABASE_PROVIDER` to `neon`.

For the atomic checkout tranche, run `npm run test:governed-checkout-atomic` and
`npm run test:policy-config-server` with Neon configured. These are self-cleaning live checks: they
exercise transaction writes, safe replay, conflicting-key rejection, concurrency, and policy
singleton validation, then restore/remove their uniquely prefixed test data.

For contract-aware matching, run `npm run test:contract-matching` for deterministic rules and
`npm run test:contract-match-api` for the read-only Neon endpoint. Verify that generic descriptions
such as “we need consulting” ask for a deliverable and context; a description with service,
deliverable and context returns explainable candidates; exclusions, geography, effective dates and
incomplete scope route to full intake. Contract detail’s Coverage & Matching tab is the maintenance
surface for narratives, deliverables and exclusions. Governed checkout must be re-run for a
contract call-off after any scope edit and reject a stale or low-confidence client selection.

Run `npm run test:vercel-functions` before deployment to keep the explicit API surface within the
Vercel Hobby plan's twelve-function limit; low-volume routes are dispatched through one allowlisted
catch-all function.

The browser must never contain `DATABASE_URL`, `NEON_DATABASE_URL`, or a service-role key. Supabase
variables are retained only for rollback/comparison; Neon is the active R1 database. Because the
historical cutover had no write freeze, retain the migration mismatch report for audit.

---

## Suite 0 — Smoke & global

### Dual-mode experience checks

These checks cover the adaptive requester journey introduced alongside the retained Expert wizard.
The mode is presentation-only: changing it must never alter the role or the actions available to that
role. Pilot exposure is controlled by `VITE_SIMPLE_EXPERIENCE_ENABLED`, optional user/role allowlists,
and the existing `user_preferences.prefs.requestExperienceMode` JSON key.

| ID | Steps | Expected |
|---|---|---|
| TC-MODE-01 | Sign in as a requester (`service-owner`) and open New Request | Simple view is selected by default; the mode switch is visible and keyboard accessible |
| TC-MODE-02 | Sign in as procurement, operations, vendor, or admin | Expert view is selected by default and the existing seven-stage wizard is unchanged |
| TC-MODE-03 | Switch Simple ↔ Expert, refresh, then switch roles | Preference persists for the user; permissions and navigation remain role-driven |
| TC-MODE-04 | Simple intake: describe catalogue, contract-covered, P-card-eligible, and new needs | One recommended route is shown with a plain-language explanation; only route-specific fields are requested |
| TC-MODE-05 | Simple intake: use an ineligible P-card category/value | P-card is not offered and the reason is explained; no payment or upstream write occurs |
| TC-MODE-06 | Simple request detail | Status, owner, due date, value, supplier, summary, route, and next action are visible; internal workflow/approval/configuration controls are absent |
| TC-MODE-06a | Simple home | A clear Start a request entry point, requester-owned active/recent requests, and help links are shown; Expert customization, pipeline KPIs, and operational widgets are hidden |
| TC-MODE-06b | Simple home → Start with this | The typed demand opens directly on route evaluation, the original text is visible in the checking context, and the duplicate describe/classify screen is skipped |
| TC-MODE-07 | Expert request detail deep link | All seven tabs remain available; workflow opens at the current stage and duplicated action/approval/compliance panels are absent |
| TC-MODE-08 | Resize to 320px and 375px | Sidebar becomes a drawer, menu button is labelled, controls remain reachable, and no horizontal overflow occurs |

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
| TC-SMK-08b | The floating AI assistant button must not obstruct another control's actionable area | Fixed `bottom-6 right-6`, present on every route (both `AppLayout` and `SupplierPortalLayout`); regression was the wizard's own Next/Submit button becoming unclickable underneath it on a wide step (see TC-UI-01b, `npm run test:ui`) |

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
| TC-RBAC-09 | Deferred authentication boundary | As a simulation user, verify role switching changes presentation only and does not claim to provide authorization | Authentication, server-derived roles, and cross-user isolation are explicitly deferred; role switching remains a documented R1 simulation mechanism |

## Suite DASH — dashboards & command bar (run per applicable role)

| ID | Role | Steps | Expected |
|---|---|---|---|
| TC-DASH-01 | Proc Mgr | Open Home | KPI cards (Open Demand, Active Sourcing, **Avg Cycle Time**, **Compliance Rate**), Demand Pipeline chart render with **non-zero, plausible** values |
| TC-DASH-01b | Proc Mgr | "Active Sourcing" counts **events**, not requests | The tile counts `sourcing_events` in published / in-evaluation / award-pending. Cross-check against `/sourcing`: a request sitting in the sourcing stage whose event is still a **draft** must NOT be counted, and neither must a completed or cancelled event. The same figure appears on the pipeline analytics page |
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
| **TC-REQ-08a** | **Classifier provider migration** (`npm run test:ai-api-config`) | Missing server configuration yields the controlled 503; the Groq classifier default is the supported `openai/gpt-oss-20b` replacement, overridable through the server-only `GROQ_MODEL` variable |
| TC-REQ-09 | Step 1: AI misreads the need → click **Try again** and re-describe | New classification **propagates** to Step 3 header, Summary, and the submitted record. (There is no category grid — categories are derived, not chosen.) |
| TC-REQ-10 | Step 2 Pre-check (**staged funnel**, INT-10) | Stage 1 = catalogue check only; when nothing fits, an enrichment box appears and the **contract check is NOT shown** until the user enriches. Stage 2 = ranked contract candidates with fit% + keyword reasons. Proceed-to-full-request only after both are ruled out |
| TC-REQ-11 | Step 3 chat intake | Captures value/timeline/commodity; **Service Description** builds (see Suite SOW) |
| TC-REQ-11b | Step 3 dynamic conversation (`npm run test:demand-conversation`) | The next question is **answer-driven**, not a fixed script: already-answered facts are **carried forward** (never re-asked); questions **branch on category + value** (high-value consulting also asks timeline / acceptance / pricing / dependencies; low-value goods asks only the essentials). The same engine drives the LLM endpoint and the offline fallback. Requester location and "who it's for" are **never** asked here. |
| TC-REQ-11c | Requester context block (`npm run test:ui`) | On Step 3 (all paths) a context card shows **Requesting from** = the requester's country, **auto-derived from their profile and read-only** ("from your profile" tag); **Buying for** defaults to **self** with a **Change** control → name type-ahead over the directory (external supplier excluded) to buy on behalf of someone else. Captured fields persist on the request and surface on the detail overview (Requester Location / Buying For). |
| TC-REQ-12 | Step 4 Compliance | Renders (no crash); buying channel, SRA, policy checks, duplicate check, **Recommended Suppliers** (if AI-005 active), Risk Triage form |
| TC-REQ-13 | Step 5 Routing | Approval chain + watchers + estimated timeline |
| **TC-REQ-14** | **Submit complex request** | Success; **persists**; appears in All Requests; opens at `/requests/{id}`; "Track this Request" works; free-text date ("By 31 Dec 2026") parsed to a real date |
| **TC-REQ-14a** | **Approval-chain persistence** (`npm run test:approval-chain-persistence`) | The value-banded `approval_chains.id`, not a routing-rule role label, is written to `requests.approval_chain`; a self-cleaning database insert proves the foreign key round-trips |
| TC-REQ-15 | New Request manually pick **Goods** → form path | Traditional form (title/value/priority/supplier/dates/justification) submits |
| TC-REQ-16 | New Request **Catalogue Purchase** category | Catalogue browse + cart path |
| **TC-REQ-17** | **Catalogue order via command bar → Add → Order Now** | **Order succeeds & persists** (NO "invalid input syntax for type date" error); appears in POs / requests |
| TC-REQ-18 | Catalogue order €5k–25k | Triggers line-manager approval (not auto) |
| TC-REQ-19 | Save as Draft mid-wizard | Draft saved + retrievable |
| TC-REQ-20 | Submit each remaining category (Services, Software, Contingent Labour, Contract Renewal, Supplier Onboarding) | Each routes/submits correctly |
| TC-REQ-21 | P-card route policy (`npm run test:p-card`) | Low-value eligible goods/services may be routed only when policy allows it; missing/over-limit/material/urgent/high-risk or excluded demands are withheld with reasons; the route remains read/route-only and does not initiate payment |
| TC-REQ-22 | Catalogue item detail + governed checkout (`npm run test:catalogue-ui`, `npm run test:governed-checkout`) | Catalogue entry points open the selected item; checkout captures fulfilment context; supplier/contract/risk/capacity gates and configurable whole-request auto-approval are enforced. If the deployed database predates the additive PR tables, run `npm run backfill:catalogue-governance` for supplier/contract/risk coverage, then apply the governed-checkout section of `supabase/schema.sql`. |
| TC-REQ-22a | Contract call-off completion | The Review request action remains disabled until the individual call-off has a value, need-by/service date, and cost centre; profile defaults fill accounting data where available and the form explains any remaining fields. Validation checks transaction, contract, supplier, risk, and capacity data; approval is a separate budget/authority decision and is only entered when policy or risk requires it. |
| TC-REQ-23 | Catalogue item route in full UI sweep (`npm run test:e2e-ui`) | `/catalogue/items/:id` renders through the app shell without a white screen or uncaught page error |

### Intake routing — catalogue vs contract vs new demand (INT-10)

The pre-check makes one explainable decision. These are the cases that broke it.

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-R1 | "I want to buy business consulting" → step 2 | **Never** offers a catalogue item. The reported defect matched **Business Cards 500** (the word "business" hit the item name and carried the whole match) and the ThinkPad ("business laptop" in its description), while "consulting" matched nothing and cost nothing. The catalogue stage is **skipped with the reason stated** — "consulting demand isn't fulfilled from the catalogue" — not rendered empty |
| TC-REQ-R2 | Same demand, check the escape routes | "Browse the catalogue anyway" and "Proceed to full request" are both present. A skipped stage is a visible, reversible recommendation, not a decision imposed on the requester |
| TC-REQ-R2a | Proceed to full request from Simple route evaluation | The explicit escape always opens the adaptive details conversation, even when the preliminary channel preview says catalogue or direct PO; it must never show the catalogue picker |
| TC-REQ-R3 | "a few laptops for a new starter" (goods) | Still matches the ThinkPad. This is the verbose-ask regression an earlier length-normalised matcher caused, and that a coverage-*fraction* rule would cause again — one naming word among five is a match, because circumstantial detail must not count against it |
| TC-REQ-R4 | "business cards for the sales team" (goods) | Still matches Business Cards 500. "business" is not banned — it just cannot carry a route on its own |
| TC-REQ-R5 | A matched catalogue item | Shows **which words it matched on**. A suggestion the requester can check is one they can reject |
| TC-REQ-R6 | Admin → Categories → toggle "Fulfilled from the catalogue" | Turning it on for a category makes the catalogue stage run for that category's demand; off skips it. A new or unmapped category defaults to **off** — a missed suggestion costs a click, a false one is TC-REQ-R1 |
| TC-REQ-R7 | Catalogue/contract sources unreachable | "Pre-check unavailable — neither could be checked. Nothing has been ruled in or out", with a route to a full request. Never an endless spinner, and never "no match" for a check that never ran |
| TC-REQ-R8 | AI-001 active, assistant intent disagrees | `api/ai.ts` returns `intent`, which the wizard now reads instead of discarding. It is authoritative **except** that a `catalogue` intent cannot route to an empty catalogue — then the rules decide and the disagreement is shown, not hidden |
| TC-REQ-R10 | **Home page command bar** — type "I want to buy business consulting" | The catalogue is **not** opened. This is the reported defect's second home: the command bar is a separate entry point that had its own matcher — strip stop words, score an item on any word appearing anywhere in its name, description or catalogue name, return everything above zero — run **first**, before any intent or category reasoning, with no category gate. "business" hit **Business Cards 500** and the ThinkPad ("business laptop" in its description) while "consulting" matched nothing. It now calls `decideIntakeRoute`, so both doors make the same decision (`npm run test:assistant-intents`) |
| TC-REQ-R11 | Command bar, genuine catalogue demands | "business cards for the sales team" → Business Cards 500; "office laptops for a new starter" → ThinkPad; "printer paper" → A4 Paper. Ruling out consulting must not rule out the catalogue's actual job |
| TC-REQ-R12 | Command bar, LLM returns `intent: catalogue` for a consulting demand | Overruled — the demand goes to intake and the reason the catalogue was ruled out is shown, rather than a different screen appearing silently. Same guard the wizard applies (TC-REQ-R8) |
| TC-REQ-R9 | AI-001 disabled / LLM unreachable | Identical routing to the rules-only path. The deterministic layer is the fallback and is gated by its own eval (TC-GOV-02) |

### The wizard explains itself, and finishes (`npm run test:intake-guidance`, `npm run test:intake-guidance-ui`)

A requester should be able to tell, from any screen, what the step is for and what it will cost them.
These are the cases where the wizard could not.

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-G1 | Any step | A header panel states **what the step is for**, **what we need from you**, and **what happens next**. The stepper renders each step's description under its label — that copy was defined on every step and drawn nowhere |
| TC-REQ-G2 | Step 1, after classification | **One** classification block: category as the headline with the commodity code beneath it as the derived specific code. The title is the block's heading, not a card of its own. Supplier and value are labelled **extracted** (they are confirmed at the determination). No "routes the request" sub-label — the channel routes it, and it is not decided here |
| TC-REQ-G2a | Step 1, any demand | The requester never chooses or sees a Goods/Services split. Specific commodity/service-family candidates are shown only when confidence meets the configured threshold (up to three at ≥90%, otherwise the top candidate), with probability, reason, and **None of these** |
| TC-REQ-G2d | Step 1, upload a PDF/DOCX | The document is stored with the request, extracted server-side, and the extracted fields are visible for confirmation before route matching. Unsupported, oversized, or unreadable files show a recoverable message and never block plain-text intake |
| TC-REQ-G2b | Step 1, after classification | **No generated business justification.** Step 1 classifies; it does not author the justification. The offline fallback used to emit boilerplate — "Business need: <your words>. This procurement supports business operations and is raised via the front door for classification, risk assessment and routing…" — which restated the input and said nothing, and the chat path overwrote it anyway |
| TC-REQ-G2c | Complete the step-3 conversation, then open the request | The **justification is the service-description narrative**, on the LLM path as well as the offline one. Only the offline fallback set it, so on the LLM path the request carried step 1's seed and never reflected what the requester actually described |
| TC-REQ-G3 | Step 1, click Accept | No accepted banner. The old one repeated the category and supplier from the card above it, then auto-advanced after **600 ms** — nobody could read it. The block stays on screen with its controls locked through the hand-off |
| TC-REQ-G4 | Step 2, any demand | The **buying channel** is shown, with its indicative timeline and the rule that decided it. This was first visible on step 5, four steps after it became knowable |
| TC-REQ-G5 | Step 2 → step 5, same demand | The channel shown on the pre-check **equals** the one the determination computes. Both call `resolveDemandChannel`; a second derivation would be the drift this codebase keeps paying for |
| TC-REQ-G6 | Step 3, tick "Mark as urgent" | The toggle states inline that the request now goes to Procurement-Led Sourcing instead of its current channel. Derived from the live rule set, and **silent** when urgency would change nothing |
| TC-REQ-G7 | Step 3, complete the adaptive conversation | Included, Excluded, Deliverables and Acceptance Criteria are separate editable sections; guidance is optional, sourced as a generalized similar approved request/template, and must be explicitly applied. No Business Justification field is shown and the narrative is not copied into the legacy field |
| TC-REQ-G8 | Submit a complete request | The server creates the request and stage history, then transitions to validation/risk/approval/sourcing as applicable. A successful complete submission is not left in `intake`; genuinely incomplete information remains there with the missing fields visible |
| TC-REQ-G7 | Step 3 progress bar, answer every question | Reads **100%**. The denominator is the questions this demand is actually asked, not a fixed 14 — which topped out at 57% (goods €8k), 64% (software €30k), 71% (services €60k) and 86% (consulting €400k) |
| TC-REQ-G8 | Step 3 panel, section list | Comes from the resolved template, not a hardcoded nine. A section the template marks `asked: false` (today, `location`) shows as **inferred**, not "Pending" — it is generated, never captured |
| TC-REQ-G9 | Step 3, a conditional question | Carries an **"Asked because…"** line explaining why *this* demand gets it. The six mandatory questions carry none — a justification on every question is one the requester learns to skip. The copy is per-slot config, editable in the admin slot table |
| TC-REQ-G9b | Step 3, read any question the assistant asks | The question stands alone. Any worked example appears **beneath** it, labelled "Example". It used to be concatenated onto the sentence — *"What's the primary objective of this engagement? run a promptathon to upskill 40 staff on AI tooling"* for a demand that was "I want to buy business consulting" — which read as the assistant answering itself about somebody else's project |
| TC-REQ-G9c | Step 3, compare two questions in the same conversation | Both are styled the same. Only one of the two slot sources wrapped its example in "(e.g. …)", so the budget question showed the wrapper and the objective question did not, in the same chat |
| TC-REQ-G9d | Step 3 with AI-001 active | Questions are phrased **against what the requester described**, not read from a script. The endpoint has always generated that phrasing; the client discarded it and rendered the canned string, which is why the chat felt static even with the LLM up. The engine still chooses **which** slot is asked and **when** the conversation is complete — only the wording comes from the model, and only if it comes back as a single short question |
| TC-REQ-G9e | Step 3 offline (LLM unreachable) | Canned wording, with the example hint shown — a generic example earns its place only when the wording is generic too |
| TC-REQ-G9f | Step 3, answer a question with "bla" | The assistant **challenges once**: it names what is missing and, where it can ground one in what you already said, offers a drafted answer with **Use this** / **I'll write it**. The answer is NOT written into the slot. Accepting the draft records the section as `assistant-drafted`; answering again with something thin is accepted and recorded as `weak`. Never a hard block — a requester who cannot phrase it is never trapped |
| TC-REQ-G9g | Step 3, the section panel after a challenge | The section carries its provenance — "drafted for you" or "needs detail" — and it is persisted to `service_descriptions.capture_flags`, so a reviewer downstream sees which parts of a description nobody really wrote |
| TC-REQ-G9h | Step 3 with the LLM up vs down | The assistant judges the answer when it is available; the deterministic floor (`lib/procurement/answer-quality.ts`) judges when it is not, so the offline path is not a free pass for "bla". A malformed verdict from the model falls back to the floor rather than approving |
| TC-REQ-G9i | **Next enables** | Answer the six mandatory slots and Next becomes clickable. It previously could not: the offline fallback wrote answers to local state only and never called `onUpdate`, so `formData.serviceDescription` stayed empty and the gate saw nothing captured. With no `GROQ_API_KEY` the preview always took that path |
| TC-REQ-G10 | Step 3, try to advance with only a title and a value | **Next is disabled** and names what is still outstanding. The gate calls `requiredSlotsFilled` — the mandatory-SOW floor the engine defines — which had been computed in the chat component and never consulted. Conditional enrichment never holds the gate |
| TC-REQ-G11 | Step 3, contract-renewal or supplier-onboarding path | Unaffected by the floor. Those paths render `step-details`, which never captures SOW sections, and holding them to it would block them permanently |
| TC-REQ-G12 | Step 3, the conversation ends | The assistant says **what was captured** and that the description is carried into risk, the determination and any sourcing. The same close whether or not the LLM is up |
| TC-REQ-G13 | Open a request, click through **every** workflow step | No screen throws. The step detail pre-populates risk forms from the service description; it used to cast the whole stored record — which carries a quality score, two arrays and two objects beside its nine text sections — to a map of strings and trim every value, so the first non-string member crashed the page with `r?.trim is not a function`. `sectionValuesOf()` narrows at the boundary; `test:intake-guidance` scans `src/` for both the cast and the unguarded walk, and `test:request-detail-ui` drives the real screen against fixtures — it white-screens on the pre-fix code |
| TC-REQ-G14 | Raise a sourcing event from a request that has a description | Requirements seed from the **text sections only**. Same cast, same crash class, second call site |

### The request detail, driven offline (`npm run test:request-detail-ui`)

Every other browser suite needs a reachable Neon-backed API, so none of them run in a sandbox or in
CI — which is why a render crash on the request detail was found by a user rather than a test. This
suite stubs the data API inside the page (`tests/ui/postgrest-stub.mjs`) and drives the real
screen against fixtures: no credentials, no network.

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-D1 | Open `/requests/REQ-TEST-0001`, Workflow tab | The page renders. A throw during render leaves `#root` empty, so a white screen is reported as such with the error attached, not as a locator timeout |
| TC-REQ-D2 | The current stage's card | Opens by default, showing the description summary and its quality score. The crash happened here on **render** — before any click |
| TC-REQ-D3 | "Fill Out Form" on the risk stage | The mapped field carries the description's scope. Asserting only "nothing threw" would pass against a form that pre-populated nothing |
| TC-REQ-D4 | Collapse and reopen every step card | No uncaught error, and specifically no `trim is not a function` — named, so a returning regression says which one |
| TC-REQ-D5 | The stub's own report | No filter was silently dropped. A filter the stub does not understand would answer the app with rows it never asked for, and the assertions above would be meaningless |
| TC-REQ-D6 | Request detail, Workflow tab | Shows **one** stepper, not two. The page header's `LifecycleStepper` already shows the full 11-stage timeline on every tab (and deep-links here via `focusStageId`); the tab body used to render an identical "Current Workflow Position" card on top of it — removed. The tab's own content (per-stage detail cards, attached template table, Refer Back/Reassign) is unchanged. Each stage's comment area is now **one** thread, not two — real comments merged with that stage's historical entries (`WorkflowStepDetail.comments`, confirmed dead-write, previously shown a second time in its own box) |
| TC-REQ-D7 | Request detail, Compliance tab | Single home for every risk/compliance signal: front-door determination (inherent risk, materiality, screening, disposition, sourcing type), intake compliance summary, duplicate check, reused risk assessments, risk flags, the full compliance report, **and the linked supplier's own risk/SRA/screening status** (moved here from Related — Related is linkage-only now). Most seeded requests predate the six front-door fields and show the empty state instead — `npm run backfill:compliance` (one-time, writes to Supabase, not a `test:*`) fills them using the same decisioning functions the live wizard runs (`deriveComplianceBackfill`), for any row missing them, without touching anything else on the row |
| TC-REQ-D8 | Request detail, header | No longer shows a "latest document" chip — full duplicate of the Documents tab (same `documentsAdded` hook, same fields); Documents tab is the sole home |
| TC-REQ-D9 | Request detail, Workflow tab, a current stage with a triggered form (`npm run test:request-detail-ui`) | Only `active`-status form templates are offered — `forStage()` used to ignore status entirely, so a `draft` template (e.g. the seeded "Change Request Form") was still offered to requesters. Submitting a triggered form **actually persists** it (`useCreateFormSubmission` → real Supabase insert) — it used to discard everything typed and fake success with local-only state + a toast. After a real submit: the typed values are saved, the form shows as a completed submission on reload (not re-offered), and it stops appearing in the "still to fill out" list |
| TC-REQ-D10 | Request detail, Documents tab vs Workflow stage cards | The full documents list lives only in Documents — the per-stage "Documents Added" table that duplicated it inside `StepDetailCard` was removed |

### Supplier is identified once

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-S1 | Wizard, any path | Supplier is **selectable in exactly one place** — the determination step, where PSL status, screening, risk tier and master-data completeness are all computed. `step-details` shows it read-only and says where it is confirmed |
| TC-REQ-S2 | A supplier named in the demand or matched in the chat | Arrives at the determination as a **suggestion to confirm** ("Taken from your request"), not a second decision. The recommender's rows are selectable — previously it listed suppliers with no way to act on them |
| TC-REQ-S3 | AI-005 disabled or missing | Supplier selection still works. The card no longer returns null when the agent is absent, which would have left the requester unable to pick anyone |
| TC-REQ-S4 | Chat path — commercial details | Currency, urgency and cost centre are captured. They were only ever on `step-details`, which the chat path never renders, so on that path they were captured **nowhere** |

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
| TC-SOW-05b | Narrative provenance (`npm run test:sow-narrative` + UI smoke) | The narrative is **synthesised from the captured service description**, never fixed boilerplate: it carries the requester's objective/scope/deliverables, and **two different service descriptions produce two different narratives**. Applies to all three paths — LLM, deterministic mock, and the LLM-failure fallback (which additionally flags itself as unpolished). |
| TC-SOW-06 | Submit; open request detail | Full SOW persisted + displayed (Overview/Documents) |
| TC-SOW-09 | Generation is signal-aware (`npm run test:demand-signals`) | The capture-time read — materiality, inherent risk, data sensitivity, sourcing — is computed from what is known at step 3 and passed to `/api/generate-sow`. A material, high-sensitivity, competitively-sourced engagement and a €4k stationery order produce **different required sections**; before this they produced the same document, because generation saw neither |
| TC-SOW-10 | Required sections come from config | `ConfiguredSection.requiredWhen` (editable at `/admin/service-description`) decides what is mandatory, using the same `{field, operator, value}` vocabulary as routing rules and form triggers. An **unknown signal makes a condition false** — "we don't know yet" must never manufacture a requirement |
| TC-SOW-11 | The determination reports gaps, it does not regenerate | At step 5 the final read is compared against the draft; a required section left empty is listed on-screen and in the export. The document is **not** rewritten — one that changes after the requester thought it was finished is worse than one that says what is missing |
| TC-SOW-12 | The quality gate is persisted | `quality_score` / `quality_checks` were computed, rendered and discarded at submit, so the badge `tab-overview.tsx` reads had never appeared. They now survive, alongside the signals and the required list |
| TC-SOW-13 | The conversation runs off the template | `demand-conversation.ts` takes its slots from the resolved template (`test:service-description-config` asserts all 168 agendas match the built-in order exactly). `api/chat-intake.ts` resolves it server-side and fails open to the built-in |
| TC-SOW-08 | The document spec is admin-configurable | Which sections exist, which compose the compact narrative, and which are asked vs inferred all come from `/admin/service-description` (Suite ADM TC-ADM-22…27), not from code constants. Changing the config changes the generated document without a redeploy |
| TC-SOW-07 | Provider modes | Works in `mock` and `groq/gemini`. In both non-LLM modes the narrative still reflects the captured answers (TC-SOW-05b) — a generic summary here means the fallback regressed to boilerplate |

## Suite TKT — support tickets

Ticket intake is live; the **inbox that works them is not yet built** (P2–P4 of the inbox scope).
These cases cover the data layer and the two entitlement rules, which are enforced in the query —
not in a component — because RLS is currently `USING (true)`.

| ID | Steps | Expected |
|----|-------|----------|
| TC-TKT-01 | Raise from Help → Contact Support | Ticket persists with a sequence-issued `TKT-nnnn` id, `source = 'form'`, and appears immediately under **My tickets** |
| TC-TKT-02 | Raise via the assistant ("I need to speak to someone"), then **refresh** | Ticket survives the refresh and appears under **My tickets** with `source = 'assistant'`. Regression guard: the mock path used to append to an in-memory array while telling the user to look in Help → Support |
| TC-TKT-03 | Entitlement (`npm run test:tickets`) | A requester sees only tickets they created; agent roles (`admin`, `procurement-manager`, `operations-lead`) see all. A status or owner filter **cannot widen** the entitlement |
| TC-TKT-04 | Internal notes (`npm run test:tickets`) | Responses default to public-only; internal notes surface **only** when a caller explicitly opts in. Omitting the option leaks nothing |
| TC-TKT-05 | Status lifecycle (`npm run test:tickets`) | `resolved` requires a resolution note and stamps `resolved_at`; `cancelled` is terminal without a note; reopening clears `resolved_at`; `waiting-on-user` is **not** terminal (it pauses the SLA clock) |
| TC-TKT-06 | Connector (`npm run test:connectors`) | `support-ticket` is registered and declared; the drift guard fails if a connector is added without being wired |
| TC-TKT-08 | Inbox visibility (`npm run test:e2e-ui`) | `/help/inbox` renders for `admin`, `procurement-manager`, `operations-lead` and appears under **Help** in the sidebar. A requester role navigating directly to `/help/inbox` is **redirected Home** and never sees the nav item |
| TC-TKT-09 | Standing views | **Unassigned** (default) lists only unowned, non-terminal tickets · **Mine** only tickets owned by the current user · **All open** excludes resolved/cancelled · **All** shows everything. Tab counts match the rows listed |
| TC-TKT-10 | Filters + search | Priority and category narrow the list; category options are derived from the data, not hardcoded. Search matches id, subject, description, requester and owner. Empty result shows "No tickets match these filters", not the zero-tickets message |
| TC-TKT-11 | Detail drawer | Clicking a row opens a drawer (not a route — queue scroll/filters survive) showing owner, category, source, related request link, description, resolution and the correspondence thread. **Internal notes are visibly marked** and only appear in the agent drawer |
| TC-TKT-12 | Assign / forward | Owner picker lists **internal roles only** (no external supplier), marks out-of-office users, and offers "Unassigned" to return a ticket to the queue. Forwarding = reassign + a handover note posted as an internal note. Each change writes an `audit_entries` row (`objectType = 'ticket'`) and notifies the new owner |
| TC-TKT-13 | Reply vs internal note | The composer toggles between **Reply to requester** and **Internal note** (visually distinct). A reply notifies the requester and appears in their ticket thread; an internal note does **neither** — confirm as a requester role that it is absent |
| TC-TKT-14 | Resolve | Selecting **Resolved** opens a resolution prompt; resolving without a note is refused. On resolve, `resolved_at` is stamped, the requester is notified, and the resolution shows in their thread |
| TC-TKT-15 | References (`npm run test:tickets`) | A ticket can link to **requests, POs, suppliers, contracts and invoices**, several at once. The picker searches real objects by id/name — no free-text id entry. Each reference deep-links to its object. Re-linking the same object is a no-op, not a duplicate. Removing a link is audited |
| TC-TKT-16 | Requester thread | On Help → Contact Support a requester expands their own ticket and sees replies and the resolution — and **never** an internal note |
| TC-TKT-17 | SLA targets (`npm run test:ticket-sla`) | `due_at` set on raise from `sla_targets` (stage `ticket`, channel = priority): high 4h, medium 8h, low 24h. An unknown priority falls back to `default`; with no targets at all a ticket is still bounded, never unlimited |
| TC-TKT-18 | Breach + at-risk | Rows inside the last hour show **Due soon**; past due show **SLA breached**. The **Breaching** standing view lists both. A ticket with no `due_at` is `none`, **not** on-track — it must not be reported as healthy |
| TC-TKT-19 | Clock pause | Setting **Waiting on user** clears `due_at`, so the ticket cannot breach while the requester is the blocker; moving back to open/in-progress starts a **fresh** window from now. Resolved and cancelled are also paused |
| TC-TKT-20 | Queue metrics | Header shows Open / Breached / At risk / Median-to-resolve. Median covers **resolved only** — cancelled tickets are excluded so they cannot flatter it |
| TC-TKT-21 | Requester references | On Contact Support a requester expands their ticket and can link objects **their role can already see**: every internal role gets requests (their own only); supplier-management roles also get suppliers; core internal roles also get contracts/POs/invoices. The **external supplier role gets no picker at all** |
| TC-TKT-22 | Chat transcript | A ticket raised through the assistant stores the **verbatim conversation**, not just the model's summary. The drawer shows it under "Assistant conversation" (collapsed). Verify in both `groq` and `mock` provider modes |
| TC-TKT-07 | Concurrent submission | Two tickets raised at the same moment get distinct ids. Both intake paths draw from `ticket_number_seq`; they previously read the maximum and raced |

## Suite APR — approvals & tasks

| ID | Steps | Expected |
|---|---|---|
| TC-APR-01 | `/approvals` queue | Pending count, filters (urgency/value/category), AI summaries |
| TC-APR-02 | Approve a pending item | Toast; pending count decrements; **persists**; audit entry. The Approve/Reject buttons show **only to the assigned approver** (request-detail tab *and* the `/approvals` card now both gate by `approverId === currentUser.id`); others see "Awaiting <role>". |
| TC-APR-02b | Approver resolution (`npm run test:approver-resolution`) | Every approval-step role resolves to a **switchable role persona** (u1–u6) — Finance Approver → procurement-manager (u2), VP Procurement → admin (u6), Budget Owner → service-owner (u1), etc. So switching to the matching role surfaces the Approve button (no approval stranded on a non-switchable user). |
| TC-APR-02c | Config-driven Routing step (`npm run test:workflow-steps`) | The Routing preview holds **no hardcoded steps/approvers/timeline/reviewers** — all derive from admin config. `composeWorkflowSteps` builds the lifecycle from the attached template's `stage` nodes (start/end/decision/error/parallel dropped) and overlays a **Risk assessment** step when `riskAssessmentRequired` and a **Vendor onboarding** step when `supplierOnboardingRequired`, inserted before the first approval stage and **never duplicated** when the template already models that node. `selectApprovalChainForValue` bands the spend to the right approval chain (€5k → Fast-Track, €150k → VP-Level, €750k → Board-Level; boundaries land in the higher band). The browser smoke (`test:ui`) then asserts the live Routing step shows the **template-derived stages** (no "Intake review by system"), the two dynamic steps, the **VP-Level** chain's resolved approver, the **category-SLA** timeline, and **directory** reviewers. |
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
| TC-WF-08 | `/pipeline/sourcing` shows the SAME events as `/sourcing` | Stage counts and rows come from `sourcing_events` with real invitation counts — **no `SE-*` ids anywhere**. Clicking a row opens `/sourcing/:id`. A cancelled event appears in neither the funnel nor the table (it is not a stage of the funnel) |

### Vendor onboarding — two gates (`npm run test:onboarding-stage`)

| ID | Steps | Expected |
|---|---|---|
| TC-WF-O1 | Name a supplier the directory does not hold, at the determination step | "Add **&lt;name&gt;** as a new supplier" creates a **prospective** record (`onboarding_status = not-started`, `screening_status = pending`). Until this existed the onboarding trigger — "a new supplier was selected" — was inexpressible, which is why the stage never fired |
| TC-WF-O2 | Light gate — sourcing | A named supplier who has not cleared screening **cannot** be invited to a sourcing event. A demand with **no** supplier is not blocked — going to market with nobody named is the point of an event |
| TC-WF-O3 | Light gate — risk completion | The risk stage cannot be completed without a screened supplier record, because the assessment hangs off one. This is why light onboarding happens early rather than at award |
| TC-WF-O4 | Full gate — contracting | An award to a supplier who is screened but not fully onboarded routes the request to **`onboarding`**, not `contracting`, and continues to contracting once onboarding completes. A fully onboarded winner goes straight through (the R5 award regression) |
| TC-WF-O5 | Flagged supplier | Screening `flagged` blocks both gates and the reason names screening, not paperwork |
| TC-WF-O6 | Prospective ≠ onboarding incomplete | An established supplier mid-data-refresh is not prospective. Both need the stage, for different reasons — the old trigger (`!supplierId \|\| !supplierData.complete`) conflated them, fired on nearly every request, and meant nothing |
| TC-WF-O7 | Stage order and preview | `onboarding` sits after `risk` (it needs the supplier record) and before `sourcing` (it gates the invitation); a catalogue order has no onboarding stage. The Routing preview shows it only when it will actually run — the synthetic always-on step is retired |

## Suite SRC — sourcing & evaluation

| ID | Steps | Expected |
|---|---|---|
| TC-SRC-01 | `/sourcing` event list | Table w/ status, suppliers, responses, deadline |
| TC-SRC-02 | Open a populated event (SRC-001) | Overview/Supplier Tracking/Q&A; response rate computed |
| TC-SRC-03 | Open a draft/0-response event (SRC-004) | Renders (no white-screen); null dates show "—" |
| TC-SRC-04 | New Event 5-step wizard → Publish | **Event persists** and appears in the list (not toast-only) |
| TC-SRC-05 | Save as Draft | Persists as draft |
| TC-SRC-06 | Evaluation Centre picker (`/sourcing/evaluation`) | Lists only events open for evaluation (published / in-evaluation / award-pending), each showing *n of m responded*, linking to `/sourcing/:id/evaluation`. No events open → an empty state, not a fixture |
| TC-SRC-07 | Score and award (`/sourcing/:id/evaluation`) | Scores persist to `sourcing_responses` (reload keeps them); the weighted total is recomputed from the event's criteria; **a supplier who has not responded cannot be scored**; shortlist/eliminate persists. **Award → writes the winning supplier onto the linked request, stamps `award_date` + `awarded_supplier_id`, closes the event and resumes the workflow.** Contract creation is deliberately *not* part of this — see the scope note in the R1 roadmap |
| TC-SRC-14 | Award is blocked, with a reason | With no shortlisted responder, on a draft event, or on an already-awarded event, **Proceed to Award** is disabled and the blocking reason is shown. An award cannot be made twice |
| TC-SRC-15 | Sourcing stage gate (`npm run test:sourcing`) | A request entering the sourcing stage **suspends** its workflow instance and stays in `sourcing` until an award; awarding advances it. WF-004's `Sourcing (RFP)` node normalises to the same status as WF-001's `Sourcing` — it must never write `sourcing-(rfp)` |
| TC-SRC-17 | An awarded request always leaves sourcing | **Most requests have no workflow instance** (only those created since the engine started instantiating one do), and `advanceWorkflow` returns early for those — the engine is what normally writes the status. Award on a request **with** an instance (engine advances it) and one **without** (direct fallback to `contracting`): in both cases the request must end up out of `sourcing` with the supplier written back. Regression — an award once closed the event, wrote the supplier, and left the request parked in the stage |
| TC-SRC-16 | Re-apply award to request | When `sourcing_events.awarded_supplier_id` is set but the linked request's supplier disagrees (a half-applied award — the write-back spans three tables with no transaction), the event page offers **Re-apply award to request**, and running it twice leaves the same result |
| TC-SRC-08 | Templates page | 5 templates render |
| TC-SRC-09 | Raise an event from a request | On a request in the **sourcing** stage, **Create sourcing event** opens a dialog pre-filled from the request (budget, incumbent); creating it mints an `SRC-nnnn` id, stores `request_id`, seeds the incumbent as the first invitation, and navigates to the event. The button then reads **Open sourcing event** — a second event cannot be raised for the same demand |
| TC-SRC-10 | Gate is stage-based (`npm run test:sourcing`) | The action shows on `status='sourcing'` **regardless of `sourcing_type`** — including requests created before the column existed (all 101 of them). It is hidden in every other stage |
| TC-SRC-11 | Two-way surfacing | The request's **Related** tab lists its sourcing events (id, type, deadline, status badge) linking to `/sourcing/:id`; the event's overview shows **Raised from REQ-…** linking back. A request with no event and nothing else related still shows the single "No related items" empty state |
| TC-SRC-13 | Supplier tracking is real | The event's **Supplier Tracking** tab lists actual invitations (supplier, status, price, response date) and the overview shows Invited / Responded / Response rate. The register's **Suppliers** column counts them |
| TC-SRC-12 | Sourcing type persists | A request submitted (or saved as draft) through the wizard stores `sourcing_type` + `sourcing_type_reason` and shows **Sourcing Type** on the detail overview. Catalogue fast-track requests correctly store none |

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
| TC-PORT-08 | Portal invitations are real | As **Supplier**, `/portal/sourcing` lists only events this supplier was invited to, split Open / Closed. Open = live event **and** deadline not passed. The `EVT-*` fixtures are gone — ids read `SRC-nnnn` |
| TC-PORT-09 | Submit a response | **Respond** opens `/portal/sourcing/:eventId`; opening it flips the buyer's tracking from Invited to **Viewed**. Submitting price / lead time / proposal sets status **Responded**, notifies the event owner, and the buyer's response rate updates. Re-opening shows the submitted values and allows an update |
| TC-PORT-10 | Portal entitlement (`npm run test:sourcing`) | An **uninvited** supplier opening `/portal/sourcing/:id` sees "not available to you" — identical to a non-existent event, so the page cannot be used to probe which events exist. The payload **withholds** criteria, weights, budget, `awarded_supplier_id`, `request_id` and `owner_id`: they are excluded from the SELECT, not merely unrendered |
| TC-PORT-11 | Closed events are read-only | Past the deadline the response form is disabled with an explanatory banner; the submitted values stay visible |
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
| TC-ADM-02c | Editor ↔ runtime ↔ test panel parity (`npm run test:routing-rule-integrity`) | Every field and operator the editor **offers** is evaluated in production, in both directions. The editor used to offer `contractId`, `riskLevel` and `region` and the operators `contains`, `is_empty`, `is_not_empty`, none of which the evaluator implemented — an unrecognised condition returned `false`, and because a rule requires `conditions.every(...)`, one killed the whole rule. `riskLevel` vs `riskRating` meant the obvious "route on risk" rule was dead on a name mismatch |
| TC-ADM-02d | The test panel tests what runs | The panel calls the production evaluator. It used to implement its own — including `contractId` and `is_empty`, which production ignored — so it could **confirm a rule that never fired**. Set a priority and a commodity code in the panel; both are now inputs |
| TC-ADM-02e | A rule that cannot fire looks broken | `/admin/rules` shows a banner listing active rules with an unknown field, an unsupported operator, a malformed `between` (one bound), or no conditions. Each is clickable to the rule. **Live proof this was needed:** RR-001 "High-value IT software" was active, first in evaluation order, described as routing software over €100k to procurement-led, and carried `match_count: 42`. All three of its conditions evaluated false — it had never matched once. Repaired in `supabase/backfills/2026-08-28-rr001-repair.sql`, with `match_count` reset to 0 rather than carrying a history it never had |
| TC-ADM-03 | `/admin/forms` Form Builder | Add/configure/reorder fields; live preview; Save persists |
| TC-ADM-03b | Form status reflects reality | `triggerStages` is metadata shown on the form's card — it is **not** consumed anywhere in the wizard or request-detail, so setting it does not make a form actually appear at those stages yet. `FORM-008` "Change Request Form" is `draft` for exactly this reason (confirmed no consumer of `triggerStages` outside this admin page and its data hooks). Flip a form to `active` only once a stage genuinely renders it |
| TC-ADM-04 | `/admin/workflows` Designer | All 4 templates render node graphs; add node; Simulate; Save persists |
| TC-ADM-05 | Designer drives runtime (target) | Editing a template changes how a new request progresses |
| TC-ADM-06 | `/admin/approvals` Approval Chains | Edit chain; **Save persists across reload** (requires `approval_chains` table) |
| TC-ADM-07 | Chain change affects a new request | Generated approvers reflect the edited chain; OOO→delegate |
| TC-ADM-08 | `/admin/agents` AI Agents | 6 agents; open one (config + perf dashboard); **toggle status + Save persists** |
| TC-ADM-09 | Enable Supplier Recommender (AI-005) | Wizard Step 4 shows ranked suppliers |
| TC-ADM-10 | Enable/disable Category Classifier (AI-001) | Wizard Step 1 switches LLM↔local behaviour. Serverless agent configuration is process-cached for up to 60 seconds, so verify the changed status after that window; `npm run test:ai-agents` polls it in both directions and restores the original status. |
| TC-ADM-11 | Categories admin | `procurement_categories` **seeded** from the canonical taxonomy (8 rows); add/edit category **persists** and appears in intake; **Icon picker** sets the tile icon shown at intake |
| TC-ADM-12 | SLA targets admin | Edit per-stage SLA **persists** (requires `sla_targets` table); reflects in SLA tracker |
| TC-ADM-13 | `/admin/policies` | Policies versioned; view full text |
| TC-ADM-14 | `/admin/users` (wired CRUD) | **Add User** (dialog) persists to the active Neon store and appears in the table; **Edit Role** updates the role; **Remove** deletes the record — all via the real mutation hooks (no more toast-only no-ops). Verified by `npm run test:interactions-ui` (create → persist → cleanup). |
| TC-ADM-15 | `/admin/health` System Health | Integration status, uptime, error log |
| TC-ADM-16 | `/admin/audit` Audit Log | 40+ entries; filters; **Export** |
| TC-ADM-17 | `/admin/kb` KB Management | Add entry persists; assistant uses it |
| TC-ADM-18 | `/admin/ai-analytics` | Conversation/answer-quality charts |
| TC-ADM-19 | `/admin/database` | Entity tabs; edit a row persists; reflects on feature pages |
| TC-ADM-20 | `/admin/database` → **Sourcing Events** | The tab lists live events (id, title, type, status, category, budget, deadline, request, awarded supplier). Editing status/dates persists and shows on `/sourcing/:id`. Requirements and evaluation criteria render **read-only** with the criteria weight total — the wizard owns them, because it is the only place weights are validated. **Related Items** resolves the originating request and the awarded supplier both ways |
| TC-ADM-22 | `/admin/service-description` renders (`npm run test:service-description-ui`) | Admin-only route. Four areas render: **Generation prompt**, **Components asked at intake**, **What is generated**, **Reuse in later steps**. The editor never blocks on the read — when the stored row is unreadable it shows the built-in (what generation actually falls back to) with a visible notice, not a spinner |
| TC-ADM-23 | Prompt is configurable and previewable | Edit guidance / system prompt / temperature / token budget for a category; **Preview the assembled prompt** shows the prompt with `{{guidance}}` and `{{outputFormat}}` resolved — i.e. what the model will actually receive. Save persists to `service_description_templates` |
| TC-ADM-24 | Per-category with a `default` fallback | A category with **no row of its own** resolves to the `default` row; with neither, to the built-in template. Categories that are inheriting rather than configured are marked as such. Deleting a category's row returns it to inheriting — nothing breaks |
| TC-ADM-25 | Config reaches the serverless routes | Save a template, then run intake for that category: `/api/generate-sow` uses the **stored** prompt and model params, not the hardcoded ones. This is why the config is a table and not a settings store — `PolicyConfig` is localStorage-only and can never reach a serverless route |
| TC-ADM-26 | Components asked are config-driven (`npm run test:service-description-config`) | The serialised slot set produces **the same questions in the same order** as the built-in `ALL_SLOTS` across every category × value combination — the equivalence that makes the migration safe. Conditions use the `{field, operator, value}` vocabulary shared with routing rules and form triggers; thresholds referenced as `policy:<key>` still move with `/admin/thresholds` |
| TC-ADM-27 | What is generated is config-driven | The **compact narrative** composes from `narrative_sections`, in order, in one place (the API, the mock and the offline fallback no longer drift). Sections the requester is never asked for are labelled **inferred**, so generated content is not presented as captured |
| TC-ADM-28 | Reuse in Sourcing | Raise a sourcing event from a request with a service description: `requirements` are **seeded from the configured sections** (labelled, empty sections skipped) and `criteria` from the template's defaults instead of arriving empty. The evaluator can still edit everything; weights must still total 100, and the admin screen shows the running total where they are edited |
| TC-ADM-30 | A conditional question's rationale is editable | In **Components asked at intake**, a slot with conditions offers an "Asked because…" field, shown to the requester beneath that question at step 3. Unconditional slots do not offer it — everyone is asked those, so a rationale would be noise. Blanking the field removes the line |
| TC-ADM-29 | Reuse in Risk / forms | The Form Builder's pre-populate list offers `sow.*` sources (objective, scope, deliverables, resources, narrative, …). A form triggered on the risk stage pre-fills from the service description rather than re-asking |
| TC-ADM-21 | Deleting a sourcing event really deletes | Removing an event from the admin browser deletes the Postgres row **and cascades to its invitations and submitted bids** — reload and confirm it is gone from `/sourcing`, not just from the current session |

## Suite AI — assistant chatbot (5 capabilities + guardrails)

| ID | Steps | Expected |
|---|---|---|
| TC-AI-01 | Ask "What is the approval threshold for consulting engagements?" | **Clean grounded answer with a source chip**; **no `tool_calls.NAME(...)` / `## Step` / `$\boxed{}$` / raw tool text**; not stalled (see CHATBOT_TOOLCALL_FIX.md) |
| TC-AI-02 | Lookup "status of REQ-2025-0114" | Short answer + **deep-link callout** to the request |
| TC-AI-03 | Action: "set my out-of-office" | **Confirm read-back** then execute; **audit entry**; no execute without confirm |
| TC-AI-04 | Ask for something with no grounded answer | Offers **handover/ticket** (no hallucinated facts) |
| TC-AI-04b | Grounded retrieval (`npm run test:knowledge` + interaction E2E) | Ranks the KB (tags > title > body); a strong match **quotes the best entry + its source** and cites related policies; a **weak match returns the closest topics, not an asserted (possibly wrong) policy**. E2E asserts the threshold answer is grounded ("delegated authority"/"€10,000"). |
| TC-AI-05 | Demand intake: "I need to buy 50 laptops" | Deep-links into New Request prefilled |
| TC-AI-05b | Demand routing (`npm run test:assistant-intents`) | A procurement demand — incl. people/consultants ("I need consultants for a promptathon", "hire a developer", "looking for an agency") — routes to **start_demand → New Request**, **never a support ticket**. `create_ticket` fires only on explicit human-help ("speak to someone"). Holds on both the LLM path (rule precedence in `api/chat.ts`) and the offline classifier (`intents.ts`). |
| TC-AI-06 | Role filtering | As Requestor, restricted actions not offered; as Ops Lead, different set |
| TC-AI-07 | Full-page assistant (`/help/assistant`) | Same behaviour as overlay; the user-scoped conversation history is backed by `assistant_conversations` in the active database |
| TC-AI-08 | Guardrail: no master-data write-back | Vendor bank-detail change routes to ticket, not direct write |
| TC-AI-09 | Regression: a knowledge/lookup query that triggers a tool | Server **executes** the tool (or client suppresses it); user sees a clean grounded answer, **never raw `tool_calls.…` text**; no stall (CHATBOT_TOOLCALL_FIX.md) |
| TC-AI-10 | Provider parity: same query in `VITE_ASSISTANT_PROVIDER=mock` and `groq` | Equivalent grounded answers + source in both modes |
| TC-AI-11 | Robustness: slow/empty/erroring 2nd model call (or tiny timeout) | User gets a graceful timeout/fallback message, **never an infinite spinner**; `/api/chat` always terminates (CHATBOT_HANG_FIX.md) |
| TC-AI-12 | Classifier server configuration (`npm run test:ai-api-config`) | Missing active database/AI server configuration produces `503 { code: "service_unavailable" }`; the Vercel function must not fail at module load or expose configuration details. Supabase variables are rollback-only. |
| TC-AI-13 | `api/chat-intake` import-graph hygiene (`npm run test:api-imports`) | Same principle as TC-AI-12, different mechanism: `api/chat-intake.ts` shipped in production returning a bare `500 FUNCTION_INVOCATION_FAILED` on **every** call — the intake wizard's chat silently ran on its offline fallback the whole time, with no log and no user-visible signal. Root cause was two relative imports inside `demand-conversation.ts` missing their `.js` extension: neither `tsc -b` (bundler-mode resolution) nor `vercel dev` (a lenient dev-server loader) catches this, only Vercel's real per-function build does — confirmed by running `npx vercel build` and inspecting the emitted `.vercel/output/functions/api/chat-intake.func` bundle directly. The test statically walks the import graph of every `api/*.ts` entrypoint and fails on any relative specifier lacking a file extension, so this can't silently reappear. Any change to `api/*.ts` or a module it imports should run this, not just `tsc -b`. |

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
| TC-PSL-02 | Competitive sourcing | Below threshold exempt; above threshold requires quotes unless preferred route, exempt category, or single-source justification |
| TC-MAT-01 | Materiality (`npm run test:materiality`) | Highest-attribute-wins from data sensitivity + supplier risk + value (+ critical-service flag); critical data/risk → critical+material; high or value≥threshold → important+material; benign → standard. Surfaced on the determination screen and feeds routing (`material`). |
| TC-CAT-01 | Category-code mapping (`npm run test:category-code`) | Keyword match resolves a code (confidence scales with hits); no keyword + known category → category default; keyword wins over default; unknown/none → null; every canonical category has a default code |
| TC-CFG-01 | Central policy config (`npm run test:policy-config`) | `DEFAULT_POLICY_CONFIG` pins every decisioning threshold (approval/materiality/risk-band/competitive-sourcing/contract); all decisioning modules source their constants from it (values unchanged — dependent suites stay green); `resolvePolicyConfig` merges a partial override without mutating defaults; an override changes the decision (200k → light at default, → full at a 150k threshold). |
| TC-CFG-02 | Decisioning Thresholds admin page (`/admin/thresholds`, route sweep `npm run test:e2e-ui`) | Admin edits a threshold; the **live simulation** recomputes a sample demand's materiality / inherent risk / approval gate under the edited values; **Save** validates and persists to the Neon policy singleton before showing success (drives the live front door, survives reload); Reset restores defaults. A failed save leaves the prior active config. Page renders clean in the route sweep. |
| TC-GOV-01 | Classification eval harness (`npm run test:classification-eval`) | Labelled benchmark over the deterministic classifier (`classify.ts`); reports overall accuracy + per-category breakdown + misclassifications; **gates at ≥85% accuracy** (currently 95.8%) and asserts every category is reachable. Prevents silent regressions when keyword rules change (CLS-G1). |
| TC-GOV-02 | Intake routing eval harness (`npm run test:intake-routing-eval`) | Labelled benchmark of free-text demands → expected route (catalogue / contract / new-demand), with a per-route breakdown and an **accuracy floor that fails the build** (currently 90% against an 85% baseline). Also asserts outright that no service-category demand can ever route to the catalogue. Gates the **deterministic** layer: the LLM's intent is authoritative at runtime but is not reproducible from the text, so it is covered by a contract test (TC-REQ-R8/R9) rather than an accuracy floor. Two known misses are recorded in the harness rather than relabelled away — a catering and a translation demand match a Services contract on its *category* alone, which is the contract-side analogue of the same fault |
| TC-GOV-03 | Atomic governed checkout (`npm run test:governed-checkout-atomic`) | Live Neon submission creates request → PR → lines and a conditional PO in one transaction. A matching idempotency-key retry returns the same aggregate, a changed payload returns HTTP 409, and concurrent submissions produce one requisition/PO. The test uses uniquely prefixed rows and cleans them up. |
| TC-RSK-01 | Risk segmentation (`npm run test:risk-segmentation`) | Inherent-risk cascade highest-attribute-wins (critical data/access/service → critical; high risk or value≥250k → high; value≥50k → medium); outcome: no reusable → new, within band → reuse, one tier above → amend, more → change. Surfaced on the determination screen + drives routing. |
| TC-RSK-02 | Structured reuse model (`npm run test:risk-reuse`) | Per-assessment decision by supplier/scope/data-class/inherent-tier/validity; not-reusable/not-completed/different-supplier → no-match; expired → new; worst dimension wins; `selectReuseOutcome` picks the most favourable candidate across the register. Drives the determination outcome. |
| TC-RSK-03 | Preliminary operational risk (`npm run test:operational-risk` + UI smoke) | Per-dimension screen — business continuity (critical-service/material spend), data handling (sensitivity), concentration (incumbent + material), regulatory (materiality), access (privileged); **worst-dimension-wins** overall. "Preliminary operational risk" panel renders on the risk step and appears in the export. |
| TC-HND-01 | Handoff / next-steps (`npm run test:handoff`) | Detailed risk assessment routed to the risk register (reuse → not-required, amend → recommended, new/change → required); material → governance step; sourcing/contract steps by channel; purchasing requisition; **supplier-data issue → a "Resolve supplier master data" remediation step routed to onboarding**. Surfaced as the determination's Next-steps panel with system + status + deep-link. |
| TC-HND-02 | Supplier master data (`npm run test:supplier-data`) | A selected supplier that isn't fully onboarded, or has expired certifications, is flagged incomplete (issues accumulate); no supplier / fully-onboarded with valid certs is complete. Drives the remediation handoff step (RTE-04). |
| TC-DET-01 | Contract/sourcing type (`npm run test:determination`) | Contract type: catalogue/direct-PO → none, renewal → renew; against an existing agreement — material change → **change**, extends/at-capacity → **amend**, fits with headroom → SOW; else new-MSA. Sourcing type: catalogue/contract → none, renewal → renewal, incumbent → benchmarking, else new-event. Both surfaced on the determination. |
| TC-DET-02 | Export (`npm run test:determination-export` + UI smoke) | Builds structured Markdown (request, determination incl. **disposition + contract coverage**, risk incl. operational risk, approval-to-source, next-steps table, policy checks); slugified filename; graceful with missing fields. The determination **Export** button downloads a `determination-*.md` file. |
| TC-DET-03 | Second contract check (`npm run test:second-contract` + UI smoke) | Classifies the supplier's contracts as transactable / framework (host a SOW) / expiring; filters supplier/category/expired; recommends transact/author-SOW/renew/new; strongest route wins. "Contract coverage" panel renders on the determination. |
| TC-DET-04 | Approval-to-source gate (`npm run test:approval-to-source` + UI smoke) | Light (demand validation + cost-centre) vs full (demand validation + intent-to-source + category approval); full triggered by value ≥ threshold, materiality, or high/critical inherent risk; transactable early exit ⇒ no gate. "Approval to source" panel renders on the determination and appears in the export. |
| TC-DET-05 | Residual questions (`npm run test:residual-questions` + UI smoke) | Stage-5 mini-IRQ is **criteria-driven**: privileged-access asked for IT/services/consulting/contingent or medium+ data sensitivity; critical-service asked for value ≥ threshold, elevated supplier risk, or high+ sensitivity; low-value low-sensitivity demand asks nothing ("No further questions"). Each shown question states "Asked because…". UI smoke asserts the rationale renders. |
| TC-DET-06 | Demand disposition (`npm run test:referral` + UI smoke) | proceed / request-change / refer-back, most-blocking-wins: missing-mandatory, out-of-scope, or **blocked supplier (screening)** → refer-back; failed policy check or duplicate → request-change; else proceed. Headline banner renders on the determination and appears in the export. |
| TC-ORC-01 | Transition records the first stage (`npm run test:orchestration`) | The stage a request is **created** in is recorded and left open. The idempotency guard is "already in this stage **and** already recorded as being in it" — a status-only guard declined to record the first stage, which is how wizard-created requests came to have no history and render as never started. Recording it twice still opens only one row |
| TC-ORC-02 | No-template fallback creates no instance | A request with no resolvable template gets **no** workflow instance and a proper stage transition (history, owner, SLA), not a `fallback:<channel>` instance. The old synthetic row made the Complete-stage button a silent no-op that still reported success, because `advanceWorkflow` returns early on an unresolvable template while the button's own fallback only runs when there is no instance at all |
| TC-SDC-01 | Service description config — question equivalence (`npm run test:service-description-config`) | The serialised template drives the same conversation the hardcoded `ALL_SLOTS` did: **every category × value × slot combination agrees** on whether a slot applies. `appliesWhen` is stored as `{field, operator, value}` — the vocabulary already shared with `routing_rules` and `form_templates.trigger_conditions` — and `policy:<key>` values still resolve through the governed thresholds, so `/admin/thresholds` keeps moving them. |
| TC-SDC-02 | Narrative composition | The compact narrative composes from `narrative_sections`, in order, in **one** function used by the API, the deterministic mock and the offline fallback — the three had drifted (six-field vs four-field joins) while the docstring claimed they were in step. An unanswered section contributes nothing rather than an empty clause. |
| TC-SDC-03 | Downstream seeding | `seedRequirementsFromDescription` turns each nominated section into one labelled requirement and skips empty ones (a requirement a supplier cannot respond to is worse than one fewer); `seedCriteriaFromTemplate` returns the configured criteria and **reports** when the weights do not total 100 rather than shipping an event the wizard will refuse to publish. |
| TC-SDC-04 | Resolution + fail-open | Category-first, then `default`, then the built-in template. A missing row, a malformed row, or an unreachable database all yield the built-in, so an admin mistake cannot take intake generation down. |
| TC-DET-07 | Supplier screening (`npm run test:screening` + UI smoke) | clear → cleared (green); flagged → blocking (red, refers the demand back); pending → caution (amber); unset → not-screened. "Supplier screening" line renders on the determination. |

### UI smoke (automated — `npm run test:ui`, Playwright)

| ID | Steps | Expected |
|---|---|---|
| TC-UI-01 | Boot app at `/` | React mounts; no console/page errors |
| TC-UI-01b | `/requests/new` step 1 render | Scrollable content reserves enough bottom clearance (`<main>` `padding-bottom` ≥ the fixed AI assistant button's own exclusion zone, measured from the button's actual rendered rect) that a page's own bottom-right content can never end up underneath it — regression for the wizard's Next/Submit button being unreachable behind the FAB on the wide (`max-w-5xl`) step-3 layout |
| TC-UI-02 | `/requests/new` → describe in free text → Accept & continue | **No commodity-category tiles** (Goods/Contingent Labour asserted absent); the free-text classification derives the category and a **"Browse the catalogue"** affordance is the one explicit alternative entry. Pre-check **stage 1 (catalogue)** renders via the connector layer in-browser and a **plain product word** ("laptops") surfaces the model-named catalogue items (regression — scoring is a raw keyword sum, not length-normalised, so a description-level hit counts and extra words don't dilute it); the **contract check is asserted absent** until enrichment; stage 2 (contract) is reached only after enriching. Expected dev-only `/api/*` 404s are ignored; no app errors during the flow |
| TC-UI-03 | Two-step determination (Contract Renewal → full request → **step 4 Risk & assessment** → **step 5 Determination**) | Step 4 renders the mini-IRQ delta capture; toggling critical-service there drives the cascade shown on step 5 (lifted state). Step 5 renders the determination: buying channel, materiality, inherent risk, contract/sourcing type, Next-steps handoff panel; policy-check region (competitive sourcing/PSL when the validator agent is active, else the notice). |
| TC-UI-04 | Full-app sweep (`npm run test:e2e-ui`) | Every route (admin role for app/admin, supplier role for portal) + 5 detail pages render with no console errors, no white-screens, no uncaught exceptions. Guarded admin routes render real content (role injection verified). |
| TC-UI-05 | Interaction E2E (`npm run test:interactions-ui`, self-cleaning) | **Wizard submit** creates a request (reaches confirmation, persists, then deleted); **admin category create** persists & shows in the table (then deleted); **AI assistant** returns a response within 25s (no hang) **and a supplier lookup returns connector-backed data** (AST-Q); **config wiring** — an admin lowers the approval threshold to 10k and saves, then the **same €50k demand that is a *light* gate at the default 250k becomes a *full* gate in the live wizard determination** (proves admin config drives the live front door); **workflow designer** renders the selected template's nodes on first load (regression: the ReactFlow canvas used to mount before the templates query resolved and stay blank until a manual template switch); **dashboard integrity** — System Health shows the live Data Source status + real request volume (no hardcoded "47 active users" / always-"Healthy" tile) and the "AI Insights" widget no longer claims analysis it never ran. Set `E2E_UI_BASE` to run it against a deployed Vercel build; its renewal path correctly starts at **Contract check**, not Catalogue check. No uncaught errors in any flow. |
| TC-UI-06 | Alternative home designs (`npm run test:home-designs`) | The home (`/`) toggle (top bar, next to the role-switcher) offers **Dashboard / 1a Cupertino / 1b Bento / 1c Editorial**, persisted per user. Each Apple-style design is **fully functional, not marketing copy**: the real front door (`SmartCommandBar`), the role's quick-actions, live KPIs and a **live demand-pipeline** (real stage counts Intake→Routing→Approvals→Automation→Fulfilled), and a working "Start a request" CTA → `/requests/new`. **Every pipeline node/row and KPI tile is a real link** (not decorative) — pipeline → `/pipeline/demand`; KPIs → `/requests`, `/analytics/pipeline`, `/analytics/compliance`, `/sourcing`. The default `/` still renders the **untouched dashboard** (Customise + widgets); the toggle switches designs live. 0 console errors. |

---

## Lint as a gate

`npm run lint` is clean and is part of the Definition of Done. The React
Compiler rules it runs are behavioural, not cosmetic — these are the classes
that were found and fixed when the debt was cleared, and the ones to watch for:

| Rule | What it catches | Why it matters here |
|---|---|---|
| `react-hooks/purity` | `Math.random()` / `Date.now()` during render | The supplier onboarding pipeline showed a **random** "days in stage" with severity colouring; it changed on every re-render. Clock-based ids also collided within a millisecond |
| `react-hooks/refs` | A ref read during render | The workflow designer fed `nodesRef.current` to the simulation as props — untracked input that happened to work only because opening the panel set state |
| `react-hooks/set-state-in-effect` | Server data mirrored into local state; form state resynced by effect | Cost an extra render and a flash of empty content. On approval chains it also **destroyed an unsaved new chain** on any refetch, because the pruning effect could not tell "deleted upstream" from "created here" |
| `react-hooks/exhaustive-deps` | A stale dependency | `step-compliance` computed `missingMandatory` from `requestTitle` without listing it, so editing the title left the flag stale |
| `react-hooks/preserve-manual-memoization` | A `useMemo`/`useCallback` the compiler cannot preserve | Keeping it makes the compiler **skip optimizing the entire component**. Remove it unless something needs a stable reference — `step-compliance` keeps one, because the effect pushing its result to the parent would otherwise loop |
| `react-refresh/only-export-components` | A module exporting both a component and other things | Breaks Fast Refresh for that module |

Note: the compiler stops analysing a file after a bailout, so fixing one
finding routinely reveals more in the same file. Re-run to convergence.

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
12. **`api/chat-intake` production-only import-resolution crash** (TC-AI-13) — fixed 29 Aug 2026;
    re-check with `npm run test:api-imports` on any change to `api/*.ts` or a module it imports, since
    `tsc -b` and `vercel dev` both pass even when this is broken.
13. **AI assistant button obstructing the wizard's Next/Submit control** (TC-SMK-08b / TC-UI-01b) —
    fixed 29 Aug 2026; re-check on any change to `AppLayout`, `SupplierPortalLayout`, or the AI FAB's
    size/position.
14. **Request-detail content duplication** (TC-REQ-D6/D7/D8/D9/D10) — fixed 29 Aug 2026; a page hook
    existing in the codebase does not mean it is wired to the UI (`useCreateFormSubmission` had zero
    callers), and a filter that looks complete may be missing an obvious field (`forStage()` never
    checked template `status`). Re-check the ownership table in `docs/specs/design-document.md` §5.3
    before adding new content to any request-detail tab or the header — the failure mode is a new
    section quietly duplicating one that already exists elsewhere on the page.

## Historical re-test results — build `index-LlQShsel.js` (2 Jun 2026, live-verified)
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

## Historical open questions (superseded)
1. **Deployment:** the new build isn't on `orchestration-ui-khaki.vercel.app` (same bundle hash; catalogue bug persists). Is there a **preview URL** to test, or should I wait for the production deploy and re-run? Please confirm the URL + that a new bundle hash is live.
2. **Audit scope:** do you want the full click-through executed by me against the new build (I'll run this playbook and log every Fail), or just delivery of the playbook for your QA to run?
3. **SOW generation timing** (from the assessment doc §10): up-front full draft vs. Q&A-then-generate vs. hybrid? (I recommend hybrid.)
4. **Test data:** OK to create/submit/approve real records in the demo DB during the run (the playbook includes write flows)?

## Current verification record — 30 Aug 2026

- ✅ Latest production alias: `https://orchestration-ui.vercel.app`, deployment commit `0bf9a93`.
- ✅ Admin/detail route sweep: 66/66 clean.
- ✅ Supplier route sweep: 8/8 clean.
- ✅ Requester route sweep: 9/9 clean.
- ✅ Neon validation: 44/44 repository tables, functions, governance links and orphan checks passed.
- ✅ Catalogue item detail and governed-checkout handoff verified without submitting live test data.
- ✅ Simple ↔ Expert mode switching and persistence verified.
- ⚠️ One malformed diagnostic probe queried `procurement_profiles.id` instead of `user_id`; this produced a controlled API error and is not an application defect.

Future runs should append a dated record here rather than replacing earlier results. Role-switching
checks remain simulation coverage; authentication and production authorization are intentionally deferred.

## UI-only procurement lifecycle run

`npm run test:ui-full` drives the live Vercel app through the visible role switcher. It covers
Simple and Expert catalogue checkout, contract call-off, full intake, sourcing, receipt, invoice
matching, approval and the internal scheduled/paid payment tracker. The suite never impersonates a
user through localStorage or calls application APIs directly. Screenshots and a manifest are kept in
`docs/testing/artifacts/ui-e2e/<run-id>/`; records are retained with a `UI-E2E-<timestamp>` prefix.

Required fields are asserted at the current stage only. Optional expert fields remain collapsed and
cannot block progression. A missing UI action, unavailable live fixture or lifecycle error is written
to the run manifest rather than silently bypassed.
