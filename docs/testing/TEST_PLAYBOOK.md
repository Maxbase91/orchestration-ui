# Procurement Orchestration UI — Full Test Playbook

**Purpose:** a complete, repeatable regression script covering every page, role, and path in the application. Run it end-to-end before each release (or after major changes) to confirm nothing is broken.
**App:** orchestration-ui · **Last updated:** 12 September 2026

The roadmap status and implementation references are maintained in the [R1 roadmap](../roadmap/R1_BACKLOG_FIT_GAP.md)
and its [implementation evidence index](../roadmap/R1_IMPLEMENTATION_EVIDENCE.md).

> **Deployment note:** the live alias is `https://orchestration-ui.vercel.app`. The verified
> commit is whatever `main` last pushed green — read it from the Actions run rather than
> from here, because a pinned hash in a doc goes stale silently.

## 2026-09-12 lifecycle and forms placement

**Scope: `npm run test:forms`, `npm run test:models`.**

Investigating a request stuck in validation for seven days found three
definitions of who owns that stage — the template's role label, a hardcoded
list in the UI, and the `category_managers` table — none of which agreed. The
gate now reads the assignment; validation itself runs only on the
procurement-led path, since a catalogue item and a framework contract carry the
categorisation the stage exists to check.

Forms were matched to a request by stage alone, so every request in validation
rendered 22 fields of risk questionnaire whose completion changed nothing —
`form_submissions` is empty across the whole store. All eight templates were
reviewed and placed where they can be answered; two were retired (one asks only
what the intake triage and supplier record already hold, the other duplicates
the goods-receipt mechanism that actually advances the request), and one had
been sitting on a stage id that does not exist, so it had never fired.

`test:forms` pins both defect classes against the seed data and the live table.
`test:models` asks Groq and Gemini what they serve and fails on a pinned id that
is gone — the check that was missing when `gemini-2.0-flash` was shut down.

## 2026-09-12 security assessment tranche

A full-codebase security review of the `/api/db` boundary, the assistant's
confirm-before-act path, and the server handlers. Authentication is still
deferred (ADR-0003); everything below is a control the code *claimed* to have,
or an integrity defect that survives adding authentication.

**Scope: `npm run test:db-casts`, `npm run test:assistant-boundary`,
`npm run test:neon-migration`.**

| What was wrong | What now holds |
|---|---|
| `assertFilteredWrite` tested only that a filter existed. `neq` with a null value and `is` with any non-null value both compile to `col IS NOT NULL`, so one filter emptied a table. | A destructive write must narrow with `eq` on a real value, or a non-empty `in`/`cs` set. An or-group counts only when every clause narrows. `test:db-casts` covers each bypass and each real caller shape. |
| `/api/db` returned raw Postgres error text. A unique violation embeds the conflicting row value, so the endpoint was a read oracle. | Only a typed `DbRequestError` is echoed, with a code; database errors are logged and answered generically. Same split applied to `contract-scope`, `contract-vocabulary` and `chat-intake`. |
| The confirm card rendered the model's `read_back` while `action_type`/`action_params` executed separately. Nothing compared them, and untrusted text reaches the model every turn. | The card's sentence is built by `api/_action-description.ts` from the action and its parameters, with ids resolved to names and the targets listed. An action with no template shows no Confirm button. |
| `remember_preference` accepted any key and value, and that row is read into the system prompt of every later conversation. | Four allowlisted keys, capped values, rendered as a labelled list marked as data. |
| Only the purchase-order branch of the assistant was scoped to the caller; `requestor_id` was a model-settable filter. | Requests, POs and invoices scope to requester-or-owner. Suppliers, contracts and risk assessments stay unscoped by design, and a check pins that as a decision. |
| `workflow-action` wrote any string into `requests.status`. | The stage must exist; a check asserts the guarded set still equals `RequestStatus`. |
| `execute-action` took the actor's name from the request body and reported success on any audit-id collision. | The name is read from the directory; a collision must be the same action by the same actor before success is reported. |

**Known and accepted, not closed.** Authentication (ADR-0003) — every check
above is scoping and integrity, not authorization. Approval eligibility
(`canActOnApproval`) is still enforced only in React, and `workflow-action`
validates that a stage exists, not that this request may enter it next. The
Supabase row-level-security scaffolding has since been removed
(`npm run backfill:drop-rls`, ADR-0003); `test:schema-drift` fails if a policy
returns to `db/schema.sql` or to the live database.

**A test that polluted the store.** `test:derived` deleted its fixtures with a
pattern match and never read the error. The new write guard refuses a pattern
match, so the suite leaked a contract per run into the live database until
`test:neon-live` failed on contracts with no scope metadata. It now selects by
prefix and deletes the exact ids it found, and checks the error. Any suite that
writes to the live store should do the same.

## 2026-09-05 correctness and de-duplication tranche

Eleven confirmed defects, and the duplicated code several of them lived in. The
theme was two of everything: two seed endpoints, two query dialects, two ticket
writers, two preference writers.

Removed outright: `/api/seed` (unauthenticated, upserted demo rows straight over
the production store, no caller), `/api/conversations` (no caller), and
`src/lib/db-query.ts` (a second PostgREST-shaped dialect over the same executor).

Behaviour that changed and needs re-testing by hand:

| ID | Steps | Expected |
|----|-------|----------|
| TC-WFA-01 | Drag a card between columns on the Kanban board | The card moves and stays moved after a refresh. The request's timeline shows the new stage; the previous stage is closed |
| TC-WFA-02 | Reassign a request from its detail page | Owner changes AND the timeline records the handover. Previously the reassignment was recorded nowhere, because the stage had not moved |
| TC-WFA-03 | Reassign to the current owner (no change) | Succeeds, and writes no timeline entry — a handover that did not happen is not recorded |
| TC-AST-01 | Ask the assistant to set an approval delegate, confirm it | Reply names the delegate; Settings shows it; the audit log has the entry. Previously the reply said "Done" and nothing at all was written |
| TC-AST-02 | Ask the assistant to raise a contract renewal, confirm it | Reply names a real `TKT-` id with a due time, and says nothing was sent to the contract system. The ticket appears in the support queue **with an SLA** |
| TC-AST-03 | Ask the assistant to add a watcher | It says plainly that watchers do not exist yet and that nothing was recorded, and points at the request timeline. No audit entry |
| TC-AST-04 | Ask the assistant to substitute an approver | Refuses, explains that it would erase who was originally asked, points at Delegate on the approval card |
| TC-REQ-90 | Submit a new request; note the id on the confirmation screen | Id is `REQ-YYYY-NNNNN` from the database sequence, five digits. Never a `REQ-2025-nnnn` four-digit value |
| TC-REQ-91 | Submit, then submit the same attempt again (double click, or retry after a timeout) | Reaches the confirmation screen both times with the SAME id. Previously the retry showed "The server did not confirm the submitted request" for a submission that had succeeded, and minted a second id |
| TC-CHK-20 | Complete a contract call-off | Unchanged when scope data is readable. If the scope read fails the call-off is refused rather than accepted with blank evidence |

Automated coverage added with it — all live-database suites:

```bash
npm run test:workflow-atomic     # transitions commit with their stage history, and re-clock the SLA from the new stage's node
npm run test:checkout-gates      # a governed check cannot be skipped by its own read failing
npm run test:execute-action      # an assistant action writes a real record, or says it cannot
npm run test:shared-core         # one ticket/preference writer for browser and server
npm run test:request-id          # ids come from the sequence, monotonic, no collisions
npm run test:llm-json-mode       # the prose fallback returns prose on both providers
npm run test:ui                  # confirmation screen shows the sequence id
```

CI now sets `NEON_DATABASE_URL` and `REQUIRE_LIVE=1`, so these gate a push
instead of reporting SKIPPED. They write fixtures and clean up after
themselves; a run killed midway can leave `TEST-*` rows behind.

---

## 2026-08-31 lifecycle stabilisation tranche

Full-intake submissions enter the shared `validation` stage before any risk,
approval, or sourcing hand-off. The dispatcher also repairs a legacy orphan —
a request left in `intake` without stage history or a workflow instance — on a
safe retry, without overwriting requests that already have lifecycle evidence.
This keeps partially persisted requests from being presented as complete.

The full-demand submit path now uses the dispatcher-routed `/api/intake-submit`
boundary. It validates the confirmed date, route, accounting and beneficiary,
then commits the request, structured service description, compliance record,
stage history, workflow instance and (when applicable) the initial approval
entry in one Neon transaction. A failed submission therefore cannot leave a
new partial request. Existing request IDs are replay-safe.

The shared catalogue checkout treats an empty draft date as an unhydrated
default and supplies a concrete need-by date before calculating the order
state. Receipt creation updates the linked PO status, and supplier
invoice entry resolves the supplier from the referenced PO. Request-linked
sourcing drafts now expose Edit and Publish gates; publishing requires
invitees, requirements and complete evaluation criteria before moving the
originating request to sourcing.

The assistant's latest-PO response is requester-scoped and no longer renders
tool/source markers. JSONB update parameters use explicit casts through the
Neon dispatcher, preventing conversation-history update failures.

Verification commands for this tranche:

```text
npm run build
npm run lint
npm run test:ui
npm run test:intake-submit
npm run test:api-domain-routing
npm run test:api-imports
npm run test:governed-checkout
npm run test:catalogue-order
npm run test:sourcing
npm run test:onboarding-stage
npm run test:unified-intake
npm run test:intake-guidance
npm run test:vercel-functions
npm run test:workflow-scripts
```

`npm run test:neon-live` and the atomic Neon integration suite require network
access to the configured Neon endpoint; when DNS/network access is unavailable
they are recorded as unavailable rather than treated as application passes.

---

## How to use this playbook

- **Environments:** record the URL + JS bundle hash (DevTools → Sources, or `document.querySelector('script[src*="/assets/"]').src`) so you know which build you tested.
- **Roles (6):** Requestor/End User · Strategic Procurement Manager · Vendor Manager · Procurement Operations Lead · Supplier (External) · Admin/Platform Owner. Switch via the top-right role switcher.
- **For each test:** follow Steps, compare to **Expected**, mark **Pass / Fail / Blocked**. On Fail, capture: route, role, screenshot, console error (DevTools console), network status (for `/api/db` or other API failures), and severity.
- **Per-screen baseline checks (apply to every page):** (a) page renders, no blank/white screen; (b) **no console errors/exceptions**; (c) no unexpected API 4xx/5xx; (d) no raw `undefined`/`NaN`/`0.xx%` confidence/`$\boxed{}$`/"Po"-style mangled labels; (e) all buttons do something (no dead controls); (f) date fields show real dates, not "Invalid Date"/"—" everywhere.
- **Severity:** BLOCKER (cannot proceed) · HIGH (core feature broken) · MEDIUM (degraded) · LOW/COSMETIC.
- **Write actions:** this playbook includes create/submit/approve flows. Run against a non-production/demo DB.

## Suite NEON — database migration and cutover

A **suite** without a database skips (exit 3, or a failure under `REQUIRE_LIVE=1`). A **data repair**
under `db/` does the opposite: it exits 1 and names what to set. The distinction is deliberate and
guarded — a backfill that skipped would write nothing and report it only in an exit code, which is the
same dishonesty as recording a check that never ran. `test:neon-migration` identifies a repair by the
npm script that runs it — `backfill:*`, `purge:*`, `migrate:*` — and fails if one can skip. It keys on
the script, not the directory, because `backfill:compliance` lives under `tests/integration/` and an
earlier version of this check only looked at `db/`.

**The offline browser suites must intercept `/api/db`,** the boundary the client
actually posts to. `test:requester-entry-ui` (and the since-retired experience-mode suite) stubbed `**/rest/v1/**` — the PostgREST path from before
the Neon cutover — so it caught nothing: every data call 404'd, the pre-check screen rendered a
heading over no catalogue and no contracts, and two of its checks failed for months against what was
really a crashing screen. Use `installDbStub()` from `tests/ui/db-stub.mjs`; its third argument
takes `{ fail: ['<relation>'] }`, which answers those relations with the 500 the endpoint returns
when a read cannot be served — the only way a suite reaches a screen's **error** state, since a stub
that always answers can only ever exercise loading and loaded. The offline browser
suites named in `.github/workflows/ci.yml` run in CI. That list is explicit — the rest of the
`BROWSER` set in `tests/run-all.mjs` needs a live Neon database or a server on :5173 — so it can
drift out of `package.json`, and `test:workflow-scripts` is what catches it when it does.

**Only `tests/lib/live.mjs` reads `.env.local`,** and `test:neon-migration` enforces it. Five scripts
had carried their own copy of that loader; two had no `try`/`catch`, so on any machine with the file
present they behaved identically and in CI — which has none — they died on `ENOENT` before the suite
could decide to skip. That kept the pipeline red for four commits while every local run was green.
**Run the suite once with `.env.local` moved aside before trusting a green local run**; that is the
only way to see what CI sees.

A repair is also split on **real** statement boundaries. The Neon HTTP driver has no multi-statement
mode, so `db/backfills/apply-sql.mjs` sends one statement at a time — and a `;` or `--` inside a
quoted string is data, not a boundary. `npm run test:sql-splitter` runs offline and pins both halves:
a naive split cut three JSON payloads containing "exceeds standard threshold; VP approval required"
in half, which PostgreSQL rejected as `42601 unterminated quoted string`, and a naive comment strip
would have deleted a `--` line out of the middle of a literal — writing wrong data rather than
raising. It asserts against the committed backfill, not a fixture: 39 statements, all `INSERT`, all
quotes balanced.

Run `npm run test:neon-migration` before any live copy. It verifies the dependency, environment
contract, the schema-apply script, API relation/function allowlists, and ADR. It also fails if any
`Supabase` identifier reappears in `src/`, `api/` or `tests/` — comments are stripped before the scan,
so a header explaining history is fine and an import, env-var read, client construction or UI string
is not. Only `neon-migration.mjs` itself is exempt, because its assertions have to name what is
absent. With a Neon connection
configured, run `npm run test:neon-live` for read-only schema, relationship, and catalogue-governance
checks. If the source catalogue predates explicit governance columns, run
`npm run backfill:neon-catalogue-governance` before that validation. Validate representative request,
catalogue, contract, risk, PR, PO, audit, ticket, and conversation records. The cutover is complete
and there is no provider switch left to flip: `NEON_DATABASE_URL` is the only database variable the
application needs.

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
Vercel Hobby plan's twelve-function limit; low-volume domain routes are rewritten to
`/api/db?domain=<name>` and dispatched inside `api/db.ts`.

The browser must never contain `DATABASE_URL` or `NEON_DATABASE_URL`. It holds no database credential
at all — it posts to the allowlisted `/api/db` boundary, and there is no second data path to configure
differently.

---

## Suite 0 — Smoke & global

### One-UI requester checks

The Simple/Expert switch, both forked pages and the pilot flags are gone (ADR-0008). What it
changed was copy and whether the workings were on the page at all — and it asked the requester to
choose a view before they could start. These checks cover what replaced it: one journey, evidence
shown to everyone behind collapsed disclosures, and simplification that comes from the role.

| ID | Steps | Expected |
|---|---|---|
| TC-UI1-01 | Sign in as any role and open New Request | The same four-step journey, with the same heading ("Start a request"). There is **no** experience-view switch anywhere in the shell |
| TC-UI1-02 | Sign in as a requester (`service-owner`) and open Home | The dashboard, with a layout that covers requester work — their own requests and requests-by-stage, not KPIs. The simplification is the role's default widget set, not a mode (`test:requester-entry-ui`) |
| TC-UI1-03 | Open a request detail as any role | The tabbed detail. The contract and purchase-order deep links that used to exist only on the removed Simple page are on the Related tab, and the purchase-order link stays role-gated (`test:link-route-integrity`) |
| TC-UI1-04 | Intake: describe catalogue, contract-covered and new needs | One recommended route with a plain-language explanation; only route-specific fields are requested. A new need is business-led or procurement-led, never a catalogue order or call-off without a real item or contract |
| TC-UI1-06 | Home command bar → type a demand → Enter | The typed demand opens on the commodity assessment already classified, the original text is visible, and the requester is not asked for it again. This handoff used to belong to the Simple home's demand box (`test:requester-entry-ui`) |
| TC-UI1-07 | Resize to 320px (or a half-screen desktop window) | The sidebar is **hidden** and a labelled menu button opens it as a drawer, with no horizontal overflow. The drawer existed but never closed — tailwind-merge dropped `hidden` beside a shared `flex` — and the old check only proved the drawer showed its links, which an always-open sidebar does. The platform is desktop-only (2026-09-23): this is the whole of its narrow-width behaviour (`test:requester-entry-ui`) |

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

## Suite REQ — requests (New request: the conversation and the Channel page; list; detail) — the core flow

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-01 | `/requests` All Requests loads | Table: ID/Title/Category/Status/Value/Owner/Days/Priority; badges correct casing ("PO" not "Po") |
| TC-REQ-02 | Sort each column; apply filters/search | Sorting + filtering work |
| TC-REQ-03 | Open a request → 8 tabs | Overview, Compliance, Workflow, Approvals, Documents, Activity, Related all render |
| TC-REQ-04 | Overview → AI Request Summary | Grounded summary (correct stage/value/channel); confidence shown as **whole %** (e.g. 92%) |
| TC-REQ-05 | Compliance tab (request past Validation) | **PR Compliance report renders** (decision, confidence, 6-category findings) — not "no report available" |
| TC-REQ-06 | Workflow tab | Lifecycle stepper + expandable step cards (handler/role/duration/dates) |
| TC-REQ-07 | Workflow actions: Refer Back / Reassign / Escalate / Cancel | Each fires, persists, writes audit entry |
| **TC-REQ-08** | **New request — describe (consulting):** send "management consulting firm to design a target operating model…" | Read back as **consulting — 80101600 Management consulting. Is that right?** (not Goods); the title is the words (a long brief is titled by its first sentence), and a value or supplier named in them is carried |
| **TC-REQ-08a** | **Classifier provider migration** (`npm run test:ai-api-config`) | Missing server configuration yields the controlled 503; the Groq classifier default is the supported `openai/gpt-oss-20b` replacement, overridable through the server-only `GROQ_MODEL` variable |
| TC-REQ-09 | The conversation misreads the need → **No — let me describe it again**, and say it differently | The new reading **propagates** to Your request, the Channel page and the submitted record. (There is no category grid — categories are derived, not chosen.) Another candidate code is one button: **It's …**; **None of these codes** keeps the category and leaves the code |
| TC-REQ-10b | A catalogue item that is not what you need → **Not what you need? Keep describing**, then add a detail | The detail lands in the transcript and **once** in the matching text (`demandDetail`, never the title); the re-check says what it found, without re-reporting the declined catalogue. It used to append to `title` while the box kept its contents — so the demand read "buy business consulting — IT strategy work — IT strategy work", the request was renamed to that run-on, and the click looked ignored |
| TC-REQ-10c | A demand with possible contract coverage the matcher cannot settle | The conversation asks **One detail decides it:** — in the matcher's own words when it has a clarifying question (ADR-0004) — and offers the contract only once it can be called off. No list of contracts that cannot be acted on |
| TC-REQ-10d | Any question with a typed answer | The cursor is **already in the reply box** — including after "Keep describing". The old "Add detail" button only set a flag that was already true, so the press did nothing visible (`test:ui`) |
| TC-REQ-10 | Phase 2 **How it is bought** (INT-10) | "Checked the catalogue — …; checked contracts — …" in one turn, then the way to buy: a **catalogue** item (ordered on the Catalogue page, with the policy's approval note), a **contract** to call off (supplier, end date, ceiling left, the direct call-off limit), or a **new request** — on its own when nothing covers it. A contract that also covers a catalogue item is offered on the catalogue card. Each offer is headed in its channel's **requester wording** (Admin → Workflows), not a code table; `test:requester-entry-ui` serves a template with its own headline and asserts the catalogue offer shows it. A ruled-out route **states its reason**. Answered offers stay in the transcript, their buttons disabled |
| TC-REQ-11 | Phase 3 of a new request | The service description is asked and **builds on the right** (see Suite SOW); then the supplier; then the risk questions; then anything submit would refuse |
| TC-REQ-11e | The conversation asks for what submit requires (`npm run test:submission-requirements`, `npm run test:intake-conversation`, `npm run test:ui`) | A new request needs a title, a need-by date that parses and a cost centre — **one list** (`submission-requirements.ts`) that the server's 422 and "Buying channel confirmed" both read. The channel is not confirmed until all three are given, and the conversation names each and says to add it **on the right**. Charged to says "Needed before you submit", not "you can add it later"; the conversation no longer promises to leave the date open, and a date it gave up on is entered on the right. The budget stays optional (the server accepts zero). Approver avatars show at most two initials — a role-open approver by its role ("CM", not "CM—RFoAM") |
| TC-REQ-11b | Phase 3 dynamic conversation (`npm run test:demand-conversation`) | The next question is **answer-driven**, not a fixed script: already-answered facts are **carried forward** (never re-asked); questions **branch on category + value** (high-value consulting also asks timeline / acceptance / pricing / dependencies; low-value goods asks only the essentials). The same engine drives the LLM endpoint and the offline fallback. Requester location and "who it's for" are **never** asked here — they are on the right |
| TC-REQ-11d | Budget and delivery date are asked **last**, not second (`npm run test:demand-conversation`, `npm run test:service-description-config`, `npm run test:ui`) | Budget used to be slot #2, straight after the title — the requester's second-ever question, before they had said anything about what they needed. It is now asked after the description (objective/scope/deliverables/resources and any category-triggered sections), with the delivery date last of all. Answering **"not known"** twice on the budget question is accepted rather than re-asked forever: the first vague answer gets a retry hint, the second gives up on the slot and moves the conversation on (mirrors the pre-existing need-by-date behaviour). Both the built-in slot order (`demand-conversation.ts` `ALL_SLOTS`) and the runtime default template (`service-description-defaults.ts` `DEFAULT_SLOTS`) were reordered — they are two independently maintained serialisations of the same agenda and both had to change, which is why a config-level test alone did not catch the order drift |
| TC-REQ-11c | Who and where, in Your request (`npm run test:ui`) | **Requesting from** = the requester's country, **from their profile and read-only** (no editor); **Buying for** defaults to **self** and is edited in place → name type-ahead over the directory (external supplier excluded) to buy on behalf of someone else; **Charged to** is the profile's cost centre, edited in place. Captured fields persist on the request and surface on the detail overview (Requester Location / Buying For) |
| TC-REQ-12 | The supplier question (`npm run test:ui`, `npm run test:preferred-suppliers`) | Asked **after** the description and **before** the risk questions — the supplier decides them. The category's preferred suppliers are named and, on a sourcing channel, invited; **No — go to market** is an explicit answer; a supplier off the list is asked **why** in the reply box and, when Decisioning thresholds say so, adds the category manager to the approvals. With AI-005 active its ranking is offered as buttons. A supplier not in the directory is created as a prospective record, and the conversation says what that means (screening, onboarding) |
| TC-REQ-13 | **Buying channel confirmed** → the Channel page | The card appears only when submit would accept the request, and Your request reads **M of M** at the same moment. The Channel page shows the stages, the checks and the approvers submit will write; **Back to the conversation** returns to it as it was left |
| **TC-REQ-14** | **Submit complex request** | Success; **persists**; appears in All Requests; opens at `/requests/{id}`; "Track this Request" works; free-text date ("By 31 Dec 2026") parsed to a real date |
| **TC-REQ-14a** | **Approval-chain persistence** (`npm run test:approval-chain-persistence`) | The value-banded `approval_chains.id`, not a routing-rule role label, is written to `requests.approval_chain`; a self-cleaning database insert proves the foreign key round-trips |
| TC-REQ-15 | Any new request (`npm run test:ui`, `npm run test:intake-conversation`) | Captured by the **conversation** — there is no form path. The plain form for the renewal and supplier-onboarding categories was retired with those categories (2026-09-25); a new request with only a title and a value is never confirmed |
| TC-REQ-16 | A demand the catalogue serves ("printer paper") | The catalogue offer, each item with **Order it** — which adds it to the basket on the Catalogue page (Door 2, ADR-0009) |
| **TC-REQ-17** | **Catalogue order via command bar → Add → Order Now** | **Order succeeds & persists** (NO "invalid input syntax for type date" error); appears in POs / requests |
| TC-REQ-18 | Catalogue order €5k–25k | Triggers line-manager approval (not auto) |
| TC-REQ-19 | Save as draft | Offered on the Channel page before submitting; the draft is saved and retrievable |
| TC-REQ-20 | Submit a demand in each remaining category (Services, Software, Contingent Labour) and a renewal | Each routes and submits correctly; a renewal is a demand like any other, recognised by the contract check |
| TC-REQ-21 | Retired channels (`npm run test:routing-fallback`, `npm run test:reference-data-ui`) | Direct PO and P-card are retired (2026-09-25): neither is in the channel list, no template claims them, no rule can route to them, and the P-card thresholds are gone from `/admin/thresholds`. The three live Direct PO requests moved to business-led (two) and a contract call-off (one) (`backfill:retire-direct-po-pcard`) |
| TC-REQ-22 | Catalogue item detail + governed checkout (`npm run test:catalogue-ui`, `npm run test:governed-checkout`) | Catalogue entry points open the selected item; checkout captures fulfilment context; supplier/contract/risk/capacity gates and configurable whole-request auto-approval are enforced. If the deployed database predates the additive PR tables, run `npm run backfill:neon-catalogue-governance` for supplier/contract/risk coverage, then apply the governed-checkout section of `db/schema.sql`. |
| TC-REQ-22a | Contract call-off completion (`npm run test:intake-conversation`, `npm run test:ui`) | The conversation fills what it can from the words and the profile, says how much is left, and asks the rest one at a time — the value, the dates (a service's start and end), who it is for, the purpose, where it goes and what it is charged to (the last two by buttons or a list). A value above the direct call-off limit is refused **at the value**, with **Raise a new request instead**; an edit on the right goes through the same rules. Validation checks transaction, contract, supplier, risk, and capacity data; approval is a separate budget/authority decision, entered only when policy or risk requires it |
| TC-REQ-23 | Catalogue item route in full UI sweep (`npm run test:e2e-ui`) | `/catalogue/items/:id` renders through the app shell without a white screen or uncaught page error |

### Intake routing — catalogue vs contract vs new demand (INT-10)

The pre-check makes one explainable decision. These are the cases that broke it.

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-R1 | "I want to buy business consulting" | **Never** offers a catalogue item. The reported defect matched **Business Cards 500** (the word "business" hit the item name and carried the whole match) and the ThinkPad ("business laptop" in its description), while "consulting" matched nothing and cost nothing. The check line states the reason — "consulting demand isn't fulfilled from the catalogue" — and the demand becomes a new request |
| TC-REQ-R2 | Same demand, the ways out | The Catalogue page stays one click away (Home's second door, the navigation's Catalogue); a new request never shows a catalogue picker |
| TC-REQ-R3 | "a few laptops for a new starter" (goods) | Still matches the ThinkPad. This is the verbose-ask regression an earlier length-normalised matcher caused, and that a coverage-*fraction* rule would cause again — one naming word among five is a match, because circumstantial detail must not count against it |
| TC-REQ-R4 | "business cards for the sales team" (goods) | Still matches Business Cards 500. "business" is not banned — it just cannot carry a route on its own |
| TC-REQ-R5 | A matched catalogue item | Shows **which words it matched on**, beside its catalogue, lead time and price. A suggestion the requester can check is one they can reject |
| TC-REQ-R6 | Admin → Categories → toggle "Fulfilled from the catalogue" | Turning it on for a category makes the catalogue stage run for that category's demand; off skips it. A new or unmapped category defaults to **off** — a missed suggestion costs a click, a false one is TC-REQ-R1 |
| TC-REQ-R7 | Catalogue/contract sources unreachable | "I could not reach the catalogue or the contract register, so neither was checked and nothing was ruled in or out", and the conversation continues as a new request. Never an endless spinner, and never "no match" for a check that never ran |
| TC-REQ-R8 | AI-001 active, assistant intent disagrees | `api/ai.ts` returns `intent`, which the conversation reads instead of discarding. It is authoritative **except** that a `catalogue` intent cannot route to an empty catalogue — then the rules decide and the disagreement is shown, not hidden |
| TC-REQ-R10 | **Home page command bar** — type "I want to buy business consulting" | The catalogue is **not** opened. This is the reported defect's second home: the command bar is a separate entry point that had its own matcher — strip stop words, score an item on any word appearing anywhere in its name, description or catalogue name, return everything above zero — run **first**, before any intent or category reasoning, with no category gate. "business" hit **Business Cards 500** and the ThinkPad ("business laptop" in its description) while "consulting" matched nothing. It now calls `decideIntakeRoute`, so both doors make the same decision (`npm run test:assistant-intents`) |
| TC-REQ-R11 | Command bar, genuine catalogue demands | "business cards for the sales team" → Business Cards 500; "office laptops for a new starter" → ThinkPad; "printer paper" → A4 Paper. Ruling out consulting must not rule out the catalogue's actual job |
| TC-REQ-R12 | Command bar, LLM returns `intent: catalogue` for a consulting demand | Overruled — the demand goes to intake and the reason the catalogue was ruled out is shown, rather than a different screen appearing silently. Same guard the conversation applies (TC-REQ-R8) |
| TC-REQ-R9 | AI-001 disabled / LLM unreachable | Identical routing to the rules-only path. The deterministic layer is the fallback and is gated by its own eval (TC-GOV-02) |

### The conversation explains itself, and finishes (`npm run test:intake-guidance`, `npm run test:intake-guidance-ui`)

A requester should be able to tell, at any moment, where they are, what is being asked and why.
These are the cases where the old wizard could not.

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-G1 | Open New request | It opens with **one open question** — "What do you need? Say it in your own words…". The header names the three phases (What you need · How it is bought · What it needs) and marks the current one; the assistant's status line says what it is doing; Your request's legend says where each value comes from. No stepper, no Next to walk past |
| TC-REQ-G2 | Phase 1, after the words | **One** turn: "That sounds like *category* — *code label*. Is that right?" A supplier or value named in the words is carried as a suggestion — the supplier is confirmed at the supplier question. Nothing claims the channel yet |
| TC-REQ-G2a | Phase 1, any demand | The requester never chooses or sees a Goods/Services split. Up to two other candidate codes are offered as **It's …**, with **None of these codes** |
| TC-REQ-G2d | Attach a PDF/DOCX | Before anything is said, the document **is** the description: the turn shows its name and opening lines, and it is classified. After, it is attached to the request. Unsupported, oversized, or unreadable files show a recoverable message under the reply box and never block typing |
| TC-REQ-G2b | Phase 1, after the words are confirmed | **No generated business justification.** Phase 1 classifies; it does not author the justification. The offline fallback used to emit boilerplate — "Business need: <your words>. This procurement supports business operations and is raised via the front door for classification, risk assessment and routing…" — which restated the input and said nothing, and the chat path overwrote it anyway |
| TC-REQ-G2c | Finish the service description, then open the request | The **justification is the service-description narrative**, on the LLM path as well as the offline one. Only the offline fallback set it, so on the LLM path the request carried the describe step's seed and never reflected what the requester actually described |
| TC-REQ-G3 | Answer "Is that right?" | No accepted banner and no auto-advance: the answer is a turn in the transcript, and the question's buttons stay on screen, disabled |
| TC-REQ-G4 | Phase 2, any demand | The way to buy is said as soon as it is known, and a new request's turn names its channel in the template's words; the Channel row on the right names the rule that decided it |
| TC-REQ-G5 | Phase 2 → the Channel page, same demand | The channel on the right **equals** the one the determination computes. Both call `resolveDemandChannel`; a second derivation would be the drift this codebase keeps paying for |
| TC-REQ-G6 | Your request → Urgent → Yes | The editor states, from the live rule set, that the request now goes to Procurement-Led Sourcing instead of its current channel — and says **nothing** when urgency would change nothing |
| TC-REQ-G7 | Finish the service description | Included, Excluded, Deliverables and Acceptance Criteria are separate sections, each edited in place on the right. No Business Justification field is shown and the narrative is not copied into the legacy field |
| TC-REQ-G8 | Submit a complete request | The server creates the request and stage history, then transitions to validation/risk/approval/sourcing as applicable. A successful complete submission is not left in `intake`; genuinely incomplete information remains there with the missing fields visible |
| TC-REQ-G7a | Answer every question | Your request reads **M of M** and the service description counts its required sections; the old progress bar reads 100% the same way. The denominator is the questions this demand is actually asked, not a fixed 14 — which topped out at 57% (goods €8k), 64% (software €30k), 71% (services €60k) and 86% (consulting €400k) |
| TC-REQ-G8a | Your request, the service description's sections | Comes from the resolved template, not a hardcoded nine. A section the template marks `asked: false` (today, `location`) shows as **inferred**, not "Pending" — it is generated, never captured |
| TC-REQ-G9 | A conditional question | Carries an **"Asked because…"** line explaining why *this* demand gets it. The six mandatory questions carry none — a justification on every question is one the requester learns to skip. The copy is per-slot config, editable in the admin slot table |
| TC-REQ-G9b | Read any question the assistant asks | The question stands alone. Any worked example appears **beneath** it, labelled "Example". It used to be concatenated onto the sentence — *"What's the primary objective of this engagement? run a promptathon to upskill 40 staff on AI tooling"* for a demand that was "I want to buy business consulting" — which read as the assistant answering itself about somebody else's project |
| TC-REQ-G9c | Compare two questions in the same conversation | Both are styled the same. Only one of the two slot sources wrapped its example in "(e.g. …)", so the budget question showed the wrapper and the objective question did not, in the same chat |
| TC-REQ-G9d | The service description with AI-001 active | Questions are phrased **against what the requester described**, not read from a script. The endpoint has always generated that phrasing; the client discarded it and rendered the canned string, which is why the chat felt static even with the LLM up. The engine still chooses **which** slot is asked and **when** the conversation is complete — only the wording comes from the model, and only if it comes back as a single short question |
| TC-REQ-G9e | The service description offline (LLM unreachable) | Canned wording, with the example hint shown — a generic example earns its place only when the wording is generic too |
| TC-REQ-G9f | Answer a question with "bla" | The assistant **challenges once**: it names what is missing and, where it can ground one in what you already said, offers a drafted answer with **Use this** / **I'll write it**. The answer is NOT written into the slot. Accepting the draft records the section as `assistant-drafted`; answering again with something thin is accepted and recorded as `weak`. Never a hard block — a requester who cannot phrase it is never trapped |
| TC-REQ-G9g | Your request after a challenge | The section carries its provenance — "drafted for you" or "needs detail" — and it is persisted to `service_descriptions.capture_flags`, so a reviewer downstream sees which parts of a description nobody really wrote |
| TC-REQ-G9h | The LLM up vs down | The assistant judges the answer when it is available; the deterministic floor (`lib/procurement/answer-quality.ts`) judges when it is not, so the offline path is not a free pass for "bla". A malformed verdict from the model falls back to the floor rather than approving |
| TC-REQ-G9i | **The description completes** | Answer the mandatory slots and the conversation moves on to the supplier. It previously could not: the offline fallback wrote answers to local state only and never called `onUpdate`, so `formData.serviceDescription` stayed empty and the gate saw nothing captured. With no `GROQ_API_KEY` the preview always took that path |
| TC-REQ-G10 | A new request with only a title and a value | The channel is **not confirmed**: the conversation keeps asking. The gate calls `requiredSlotsFilled` — the mandatory-SOW floor the engine defines — which the old chat component had computed and never consulted. Conditional enrichment never holds it |
| TC-REQ-G11 | A renewal or supplier-onboarding demand | Takes the conversation like any other demand. Those categories had a plain `step-details` form exempt from the floor; both categories and the form were retired (2026-09-25). A renewal is recognised by the contract check (expiring covering contract → contract type *renew*, sourcing type *renewal*); onboarding is the Vendor Onboarding stage when the supplier is new |
| TC-REQ-G12 | The service description ends | "That covers the service description — N answers", and who reads it: the risk assessment and any sourcing event, so it is not asked again. The same close whether or not the LLM is up. Giving up on the last open question (a date that never parsed) closes it too — it used to ask for that date again |
| TC-REQ-G13 | Open a request, click through **every** workflow step | No screen throws. The step detail pre-populates risk forms from the service description; it used to cast the whole stored record — which carries a quality score, two arrays and two objects beside its nine text sections — to a map of strings and trim every value, so the first non-string member crashed the page with `r?.trim is not a function`. `sectionValuesOf()` narrows at the boundary; `test:intake-guidance` scans `src/` for both the cast and the unguarded walk, and `test:request-detail-ui` drives the real screen against fixtures — it white-screens on the pre-fix code |
| TC-REQ-G14 | Raise a sourcing event from a request that has a description | Requirements seed from the **text sections only**. Same cast, same crash class, second call site |

### The legacy-client suites now run against Neon

Ten integration suites plus the interactions browser suite built their own client against the retired
project and asserted against a database that is no longer the system of record — about **1,800 lines,
84 queries** outside the gate, skipping on every run.

Migrating them was a client swap, not a rewrite: every query method they use
(`from/select/eq/single/filter/update/limit/insert/delete/order/in/maybeSingle/neq/is/like`) is
implemented by the compatibility client, so the bodies were untouched. `neonClient()` in
`tests/lib/live.mjs` builds one over the in-process executor — the wiring `api/_db-admin.ts`
already uses — so a test needs no running deployment. `like` had to be added to both the client and
`/api/db`, which only had `ilike`; `test:db-casts` now pins the whole operator surface on both sides.

| ID | Steps | Expected |
|---|---|---|
| TC-DB-6 | `npm run test:all` with `NEON_DATABASE_URL` set | The ten report **passed**, not skipped. Without it they skip cleanly (exit 3) |
| TC-DB-7 | `REQUIRE_LIVE=1 npm run test:all` on a machine with the credential | They must genuinely pass. This is the check that proves the migration rather than the guard |
| TC-DB-8 | After a run | No `E2E-*`/`TEST-*` rows survive. These now write to the live Neon store, so their existing self-cleanup matters in a way it did not against a retired project |

`@supabase/supabase-js` is gone from `package.json`. The two scripts that needed it — the one-way copy
and the 2026-08-29 catalogue backfill — read *from* the retired project and have been deleted; every
remaining repair runs against Neon alone. `test:neon-migration` fails if the dependency, the
environment variables, the server fallback, or the identifier itself returns.

### The data layer says what it means (`npm run test:db-casts`, `npm run test:mode-equivalence`, `npm run test:intake-evidence`, `npm run test:intake-determination`)

Four suites covering the defect classes found when the old provider was retired and the browser
client stopped being cast to something it is not — plus the two that keep the intake honest: one
determination for both densities, and no record of a check that never ran.

| ID | Steps | Expected |
|---|---|---|
| TC-DB-1 | Filter any column that is not text | The parameter is cast to the **column's** type. Every string used to be cast `::text`, and PostgreSQL has no implicit text→uuid/date/timestamptz cast — `"valid_until" > $1::text` fails with `operator does not exist: date > text`. Risk-assessment reuse matching threw; assistant conversation writes (uuid keys, no error check) failed silently |
| TC-DB-2 | Add a column type to `db/schema.sql` with no cast mapping | `test:db-casts` fails. The suite reads the types out of the schema, so it cannot go stale |
| TC-DB-3 | A `.single()` that matches nothing | Errors, as the client it replaced did. `.single()` and `.maybeSingle()` were the same request, so a not-found `.single()` returned `{ data: null, error: null }` and callers mapped null instead of throwing |
| TC-DB-4 | The Mentions widget, and `/admin/ai-analytics` | Both work. `.contains()` had no implementation (TypeError every 60s, silently empty widget) and `select(..., { count, head })` dropped its options (total permanently 0, every row fetched) |
| TC-DB-5 | An `.or()` fragment that does not parse | Throws. It used to be dropped, and when every fragment was dropped the clause vanished and the query returned the **whole table** |
| TC-DB-9 | Write `''` to a date, timestamp, numeric, boolean or uuid column | It lands as SQL `NULL`. `''` is a legal value for a text column and for nothing else, so a cleared form control killed the write with `invalid input syntax for type date: ""` — which is how "Save as Draft" failed for any demand with no delivery date. Coerced in `parameterValue`, so every writer is covered rather than the one that was reported; text columns and real values are untouched (`test:db-casts`) |
| TC-MODE-1 | The same catalogue demand in Simple and Expert | One `GovernedCheckoutDecision`. Expert refused an ambiguous item ("procurement must select one") while Simple matched on lower-cased supplier **name** and picked the latest end date; Expert filtered risk assessments to completed and unexpired, Simple filtered on neither; Simple dropped `shipToLocationId` entirely, so a stored profile silently replaced the requester's chosen delivery location |
| TC-MODE-2 | The same demand determined in either density | An identical `IntakeDetermination` and a byte-identical compliance record. Simple used to skip the risk and determination screens entirely, deriving its own channel from a *preliminary* signal read that could not see the mini-IRQ, while Expert used the full cascade but never passed P-card eligibility — two channels for one demand, decided by which screen you were on |
| TC-MODE-3 | Read `src/lib/procurement/intake-determination.ts` | It takes **no** `density`/`mode` parameter and contains no `'simple'`/`'expert'` literal. The switch it was written for is gone, but the rule outlives it: presentation may not reach into how a determination is reached |
| TC-MODE-4 | Look for a second intake page | There is none. `simple-new-request-page.tsx` is gone and one page serves everyone; nothing may branch a step (`setStepId`) or the submit on presentation. Two pages drifted into different governance outcomes twice despite sharing components — there is now nothing to drift |
| ~~TC-MODE-5~~ | ~~Switch density on `/requests/new`~~ | **Withdrawn (ADR-0008).** There is no switch. Its own defect — the switcher and the page disagreeing while a preference write landed — is one of the reasons it is gone |
| TC-DASH-1 | Add each purchasing/vendor widget from the picker | **Open Purchase Orders** lists POs awaiting delivery or closure, overdue first, excluding draft and closed. **Invoice Exceptions** lists only invoices needing a decision — disputed, unmatched, variance, overdue — with one reason per row. **Suppliers Blocking Work** lists suppliers whose onboarding or screening gates sourcing/contracting/a PO. **Requests by Stage** counts the active stages and clicks through, excluding terminal states |
| TC-DASH-2 | Read `widget-registry.tsx` against `widgets/index.ts` | Every id appears in both. An id in the registry alone adds an invisible tile; an id in the renderer alone is unreachable. Every registry icon is in the picker's icon map, or the tile silently falls back to a generic one (`test:dashboard-widgets`) |
| TC-DASH-3 | Open Home as each role | Every id in the role's default layout resolves to a widget the role is entitled to, and the purchasing/vendor widgets (**Open Purchase Orders**, **Invoice Exceptions**, **Suppliers Blocking Work**, **Requests by Stage**) are on a default dashboard rather than only in the picker. A widget reachable only by hunting in "Add Widget" is one nobody finds — these four shipped that way (`test:dashboard-widgets`) |
| TC-DASH-5 | Break the read behind each dashboard widget | **Open Purchase Orders**, **Invoice Exceptions**, **Expiring Contracts**, **Suppliers Blocking Work** and **Requests by Stage** each say what they could not load. They rendered `data ?? []` and branched on `isLoading` alone, so a failed read showed "No open purchase orders.", "No contracts expiring soon.", "Every supplier is onboarded and screened." — reassurance in place of the one fact that warranted action. The other half is checked too: with the tables answering, no alert appears at all (`test:dashboard-widget-states`) |
| TC-DASH-6 | Open Home with an approval pending, then with it delegated to you, then with nothing waiting, then with the approvals table unreadable | The band above the grid names what is waiting on you — overdue first, then referred back, then approvals — and links to each. A delegated approval counts. With nothing waiting the band is **absent**, not an all-clear card; with an unreadable queue it says so, because silence has to mean "checked, nothing found" (`test:dashboard-widget-states`) |
| TC-DASH-7 | Look at Home, then press Customise | At rest there is no drag handle, remove button, Add widget or Reset on screen. In the mode all of them appear, together with Quick actions — which is what the header's "Customise" used to open, despite its name. A reload leaves the mode (`test:dashboard-ui`) |
| TC-TASK-1 | Delegate an approval to someone, then open their `/approvals` and `/tasks/my-tasks` | Both show it. `/tasks` checked `approverId` alone, so the delegate saw the approval in one list and not the other. `personal-queue.ts` is the one definition and `test:personal-queue` fails if another module writes its own |
| TC-REQ-L1 | From Home, follow "past the stage SLA", "sent back to you", and a stage in Requests by Stage | Each lands on exactly the rows it counted — yours and late; sent back to you; that stage. The list read no parameters, so all of them opened every request in the system. The active filter shows as a removable chip with "N of M requests" (`test:request-list-ui`) |
| TC-REQ-L2 | Open `/requests?status=aproval` | The list says it ignored a filter it does not recognise. Dropping it silently would show everything under a URL the reader believes is filtered (`test:request-list-ui`, `test:request-list-filters`) |
| TC-REQ-L3 | Read the Priority and Stage columns in greyscale | Priority is written ("Urgent"), not only a coloured dot; a late request reads "12d · late". Stages in progress are neutral-accent, not amber — amber is for waiting on a decision (`test:request-list-ui`) |
| TC-INT-C1 | Decline a catalogue offer ("Not what you need? Keep describing") and continue to a new request | The service description opens. The old shortcut stored the catalogue *route* as the form's *category*, and a catalogue category on the full-request route matched no branch — an empty step whose gate asked for a title and value it had no field for. No intake module writes a route into the category (`test:unified-intake`) |
| TC-REQ-D1 | Open a request you can act on | The header has one filled button — the stage's next step — with Approve/Reject beside it when you are the approver, and Refer back, Reassign, Escalate and Cancel request in **More**. It used to carry up to seven buttons across two rows, three of them solid (`test:request-detail-ui`) |
| TC-REQ-D2 | Read the Overview tab | Facts in three groups (What / Who / When), configured category and channel labels, and no "AI-generated" panel — it was a sentence template in `lib/mock-ai.ts`. The service description shows its quality score, which read a snake_case key from a camel-cased record and never rendered (`test:request-detail-ui`) |
| TC-REQ-D3 | Read the lifecycle stepper | Equal columns and connectors; the current stage in the accent, not a pulsing amber; stage names at caption size; an upstream handover says "Timed out" / "Awaiting response" in words and tone, not only by chip colour (`test:request-detail-ui`) |
| TC-REQ-D4 | Open a request while the requests table is unreadable | "This request could not be loaded" — not "does not exist or has been removed", which it used to say for loading and failure alike (`test:request-detail-ui`) |
| TC-DASH-4 | Add a widget, reload; remove a widget, reload | Both stick. The layout store was not persisted, so every customisation was discarded on the next page load — from the user's seat, indistinguishable from a button that does nothing (`test:dashboard-ui`) |
| TC-PROF-1 | Open the header user menu | It shows the name, email and **location**, and links to Profile & settings. The location drives "requesting from" on every request |
| TC-PROF-2 | Open `/settings` → Profile | Shows the directory identity **and** the procurement defaults intake reads from — cost centre, currency, budget owner, legal entity, default delivery location. Approved ship-to locations are read-only: a governed checkout rejects a location the profile does not approve, so they are administrator-maintained |
| TC-CC-1 | Order from the catalogue with a profile that has a cost centre | No cost-centre field is shown; the screen states what it charges to. The submit gate agrees with `evaluateGovernedCheckout`, which genuinely requires one — so the button is never enabled for an order that would be rejected, and never disabled with no field to satisfy it |
| TC-CC-2 | The same order with a profile that has no cost centre | The picker is still a picker — it just has nothing pre-selected, and says why. Every option is an active row of `cost_centres`. The five invented cost centres this screen once offered are gone, and so is the free text that replaced them: a typed value could only ever fail at submit (`test:ui`, `test:reference-data-ui`) |
| TC-CC-3 | A checkout that will not submit | The screen names the fields — "Still needed: a delivery location, a cost centre." — and marks them. It used to say "Complete the highlighted call-off details" with nothing highlighted, so a call-off blocked by a field the screen had derived rather than asked for looked complete and simply would not go (`test:ui`) |
| TC-CC-4 | A delivery location whose stored id is not in the approved list | The picker shows "Select a delivery location…", not a location. A `<select>` whose value matches no option displays the FIRST option's label, so the screen named a location nobody had chosen while the value stayed empty — the visible cause of TC-CC-3 |
| TC-CC-5 | Load a checkout before and after the requester's profile resolves | The profile defaults apply either way. They were seeded through a `useState` initialiser, which runs once, so whether a cost centre and delivery location were inherited depended on whether the query happened to be cached |
| TC-REF-1 | Admin → Cost Centres / Delivery Locations | Create and edit rows. There is **no delete**: requests store the code rather than a foreign key, so removing a row would orphan every record charged to it. Retiring a row keeps it readable on historic records and takes it out of every picker (`test:reference-data-ui`) |
| TC-REF-2 | Retire a cost centre, then start a checkout | It is not offered, and a checkout naming it is **rejected** — by `evaluateGovernedCheckout`, from the server's own read of the table. This is the check that could not fail before: the delivery location was validated against `approvedShipToLocations` on the profile, nothing ever populated that list, and the server fell back to the profile the **browser** sent when no row existed (`test:governed-checkout`, `test:governed-checkout-atomic`) |
| TC-REF-3 | A caller that cannot load the reference data | The checkout is rejected, not waved through. Absent evidence must not read as approval (`test:reference-data`) |
| TC-REF-4 | The seeded cost-centre codes against existing requests | Every code already in the shipped data resolves to a seeded row, so no backfill is needed — the ids ARE the codes (`test:reference-data`) |
| TC-REV-1 | Reach the Channel page (full request) (`npm run test:ui`) | It opens with how the request will be bought, in the channel template's words, with the value, **stages that apply** ("10+ of 11" — the + for a stage that depends on something not yet known) and **stage targets**. Step by step lists every stage of the template in graph order — owner, target days, purpose — tagged *You are here* / *Applies · why* / *If the supplier is new* / *Skipped · why*; Intake says "You: Describe what you need and submit it." Submit says where it goes first ("sends it to Validation (Category Manager)"). It replaced Review & submit, whose fifteen cards put the channel, three risk readings, two approval panels and every policy result at one weight |
| TC-REV-2 | A demand with no supplier selected, on the Channel page | The checks must not claim contract coverage (*No contract covers this yet*), and a lapsed contract with the chosen supplier is named rather than reported as none (`test:second-contract`). `runSecondContractCheck` requires a supplier — without one it matched **any** contract in the category, so the screen said "a usable contract covers this demand — transact directly" about an agreement with a company nobody had chosen, while also saying "No existing contract found" and "no existing agreement". Worse, that stray `transact` fed `earlyExit` and **switched off the approval-to-source gate** |
| TC-REV-3 | Read the inherent-risk tier | It appears **once**, in the Channel page's workings. It was stated twice on the Review step |
| TC-REV-4 | The checks, from the recorded object (`npm run test:channel-checks`) | Real determinations and call-off decisions: the first check is the channel with the matched rule's own description; a switched-off validator reads *Policy checks did not run* — never the "Enable it in Admin" line the record carries; approvers still loading give **no** line, never *No approval needed*; every failed policy check is listed, no passed one; missing required sections are named and submit stays possible; risk *needed* / *reused* (with its date) / *not needed*; sourcing invites counted with their preferred ones, *nobody invited* left to the Supplier section; an override names the category manager only when the thresholds say so; approvers in step order; a call-off's auto-approval, approvers, risk review, amendment and refusal. Verified by leaking the admin line and showing loading as *No approval needed* — both fail |
| TC-REV-5 | Approvers are the ones submit writes (`npm run test:approval-bands`, `npm run test:approval-derivation`) | `chainIdFor` — the pinned chain, else the band, else the standard chain — is what both writers and the Channel page use; `useApproversOnSubmit` passes the category, cost centre, contract and override step. The Review preview chose from the band alone and left out the cost centre. A recursion in `chainIdFor` that only the page would have run is now caught by `test:approval-bands` |
| TC-CONF-1 | Submit and read the confirmation | "What happens next" lists the determination's **own** handoff steps — the same list Review showed. It must not name a person ("reviewed by Anna Müller"), promise a fixed SLA, or promise email: nothing sends email, and no notification is created on a stage transition. `Classification` and `Commodity` were also the same value under two labels |
| TC-STEP-1 | Call off a contract (`npm run test:ui`) | The conversation asks the call-off's details, then **Buying channel confirmed** leads to its own Channel page — WF-008's stages landed by the checkout's rule (contracting skipped · contract used as it stands, risk skipped · existing assessment reused, *Applies · over €1,000* on approval), the checks from its governed decision, and **Submit the call-off**. The call-off form used to submit directly under a button that read "Review request" |
| TC-CB-1 | Type a demand with no buy verb — "business consulting", "cleaning services for the Berlin office" | It routes into intake. Recognition is by what the phrase **names** (the category rules), not by a hardcoded verb list; only an explicit lookup opener ("find …", "show me …") reaches the assistant |
| TC-CHAT-1 | Open the service-description step | The message box is **enabled**. Under StrictMode the opening effect is run, cleaned up and re-run; the re-run no-ops, so the first run's `cancelled` flag must not gate `setIsTyping(false)` — when it did, the input was disabled forever and the step was unusable |
| TC-CHAT-2 | Answer the need-by date with something unparseable, twice | It is asked twice, then left open ("we will leave the need-by date open"), and the same turn asks the **next** question rather than the abandoned one. It used to re-ask indefinitely |
| TC-CHAT-3 | Read any question in the conversation | Each carries "Asked because …". The reasons must be present on the slots **as the app resolves them** — from the serialised default template, not the in-code set; eight reasons existed only in the latter and none of them ever reached a screen |
| TC-AI-H1 | Ask the assistant "I need to buy business consultant" | It offers New Request **with the requester's words** and says nothing exists until they submit it (it used to say "a pre-filled consulting request" — nothing was pre-filled; intake classifies the words). It must never answer "your request has been routed… we'll begin the process" — nothing is created, routed or begun; a deep link is offered. Three defences: the tool result states `created/submitted/routed: false`, the system prompt forbids completion claims, and a deterministic guard replaces the sentence if the model claims one anyway (`test:assistant-honesty`) |
| TC-AI-H2 | Confirm an assistant action such as a risk reassessment or PO change | It says the action is noted for the session, that **nothing has been sent**, and where to raise it directly. It used to answer "Task created and routed to the relevant team. Reference: ACT-1234. You'll be notified when they respond" — for six action types that push to an in-memory array with no consumer |
| TC-CAT-BASKET | A catalogue basket across suppliers (`npm run test:catalogue-basket`) | Items from two suppliers become **two orders**, placed in one transaction. Approval is judged on the **basket total**: two orders under the auto-approval threshold that together exceed it both go to approval and no PO is raised. The total is the server's, from stored prices — a client claiming €1 changes nothing. A retry returns the same orders; a basket only part of which exists is refused; a reused key for a different order is refused (ADR-0009) |
| TC-LINK-1 | Open `/requests/new?q=a few reams of printer paper` | The describe step is seeded with the words and classifies them itself; the category is never taken from a link. The `?step=2&category=…` link — which could carry `catalogue`, a route, as a category — is gone with its last producer (the Home box and the assistant take one question route since 2026-09-25) and is no longer parsed (`test:unified-intake`, `test:assistant-intents`) |
| TC-LINK-2 | Order this / Add to order, from Home, the assistant, an item's page or intake's catalogue match | Each lands on the **Catalogue page** with the item in the basket — once (the add ran twice under React's strict mode and ordered two). The `?catalogueItem=` return trip into a one-item checkout inside the wizard is retired with it (`test:catalogue-ui`, `test:ui`) |
| TC-CAT-PAGE | The Catalogue page (`npm run test:requester-entry-ui`, `npm run test:ui`) | Catalogues are the items' own; items from two suppliers show "Placed as 2 orders"; under the threshold the note says it becomes a purchase order straight away, over it (on the **basket** total) that it is approved before the purchase order is raised; Place order waits for deliver to, charged to (active reference rows only) and a purpose; placing sends one basket call with every order decided on the total, names each placed order with what happens next, and empties the basket |
| TC-DENS-1 | The Channel page's workings (`npm run test:ui`) | Checks lead, each a verdict with its reason — why this channel in the matched rule's own words, disposition, contract coverage, risk, the approvers submit will write, failed policy checks. *How this was worked out* holds the reasons behind them, collapsed, **for everyone**: materiality, inherent and operational risk, approval to source, contract and sourcing type, every policy check, next steps — and **Export**. A **blocking** result is a check, never behind the disclosure |
| TC-EVID-1 | Submit a request, then open its Compliance tab | There is **no duplicate check**. Nothing ever searched for duplicates; the record first said "No duplicate demand detected" (false), then an honest "Not checked", and the check was retired on 2026-09-25 — a check that can only say it did not run is evidence of nothing. The record no longer carries it (`duplicate_check` is nullable, no longer written) and the disposition no longer takes a duplicate input. `test:intake-evidence`, `test:referral` |
| TC-EVID-2 | Submit with a supplier whose SRA is `not-assessed` | The record reads **fail**, not pass. The outcome used to be derived by string-matching the rendered label (`sraStatus.includes('expired')`), so a never-assessed supplier — whose label contains neither "expired" nor "expiring" — recorded a **pass** for an assessment that did not exist |
| TC-EVID-3 | Disable the AI-002 Request Validator, then submit | The policy checks contain one failed entry naming the disabled agent, never an empty list. An empty list reads to a reviewer as "all clear" |
| TC-DET-1 | Determine the same demand twice, and again with a different `now` | Identical results; the channel, risk tier and policy checks do not move with the calendar. `now` is an input rather than three `new Date()` calls inside the evaluation |

### The request detail, driven offline (`npm run test:request-detail-ui`)

Every other browser suite needs a reachable Neon-backed API, so none of them run in a sandbox or in
CI — which is why a render crash on the request detail was found by a user rather than a test. This
suite stubs the data API inside the page (`tests/ui/db-stub.mjs`) and drives the real
screen against fixtures: no credentials, no network.

| ID | Steps | Expected |
|---|---|---|
| TC-REQ-D1 | Open `/requests/REQ-TEST-0001`, Workflow tab | The page renders. A throw during render leaves `#root` empty, so a white screen is reported as such with the error attached, not as a locator timeout |
| TC-REQ-D2 | The current stage's card | Opens by default, showing the description summary and its quality score. The crash happened here on **render** — before any click |
| TC-REQ-D3 | "Fill Out Form" on the risk stage | The mapped field carries the description's scope. Asserting only "nothing threw" would pass against a form that pre-populated nothing |
| TC-REQ-D4 | Collapse and reopen every step card | No uncaught error, and specifically no `trim is not a function` — named, so a returning regression says which one |
| TC-REQ-D5 | The stub's own report | No filter was silently dropped. A filter the stub does not understand would answer the app with rows it never asked for, and the assertions above would be meaningless |
| TC-REQ-D6 | Request detail, Workflow tab | Shows **one** stepper, not two. The page header's `LifecycleStepper` already shows the full 11-stage timeline on every tab (and deep-links here via `focusStageId`); the tab body used to render an identical "Current Workflow Position" card on top of it — removed. The tab's own content (per-stage detail cards, attached template table, Refer Back/Reassign) is unchanged. Each stage's comment area is now **one** thread, not two — real comments merged with that stage's historical entries (`WorkflowStepDetail.comments`, confirmed dead-write, previously shown a second time in its own box) |
| TC-REQ-D7 | Request detail, Compliance tab | Single home for every risk/compliance signal: front-door determination (inherent risk, materiality, screening, disposition, sourcing type), intake compliance summary, reused risk assessments, risk flags, the full compliance report, **and the linked supplier's own risk/SRA/screening status** (moved here from Related — Related is linkage-only now). Most seeded requests predate the six front-door fields and show the empty state instead — `npm run backfill:compliance` (one-time data repair, not a `test:*`) fills them using the same decisioning functions the live wizard runs (`deriveComplianceBackfill`), for any row missing them, without touching anything else on the row |
| TC-REQ-D8 | Request detail, header | No longer shows a "latest document" chip — full duplicate of the Documents tab (same `documentsAdded` hook, same fields); Documents tab is the sole home |
| TC-REQ-D9 | Request detail, Workflow tab, a current stage with a triggered form (`npm run test:request-detail-ui`) | Only `active`-status form templates are offered — `forStage()` used to ignore status entirely, so a `draft` template (e.g. the seeded "Change Request Form") was still offered to requesters. Submitting a triggered form **actually persists** it (`useCreateFormSubmission` → a real database insert) — it used to discard everything typed and fake success with local-only state + a toast. After a real submit: the typed values are saved, the form shows as a completed submission on reload (not re-offered), and it stops appearing in the "still to fill out" list |
| TC-REQ-D10 | Request detail, Workflow tab, the attached template (`npm run test:request-detail-ui`) | The table has a **What the requester does** column: Intake reads "Describe what you need and submit it.", a stage where the requester does nothing shows a dash. Set per stage in the Workflow Designer ("What the requester does here"), which saves and loads it back (`test:edge-conditions`), and read live by the designer flow of `test:interactions-ui` |
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
| TC-SOW-01 | Consulting request → answer the objective with one line | **Section is expanded** into a full professional paragraph (NOT a verbatim echo) |
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
| TC-APR-02c | The channel's stages, from configuration (`npm run test:channel-plan`, `npm run test:ui`) | The Channel page holds **no hardcoded stages, owners, approvers or timeline**. Stages are the channel template's own, in graph order, tagged from the server's landing rule and the engine's `getNextNodeIds`; owners and target days are the stage nodes'; approvers are the derivation submit writes, on the chain submit chooses (`chainIdFor`, `test:approval-bands`). Retired with the Routing preview (`test:workflow-steps` with it): `composeWorkflowSteps`, which inserted synthetic Risk and Onboarding steps and guessed owners from a regex map, and the reviewer chips and approver notes that were never saved |
| TC-APR-03 | Reject (with reason) / Request Info | State changes; reason captured |
| TC-APR-04 | Delegate; Delegation page | Delegate set; OOO routing applies |
| TC-APR-05 | `/tasks` My Tasks + Team Tasks | Priority-sorted lists render |

## Suite WF — workflows, monitor, pipeline

| ID | Steps | Expected |
|---|---|---|
| TC-WF-00a | Approve a procurement-led request | It moves to **Sourcing**, then Contracting. WF-001's "Auto-Route" decision had two captioned exits the engine could not tell apart, so it always took Approval, and Approval led to Contracting — three live requests skipped sourcing (`test:edge-conditions`) |
| TC-WF-00b | Reject an approval, in any template | The request goes back to the requester (Referred Back). Workflow signals were evaluated by the routing evaluator, which does not know them, so "Rejected" never matched and the engine took the first exit — "Approved". WF-002, WF-003 and WF-004 also had no Rejected branch at all (`test:edge-conditions`) |
| TC-WF-00c | Submit a contract call-off | It runs WF-008: no sourcing and no vendor onboarding; Contracting only if the contract needs amending, risk only if the supplier's assessment cannot be reused. Call-offs ran WF-001 (governed checkout) or WF-006 (with onboarding) before (`test:edge-conditions`) |
| TC-WF-00d | Raise a PO for a request with no supplier or no date | The dialog says what is missing and does not create the PO. It used to invent supplier SUP-001 and "today + 30 days" (`test:ui-lifecycle`) |
| TC-PSL-01 | `/admin/categories` → Preferred suppliers on a category; save; reload | The list persists. Suppliers whose capabilities match the category's **supplier tags** are listed first. There was no list: "preferred" came from a performance heuristic nobody could see (`test:admin-editors`, `test:preferred-suppliers`) |
| TC-PSL-02 | Open a request whose supplier is not yet known | Overview and the intake side panel show **Supplier: Currently unknown**, and the category's preferred suppliers — "invited when sourcing starts" when the channel's workflow has a Sourcing stage, "not needed here" when it does not. The supplier was a dash (`test:request-detail-ui`) |
| TC-PSL-03 | Create a sourcing event from a request | Every preferred supplier for the request's category is invited, with the named supplier and the shortlist, each once (`test:preferred-suppliers`) |
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
| TC-WF-O7 | Stage order and the Channel page | `onboarding` sits after `risk` (it needs the supplier record) and before `sourcing` (it gates the invitation); a catalogue order has no onboarding stage. The Channel page shows it as it will run: *Applies · new supplier*, *If the supplier is new* while nobody is chosen, *Skipped · only after Risk Assessment* when risk is skipped (`test:channel-plan`) |

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
| TC-ADM-02c | Editor ↔ runtime ↔ test panel parity (`npm run test:routing-rule-integrity`) | Every field and operator the editor **offers** is evaluated in production, in both directions. The editor used to offer `contractId`, `riskLevel` and `region` and the operators `contains`, `is_empty`, `is_not_empty`, none of which the evaluator implemented — an unrecognised condition returned `false`, and because a rule requires `conditions.every(...)`, one killed the whole rule. `riskLevel` vs `riskRating` meant the obvious "route on risk" rule was dead on a name mismatch. The editor's lists are read out of the component, not copied into the test. `region` (never supplied) and `priority` (a second name for urgent, offering values that never occur) left the vocabulary on 2026-09-25; the supplier's own risk rating joined it, which is what RR-012 needed — it had compared the supplier's id with the risk scale. Categories in the editor are the configured ones |
| TC-ADM-02d | The test panel tests what runs | The panel calls the production evaluator. It used to implement its own — including `contractId` and `is_empty`, which production ignored — so it could **confirm a rule that never fired**. Set a priority and a commodity code in the panel; both are now inputs |
| TC-ADM-02e | A rule that cannot fire looks broken | `/admin/rules` shows a banner listing active rules with an unknown field, an unsupported operator, a malformed `between` (one bound), or no conditions. Each is clickable to the rule. **Live proof this was needed:** RR-001 "High-value IT software" was active, first in evaluation order, described as routing software over €100k to procurement-led, and carried `match_count: 42`. All three of its conditions evaluated false — it had never matched once. Repaired in `db/backfills/2026-08-28-rr001-repair.sql`, with `match_count` reset to 0 rather than carrying a history it never had |
| TC-ADM-03 | `/admin/forms` Form Builder | Add/configure/reorder fields; live preview; Save persists |
| TC-ADM-03b | Form status reflects reality | `triggerStages` is metadata shown on the form's card — it is **not** consumed anywhere in the wizard or request-detail, so setting it does not make a form actually appear at those stages yet. `FORM-008` "Change Request Form" is `draft` for exactly this reason (confirmed no consumer of `triggerStages` outside this admin page and its data hooks). Flip a form to `active` only once a stage genuinely renders it |
| TC-ADM-04 | `/admin/workflows` Designer | All 4 templates render node graphs; add node; Simulate; Save persists |
| TC-ADM-05 | Designer drives runtime (target) | Editing a template changes how a new request progresses |
| TC-ADM-06 | `/admin/approvals` Approval Chains | Edit chain; **Save persists across reload** (requires `approval_chains` table) |
| TC-ADM-01c | Categories carry the classifier (`npm run test:classification-eval`, `npm run test:reference-data-ui`) | Each category shows its classifier keywords; reorder with the arrows — the order is the classifier's precedence. Add a keyword to a category → a demand using it classifies there when AI-001 is off. "a pending approval" is not software and "quarterly spend review" is not catalogue (keywords match at the start of a word). The benchmark runs the real classifier on the seeded and on the live configuration (100% on 19 labelled demands). Buy-route and Review show **working days from the workflow's stage targets**, not a per-category figure |
| TC-ADM-06a | Roles (`npm run test:approval-chains-ui`, `test:approval-derivation`, `test:approver-resolution`, `test:admin-editors`) | The Roles table lists what acts as each role; remap one → it persists; a step role is a picker, not free text; a role a chain names but nobody configured is flagged; a role in use cannot be deleted. As a requester, open a request you raised with a pending approval: no Approve button, whatever the step. A Budget Owner step on a cost centre with no owner is actionable by a procurement manager, not by requesters. Every role a live chain, stage or pending approval names is configured |
| TC-ADM-07 | Chain change affects a new request | Generated approvers reflect the edited chain; OOO→delegate |
| TC-ADM-08 | `/admin/agents` AI Agents | 5 agents, each described as it really works; no accuracy, decision counts or performance charts (they were invented). Open one: the configuration form (the status agent adds its test panel and configuration); **toggle status + Save persists**; `test:ai-agents` flips each and watches the effect |
| TC-HOME-01 | Home intent step (`npm run test:requester-entry-ui`, `npm run test:knowledge-links`) | On Home: "do I need three quotes for a €40,000 order?" → answered in place (*A policy question*): "Yes. At €40,000 you need at least 3 competitive quotes — unless …", with the rule in full and where the figures came from; raise the competitive-sourcing threshold → the answer changes. "where is REQ-…" for your own request → stage, who has it, day X of the stage target, next stage; for someone else's → *No request … that you can see*. "what's waiting for me?" → your pending approvals. "I need a laptop" still goes to intake. Order: status → catalogue → policy question → demand → assistant |
| TC-HOME-02 | Home — two doors (`npm run test:requester-entry-ui`) | A requester sees **What do you need?** (Door 1, with Continue) beside **Know exactly what you want?** (Door 2 → the Catalogue page); other roles see Door 1 alone. Every outcome is one **Understood as** card — *Something to buy*, *A catalogue item*, *A policy question*, *A status question* — and a demand shows its card ("checks the catalogue and existing contracts first… Start the request") instead of opening intake at once; Start the request opens intake with the words. A catalogue item's card says the auto-approval threshold from configuration and adds to the basket. The Browse Catalogue quick action opens the Catalogue page, for buyers |
| TC-ADM-08a | Status Answers agent (`npm run test:status-agent`, `npm run test:reference-data-ui`) | Open **Status Answers**: every attribute of requests, approvals, POs, invoices, contracts and suppliers is listed (derived ones marked, a newly added one marked *New* and off). Relabel *Stage* → *Current step*, Save → ask "where is REQ-…?" in the test panel as Admin: the answer says *Current step* and leaves out on-ask attributes. Ask as Requestor about someone else's request: *No request … that you can see*. The guard fails if a field of the domain types or a live record has no entry, if the server or browser lookups bypass the agent, or if a hand-picked column list returns to `api/chat.ts` |
| TC-ADM-09 | Enable Supplier Recommender (AI-005) | Wizard Step 4 shows ranked suppliers |
| TC-ADM-10 | Enable/disable Category Classifier (AI-001) | The conversation's first phase switches LLM↔local behaviour. Serverless agent configuration is process-cached for up to 60 seconds, so verify the changed status after that window; `npm run test:ai-agents` polls it in both directions and restores the original status. |
| TC-ADM-11 | Categories admin | `procurement_categories` **seeded** from the canonical taxonomy (8 rows); add/edit category **persists** and appears in intake; **Icon picker** sets the tile icon shown at intake. **Commodity codes** column shows each category's default and keyword-code count and flags a category with none; its dialog edits the default and the code rows, refuses a code with no keywords, and saving the category itself keeps the codes (`test:reference-data-ui`; `test:admin-editors` proves `commodity_codes` survives a label edit). The table fits 1440px with no horizontal scroll: label, id and an Inactive chip share one Category cell, the description is on hover and in the edit dialog |
| TC-ADM-12 | Support SLAs admin | `/admin/sla-targets` edits the **ticket first-response hours** per priority — the `stage='ticket'` rows of `sla_targets`, read at ticket creation (`tickets-core.ts`). A priority with no row states what it gets ("Not set — tickets get 12 hours", from `slaHoursForPriority`) rather than showing an empty box. No stage SLA appears here: the workflow template owns them (`requests.sla_deadline` from the stage node's `slaDays`, `src/lib/workflow/stage-sla.ts` + `business-days.ts`), and the page links to `/admin/workflows`. Until 2026-09-25 the page was a read-only copy of those template figures while the ticket rows — the ones actually read — had no editor. `test:admin-editors` round-trips a priority's hours and asserts the table holds ticket rows only; `test:reference-data-ui` covers the page; `test:config-consumption` fails the build if a stage row reappears. |
| TC-ADM-12b | The SLA clock belongs to the current stage | `api/workflow-action.ts` recomputes `sla_deadline` from the node for the stage being **entered**, and writes it on every stage change **including as NULL**. It previously changed `status` alone, so a request moving out of a 1-day Intake into a 20-day Sourcing kept the intake deadline — red the next morning and in the Stuck and bottleneck views for the remaining nineteen days. `test:workflow-atomic` seeds a deadline dated 2020 and asserts it does not survive the move, that the new stage's own SLA (WF-001 Approval, 5 working days) was written, and that a transition to a stage with no SLA clears the column rather than inheriting one. `test:config-consumption` checks the same invariant across the live store. |
| TC-ADM-12c | Every request names its workflow template | A request with no `workflow_template_id` has no lifecycle definition — no stage list, no owner roles, no SLAs. 114 of 136 had none, and the intake writer fell back to the literal `'WF-001'`, which gave a catalogue order the procurement-led workflow. The writer now resolves the template that **claims the request's channel** (`templateForChannel`), the same rule the stage map uses, and `db/backfills/2026-09-17-c10-debris.mjs` backfilled the 114. A channel no template claims stays NULL and is reported by `unclaimedChannels`, never guessed. |
| TC-ADM-12d | The template follows the channel (`npm run test:channel-stages`) | Submit takes the template that claims the request's channel and ignores any the browser sends; intake no longer derives a template from the category (that rule gave WF-001 to nearly every category, so a business-led request would have run the procurement-led lifecycle). The Channel page draws the channel's template; a call-off's workflow instance is created by the checkout only — the browser used to add a second one on the category's template |
| TC-ADM-12d | No counter without a writer | `routing_rules.match_count` was seeded 187 / 62 / 35 / 42 and incremented by nothing — the evaluator is pure and takes no persistence handle — so RR-001 showed 42 matches for a rule whose three conditions were all false. The display went first; the column and the `RoutingRule.matchCount` field are now gone too. `test:config-consumption` fails if either returns. |
| TC-ADM-13 | `/admin/policies` | **Removed** (2026-09-25) — a static copy of the policy text used by nothing; policy text is in the Knowledge base |
| TC-ADM-14 | `/admin/users` (wired CRUD) | **Add User** (dialog) persists to the active Neon store and appears in the table; **Edit Role** updates the role; **Remove** deletes the record — all via the real mutation hooks (no more toast-only no-ops). Verified by `npm run test:interactions-ui` (create → persist → cleanup). |
| TC-ADM-15 | `/admin/health` System Health | Integration status, uptime, error log |
| TC-ADM-16 | `/admin/audit` Audit Log | 40+ entries; filters; **Export** |
| TC-ADM-17 | `/admin/kb` KB Management | Add entry persists; assistant uses it |
| TC-ADM-17a | Knowledge base linked to configuration (`npm run test:knowledge-links`, `npm run test:reference-data-ui`) | Every entry is marked **Linked to configuration** or **Policy text only**; expanding one shows it with live figures (change the catalogue auto-approval threshold → the catalogue entry's answer changes). *Insert a figure* adds a reference; a reference naming nothing is flagged and blocks Save. The guard fails if an entry restates a governed amount as a literal outside a line marked *(policy)*, if any reference names nothing, or if the live table is empty (the built-ins were moved in by `backfill:knowledge-base-linked`, fill-only). The rewrite corrected entries that described the platform wrongly: approval bands (now the chains), catalogue auto-approval (€500 → the governed figure), a direct-PO channel, category selection, a separate onboarding request |
| TC-ADM-18 | `/admin/ai-analytics` | Conversation/answer-quality charts |
| TC-ADM-19 | `/admin/database` | Entity tabs; edit a row persists; reflects on feature pages |
| TC-ADM-20 | `/admin/database` → **Sourcing Events** | The tab lists live events (id, title, type, status, category, budget, deadline, request, awarded supplier). Editing status/dates persists and shows on `/sourcing/:id`. Requirements and evaluation criteria render **read-only** with the criteria weight total — the wizard owns them, because it is the only place weights are validated. **Related Items** resolves the originating request and the awarded supplier both ways |
| TC-ADM-20b | `/admin/database` → **Catalogue Items** | The catalogue is maintained here: list, create, edit (name, description, price, unit, catalogue, supplier, lead time, contract and risk-assessment links, commodity code) and mark an item not orderable, all persisted to `catalogue_items` and shown on the catalogue page and in intake matching. The save and delete hooks existed with no screen using them. A live entity, so `test:config-consumption` requires its create/update/remove branches; `test:admin-editors` round-trips the table; `test:reference-data-ui` opens the tab |
| TC-ADM-22 | `/admin/service-description` renders (`npm run test:service-description-ui`) | Admin-only route. Four areas render: **Generation prompt**, **Components asked at intake**, **What is generated**, **Reuse in later steps**. The editor never blocks on the read — when the stored row is unreadable it shows the built-in (what generation actually falls back to) with a visible notice, not a spinner |
| TC-ADM-23 | Prompt is configurable and previewable | Edit guidance / system prompt / temperature / token budget for a category; **Preview the assembled prompt** shows the prompt with `{{guidance}}` and `{{outputFormat}}` resolved — i.e. what the model will actually receive. Save persists to `service_description_templates` **Built-in guidance is visible (2026-09-24):** it lived in `api/generate-sow.ts` while the help said an empty field "uses the built-in guidance" and showed nothing. It is `BUILT_IN_CATEGORY_GUIDANCE` in `service-description-defaults.ts`, shown as the empty field's text with **Edit the built-in text** to take it as a starting point; the preview renders it exactly as the server sends it, and a category added in Admin gets the general text (`test:service-description-config`, `test:service-description-ui`). |
| TC-ADM-23b | Residual risk questions are configured (`npm run test:service-description-config`, `npm run test:residual-questions`, `npm run test:service-description-ui`) | **When** the privileged-access question is asked is a Decisioning threshold — `privilegedAccessCategories`, a checklist under Risk questions at `/admin/thresholds` (was a set in `residual-questions.ts`; default unchanged). **How** both questions are put is the category's service-description template (`riskQuestionWording`, a Risk questions card in `/admin/service-description`; blank = the built-in text shown in the field). The wording is applied once, in the determination, so the chat, the form card and the compliance record read the same text; wording never changes which questions are asked. The determination also passes its policy to the question builder rather than the module singleton |
| TC-ADM-24 | Per-category with a `default` fallback | A category with **no row of its own** resolves to the `default` row; with neither, to the built-in template. The built-in is **stored** as the `default` row (`backfill:service-description-and-forms`; `test:config-consumption` fails if none is stored). Categories that are inheriting rather than configured are marked as such, and the editor shows the **stored default** they inherit, not the code built-in (`test:service-description-ui`). Deleting a category's row returns it to inheriting — nothing breaks |
| TC-ADM-25 | Config reaches the serverless routes | Save a template, then run intake for that category: `/api/generate-sow` uses the **stored** prompt and model params, not the hardcoded ones. This is why the config is a table and not a settings store — `PolicyConfig` is localStorage-only and can never reach a serverless route |
| TC-ADM-26 | Components asked are config-driven (`npm run test:service-description-config`) | The serialised slot set produces **the same questions in the same order** as the built-in `ALL_SLOTS` across every category × value combination — the equivalence that makes the migration safe. Conditions use the `{field, operator, value}` vocabulary shared with routing rules and form triggers; thresholds referenced as `policy:<key>` still move with `/admin/thresholds` |
| TC-ADM-27 | What is generated is config-driven | The **compact narrative** composes from `narrative_sections`, in order, in one place (the API, the mock and the offline fallback no longer drift). Sections the requester is never asked for are labelled **inferred**, so generated content is not presented as captured |
| TC-ADM-28 | Reuse in Sourcing | Raise a sourcing event from a request with a service description: `requirements` are **seeded from the configured sections** (labelled, empty sections skipped) and `criteria` from the template's defaults instead of arriving empty. The evaluator can still edit everything; weights must still total 100, and the admin screen shows the running total where they are edited |
| TC-ADM-30 | A conditional question's rationale is editable | In **Components asked at intake**, a slot with conditions offers an "Asked because…" field, shown to the requester beneath that question at step 3. Unconditional slots do not offer it — everyone is asked those, so a rationale would be noise. Blanking the field removes the line |
| TC-ADM-28b | A condition that cannot hold is reported | `/admin/service-description` shows a red banner naming each slot or section condition the evaluator cannot act on — an operator it does not implement, a field nothing supplies, or a `policy:` token for a threshold that does not exist. Both failure modes are otherwise invisible: `evaluateSlotCondition` returns **false** for an unknown operator (it returned `true`, so a typo in JSONB made the slot always asked and the section always mandatory), and an unknown field compares against `undefined`. The routing screens spell operators `greater_than`/`equals` and this one `>`/`==`, with only `in` shared, so the mistake is one an admin moving between the two will make. `test:service-description-config` and `test:service-description-ui` both cover it |
| TC-ADM-28c | The governance read reaches slots, not only sections | A slot condition on `materiality`, `riskTier`, `dataSensitivity` or `sourcingType` is evaluated. Four of the six fields `SlotConditionField` declares reached sections only — `fromConfiguredSlot` supplied `{category, value}` — so those conditions silently never matched, and the half that worked is why it looked correct. `applicableSlots` computes the capture-time read once per agenda build and passes it in |
| TC-ADM-28d | A template can add a requirement | `ConfiguredSlot.requiredWhen` makes an **answer** mandatory where `conditions` decide whether the question is **asked**. It was declared, edited, persisted and read by nothing. `outstandingRequiredSlots` honours it alongside the code-owned `REQUIRED_SLOT_IDS` floor, which a template may add to and cannot lower — and which now also sees a `required: true` risk question, where before only the step gate's second condition caught it |
| TC-ADM-28e | An admin can empty a list | Clearing `narrativeSections`, `sourcingRequirementSections` or `defaultCriteria` persists. Every list treated `[]` as "not configured" and fell back, so the edit saved, toasted success and came back as the built-in on the next read. `slots` and `sections` still fall back when empty — one asks nothing, the other generates nothing — and both readers (browser and `api/_sd-template.ts`) apply the same rule |
| TC-ADM-28f | Generation reads the admin's thresholds | A `policy:<key>` token on a condition resolves against the **stored** `procurement_policy_configs` row, not `DEFAULT_POLICY_CONFIG`. `api/generate-sow.ts` and `api/chat-intake.ts` both used the shipped defaults, so raising a threshold at `/admin/thresholds` moved the browser and not generation — and the two value-conditional intake slots branched differently depending on whether the model was up. One loader, `api/_policy.ts`; `test:checkout-gates` fails the build if either route reaches for the defaults again |
| TC-ADM-30 | The assistant answers from the admin's KB | Add an entry at `/admin/kb`, ask the assistant about it: the stored entry is quoted. The browser assistant ranked over the hardcoded `src/data/knowledge-base.ts` fixture and nothing read the table — while `mockProvider` is the provider unless `VITE_ASSISTANT_PROVIDER=groq` **and** the fallback on every groq failure, so an admin's edit was invisible in the normal configuration and every degraded one. Stored entries **replace** the built-ins rather than merging, so a deleted entry stops answering; an empty or unreachable table falls back with a warning. `test:knowledge` covers all four cases |
| TC-ADM-31 | No fabricated login history | `/admin/users` has no "Last Login" column. It was sortable and filled from a hardcoded map of twelve ids, defaulting to `'2026-04-01 10:00'` for everyone else — `users` has no such column and cannot have one, because there is no authentication to record a login. An admin sorting by it was ordering fiction |
| TC-ADM-32 | Audit Export produces a file | `/admin/audit` → Export downloads `audit-log-YYYY-MM-DD.csv` containing the **filtered** rows (not the visible page, not the whole table), disabled when the filters match nothing. The button previously had no `onClick` at all, on the screen whose purpose is producing evidence. One shared `src/lib/csv.ts` replaces the two divergent copies in the analytics pages, and writes a UTF-8 BOM so Excel does not mangle every `€` and umlaut. `test:csv-export`. The log shows **recorded entries only** — 40 invented rows (logins from named offices, an AI "duplicate detected", made-up IP addresses) and the always-empty IP column were removed (2026-09-25; `test:config-consumption`) |
| TC-ADM-33 | Analytics say when they cannot measure | `/admin/ai-analytics` reads through TanStack Query hooks and shows loading, loaded and **failed** states. It used a one-shot `void (async () => …)()` with no catch: a failed read was an uncaught page error — the crash `test:e2e-ui` reported on this route — and `setLoading(false)` sat after the awaits, so the screen stayed on "Loading analytics…" indefinitely. Zero conversations and an unreadable table look identical on a chart, so the failure is now stated rather than charted as zeroes |
| TC-ADM-38 | Every template runs a buying channel | `/admin/workflows` lists the four templates that define a reachable channel's lifecycle (WF-001 procurement-led, WF-002 catalogue, WF-006 business-led, WF-008 call-off). The side processes WF-003 (Supplier Onboarding) and WF-004 (Contract Renewal) and their `/admin/workflows/side-processes` screen were **retired** (2026-09-25): nothing ever started either. `test:channel-stages` asserts every template claims a channel and the side-process route is gone. |
| TC-ADM-37 | Every editor that claims to save, saves | `test:admin-editors` covers **10 surfaces**, not the 4 it began with: routing rules, AI agents, workflow templates, forms, approval chains, categories, cost centres, delivery locations, knowledge base and service descriptions — plus the policy-config singleton and the category-manager set, which are not row editors. Two halves per surface, and both are needed: a **live round trip** (write, read back, JSONB columns still arrays — a save that flattens `nodes` to a string round-trips the name while destroying the template) and a **static check** that the Save handler calls the mutation. Either alone passes the defect this exists for: `/admin/database`'s Workflows tab showed a green "Live (persisted)" badge, wrote an audit row claiming `record.update`, and had no persistence branch. `knowledge_base` and `service_description_templates` ran **empty** for months on built-in sets (both hold stored rows now), so on an empty table the suite inserts a row, round-trips it and removes it, because an empty table is exactly where a broken editor hides. Support SLAs (ticket hours per priority, keyed `(stage, channel)`) and functional roles have their own round trips. System health is the one deliberately read-only page, asserted to stay that way (Policy Management was removed). |
| TC-ADM-35 | Integration health is measured, not asserted | `/admin/health` derives every figure from `system_integrations`: per system, how many handovers completed, are open and failed; the last handover; the mean submitted→responded time. A system with one failure among successes reads **failing**, never averaged into a green card. A system with no handovers reads **unused** — a different statement from healthy — and still gets a card, because one that vanishes when a system goes quiet makes an outage look like a clean dashboard. The error log is the handovers that did not land, with the detail each record carries. **What it replaced:** four literal "Connected" cards, 99.97% uptime, a 0.02% error rate, 47 active sessions and five invented error rows — while the live store had SAP Ariba in `timeout` and Coupa Risk in `error`. There is no uptime or session count to report, because R1 has no live upstream connections, and the page says so. `test:integration-health` (with a live assertion that the store is not uniformly healthy) and `test:reference-data-ui` |
| TC-ADM-39 | Every threshold says where it is used | Under each number on `/admin/thresholds`: **Used in** — where the platform's code reads it, in the words of the screens it shows on (`POLICY_KEY_META[key].usedIn`) — and the configuration that names it as `policy:<key>`, read live: routing rules (off ones marked), approval-chain bands (which end), workflow branches, form triggers, service-description conditions, and a count of knowledge-base articles quoting it. `test:policy-tokens` holds `usedIn` true both ways by scanning the code with comments stripped (a key with a line is read somewhere; a key without one — `delegatedAuthorityThreshold`, used only by the chain bands — is read nowhere), and unit-tests the reference finder (`between` values, prefix-safe matching, chain ends). `test:reference-data-ui`: a rule and an article are listed under their threshold; a threshold nothing names is flagged; with the chains failing to load, the page says it could not check instead of calling anything unused. Also: a catalogue order of **exactly** the auto-approval threshold is approved automatically — the checkout held it (`>=`) while the workflow branch, Home answer and knowledge base all said "up to" (`test:governed-checkout`). |
| TC-ADM-36 | The budget owner is a real person | `/admin/cost-centres` picks the budget owner from the user directory rather than accepting free text, and external supplier users are not offered. `approval-derivation.ts` resolves `cost_centres.owner` against the directory **by name**, so a typo — or someone who has left — named nobody and the Budget Owner step fell through to the role, silently. A cost centre with no owner is flagged in the table ("No budget owner"), the same way `/admin/categories` flags a category with no manager, because that state means the approval step is assigned to a role rather than a person. **All 44 seeded centres are unowned; assigning them is a governance decision, not a backfill.** |
| TC-ADM-34 | Configuration can be removed | Approval chains, forms, AI agents and routing rules each have a delete control. All four had a `useDeleteX` hook exported and called by nothing, so a record added by mistake stayed forever and the only way out was the database. Each goes through `ConfirmDeleteDialog`, which names the record and states the consequence — required as a prop, because every one of these tables is referenced by something and only `approval_chains` has a foreign key to refuse a bad delete. A refusal from Postgres is reported as "still referenced by other records", not "Failed to delete": the constraint working must not look like a broken button. `test:admin-delete-controls` |
| TC-ADM-34b | Cost centres and delivery locations stay undeletable | Deliberate, and unchanged. Requests store the cost-centre code and the delivery location as **text with no foreign key**, so deleting the row does not fail — it silently orphans every record that names it, including closed ones. Retiring (`active: false`) already exists, is shown in the table as "Retired"/"Closed", and keeps the history. `test:reference-data-ui` guards the absence; that guard used to match on a button's accessible name, so an icon-only trash button passed it, and it now checks the rendered markup |
| TC-ADM-29 | Reuse in Risk / forms | The Form Builder's pre-populate list offers `sow.*` sources (objective, scope, deliverables, resources, narrative, …). A form triggered on the risk stage pre-fills from the service description rather than re-asking |
| TC-ADM-21 | Deleting a sourcing event really deletes | Removing an event from the admin browser deletes the Postgres row **and cascades to its invitations and submitted bids** — reload and confirm it is gone from `/sourcing`, not just from the current session |

## Suite AI — assistant chatbot (5 capabilities + guardrails)

| ID | Steps | Expected |
|---|---|---|
| TC-AI-01 | Ask "What is the approval threshold for consulting engagements?" | **Clean grounded answer with a source chip**; **no `tool_calls.NAME(...)` / `## Step` / `$\boxed{}$` / raw tool text**; not stalled (see CHATBOT_TOOLCALL_FIX.md) |
| TC-AI-02 | Lookup "status of REQ-2025-0114" | Short answer + **deep-link callout** to the request |
| TC-AI-03 | Action: "set my out-of-office" | **Confirm read-back** then execute; **audit entry**; no execute without confirm |
| TC-AI-04 | Ask for something with no grounded answer | Offers **handover/ticket** (no hallucinated facts) |
| TC-AI-04b | Grounded retrieval (`npm run test:knowledge` + interaction E2E) | Ranks the KB (tags > title > body); a strong match **quotes the best entry + its source** and cites related policies; a **weak match returns the closest topics, not an asserted (possibly wrong) policy**. E2E asserts the threshold answer is grounded — the bands rendered from the live approval chains ("Below €10,000" / "€10,000 – €100,000"). |
| TC-AI-05 | Demand intake: "I need to buy 50 laptops" | Deep-links into New Request prefilled |
| TC-AI-05b | Demand routing (`npm run test:assistant-intents`) | A procurement demand — incl. people/consultants ("I need consultants for a promptathon", "hire a developer", "looking for an agency") — routes to **start_demand → New Request**, **never a support ticket**. `create_ticket` fires only on explicit human-help ("speak to someone"). Holds on both the LLM path (rule precedence in `api/chat.ts`) and the offline classifier (`intents.ts`). |
| TC-AI-05c | One route for Home and the assistant (`npm run test:question-route`, `npm run test:requester-entry-ui`) | The chat routes every message through `question-route.ts` before the model: a status question shows the **status card**, a policy question the **policy card** computed from the thresholds, a catalogue item links to its checkout, a demand offers New Request with its words (the server's `start_demand` builds the same `?q=` link, no category argument). Order status → catalogue → policy → demand → model; "I need help", "track my order" and "speak to someone" are not demands; a follow-up is a demand only with a buying verb. The mock router's supplier names and its duplicated rules are gone. The Home box no longer calls `/api/ai` for a catalogue match (with the classifier in draft it showed requesters an admin message), and the `?step=2&category=…` intake link, its last producer gone, is no longer parsed |
| TC-AI-05d | Conversations are named by their first question (`npm run test:question-route`, `npm run test:requester-entry-ui`) | The first message titles the thread (first line, ≤60 characters, cut at a word). It read "New conversation" for every thread; `backfill:conversation-titles` named the 78 stored ones, leaving empty threads as they are |
| TC-AI-06 | Role filtering | As Requestor, restricted actions not offered; as Ops Lead, different set |
| TC-AI-07 | Full-page assistant (`/help/assistant`) | Same behaviour as overlay; the user-scoped conversation history is backed by `assistant_conversations` in the active database |
| TC-AI-08 | Guardrail: no master-data write-back | Vendor bank-detail change routes to ticket, not direct write |
| TC-AI-09 | Regression: a knowledge/lookup query that triggers a tool | Server **executes** the tool (or client suppresses it); user sees a clean grounded answer, **never raw `tool_calls.…` text**; no stall (CHATBOT_TOOLCALL_FIX.md) |
| TC-AI-10 | Provider parity: same query in `VITE_ASSISTANT_PROVIDER=mock` and `groq` | Equivalent grounded answers + source in both modes |
| TC-AI-11 | Robustness: slow/empty/erroring 2nd model call (or tiny timeout) | User gets a graceful timeout/fallback message, **never an infinite spinner**; `/api/chat` always terminates (CHATBOT_HANG_FIX.md) |
| TC-AI-12 | Classifier server configuration (`npm run test:ai-api-config`) | Missing active database/AI server configuration produces `503 { code: "service_unavailable" }`; the Vercel function must not fail at module load or expose configuration details. The suite removes `NEON_DATABASE_URL`/`DATABASE_URL` — the variables the handler actually gates on — so it asserts the 503 rather than passing on a machine that happens to have no connection configured. |
| TC-AI-13 | `api/chat-intake` import-graph hygiene (`npm run test:api-imports`) | Same principle as TC-AI-12, different mechanism: `api/chat-intake.ts` shipped in production returning a bare `500 FUNCTION_INVOCATION_FAILED` on **every** call — the intake wizard's chat silently ran on its offline fallback the whole time, with no log and no user-visible signal. Root cause was two relative imports inside `demand-conversation.ts` missing their `.js` extension: neither `tsc -b` (bundler-mode resolution) nor `vercel dev` (a lenient dev-server loader) catches this, only Vercel's real per-function build does — confirmed by running `npx vercel build` and inspecting the emitted `.vercel/output/functions/api/chat-intake.func` bundle directly. The test statically walks the import graph of every `api/*.ts` entrypoint and fails on any relative specifier lacking a file extension, so this can't silently reappear. Any change to `api/*.ts` or a module it imports should run this, not just `tsc -b`. |

## Suite PLT — platform, notifications, settings, help, NFR

| ID | Steps | Expected |
|---|---|---|
| TC-PLT-01 | `/notifications` | 7 types; mark read; **preferences persist across reload** |
| TC-PLT-02 | `/settings` | Currency/locale setting **applied app-wide** (amounts reformat) |
| TC-PLT-03 | `/help/kb` Knowledge Base | Reads the **same entries** the assistant and the Home box answer from (stored, else the built-in set), grouped by **topic** in the entries' order, untopiced last under "More"; figures render from the live configuration; search matches every word over the text as read; no feedback buttons; a failed load says so. The breadcrumb takes the menu's label (it read "Kb"). `test:knowledge-links` (no hardcoded articles, every entry topiced, grouping, search) and `test:reference-data-ui` |
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
| TC-CAT-01 | Category-code mapping (`npm run test:category-code`) | Runs the real module over the seed taxonomy (it used to test a hand-kept copy). Keyword match resolves a code (confidence scales with hits); no keyword + known category → category default; keyword wins over default; unknown/none/empty book → null; every seeded category has a default code. Keywords match at a **word start** — "maintenance", "chair" and "campaign" are no longer coded as data analytics, "erp" is not counted inside "enterprise", "temp" still finds "temporary", a capitalised admin keyword still matches. A tie goes to the demand's own category, and the first candidate agrees with the headline code. Inactive categories and keywordless codes contribute nothing; a store row is read defensively. No code table remains in `category-code.ts`; the commodity-match endpoint and all three intake screens read the configured book. Live: every active category has a default and a laptop demand codes as laptops |
| TC-CFG-01 | Central policy config (`npm run test:policy-config`) | `DEFAULT_POLICY_CONFIG` pins every decisioning threshold (approval/materiality/risk-band/competitive-sourcing/contract); all decisioning modules source their constants from it (values unchanged — dependent suites stay green); `resolvePolicyConfig` merges a partial override without mutating defaults; an override changes the decision (200k → light at default, → full at a 150k threshold). |
| TC-CFG-02 | Decisioning Thresholds admin page (`/admin/thresholds`, route sweep `npm run test:e2e-ui`) | Admin edits a threshold; the **live simulation** recomputes a sample demand's materiality / inherent risk / approval gate under the edited values; **Save** validates and persists to the Neon policy singleton before showing success (drives the live front door, survives reload); Reset restores defaults. A failed save leaves the prior active config. Page renders clean in the route sweep. The settings cards stack on the left with the simulation beside them, and **Save / Reset sit in that sticky column** with an "Unsaved changes" cue — in the first card's header they were out of sight while lists further down were edited. **Category-list thresholds are checklists** of the configured categories (competitive-sourcing exemptions, P-card eligible, never on a P-card): typed ids saved cleanly and matched nothing on a typo; an id naming no category is shown and flagged so it can be removed (`test:reference-data-ui`). |
| TC-CFG-02b | Direct call-off limit (`npm run test:governed-checkout`, `npm run test:intake-routing`, `npm run test:ui`) | `directCallOffLimit` (default €250,000, a Decisioning threshold). Above it a contract call-off is not a direct award — it needs a mini-competition — so it is enforced in three places that agree: **checkout refuses** a `contract-call-off` over the limit (a catalogue order is not held to it); **How you'll buy rules the contract route out in place**, naming the contract and the limit, when the estimated value is already over it; and the **call-off form** says so beside the value and holds Review. Each reads the configured limit, not a literal. `test:intake-routing` now runs the real route decision and channel resolver — it carried copies of both, one still holding the fallback ladder C3 deleted |
| TC-CFG-02c | Preferred-supplier override (`npm run test:preferred-suppliers`, `npm run test:submission-requirements`, `npm run test:ui`) | A supplier chosen outside a category's **non-empty** preferred list is an override (no list, or "none in mind", is not). Details asks "why this supplier?" beside the supplier and holds Next until answered; the footer names it. Submit **recomputes** the override from `category_preferred_suppliers`, refuses without a reason and stores it (`requests.supplier_override_reason`) only when there was one. With `preferredSupplierOverrideNeedsApproval` on (default; a switch under Supplier choice at `/admin/thresholds`) a Category Manager step is added to the approvals unless the chain already asks them — in submit, the engine and the Channel page alike. The reason shows under the supplier on the request's Overview. The policy check says what the override costs instead of "allowed, but flag for review" |
| TC-DB-VIEW | Derived views carry every column (`npm run test:schema-drift`) | A view over `x.*` fixes its columns when created, and the applier rebuilt the views mid-file, before later `ADD COLUMN`s — so a new column reached `requests_with_derived` (what the app reads requests through) only on the next apply, never on a fresh database. The applier now rebuilds every view after all statements; the suite asserts no table column is missing from its `*_with_derived` view |
| TC-CFG-03 | Governed threshold tokens (`npm run test:policy-tokens`) | Every numeric `PolicyConfig` key has admin metadata, is accepted by the server validator, and reaches the page; so does every **category-list** key (`CATEGORY_LIST_POLICY_META`), rendered as a checklist and covered by save. The server derives its key list from the defaults by type, and **GET merges a stored row key by key** (`configFromRow`) — all-or-nothing meant adding a key reverted every saved threshold in the browser (`test:policy-config-server` proves it on a row missing the newest key). The competitive-sourcing exemptions were a default argument in `supplier-preference.ts`; they are `competitiveSourcingExemptCategories` (default `contingent-labour`, unchanged) and the determination passes its own policy rather than the module singleton (`test:preferred-suppliers`) — which now *derives* its field list rather than restating it. `delegatedAuthorityThreshold` was live in the compliance report, server-validated, and absent from the hand-maintained list: uneditable, and erased whenever an admin saved any other field. Also asserts `policy:<key>` resolution (literal passthrough; an unknown key reported rather than silently swallowed; per-bound resolution for `between`), that non-currency keys are never offered for a value condition, and that no decisioning check compares against a literal a governed key already owns — `intake-determination.ts` hard-coded 25,000 and 100,000 while identical numbers sat in the config. |
| TC-CFG-04 | Routing reads governed thresholds (`npm run test:policy-token-routing`) | Three seeded rules moved from literal amounts to `policy:<key>` tokens; 1,120 labelled demands (7 categories × 20 value boundaries × 4 commodity codes × urgency) route **identically** before and after, and raising `budgetApprovalThreshold` to €200k demonstrably takes €120k software out of RR-001. Also: a token reaching `evalCondition` returns false **and logs** rather than looking like an ordinary near-miss; no `api/` handler imports the routing evaluator (the active config is a browser-boot singleton, so a serverless caller would silently evaluate against shipped defaults); the nine role-path chain options are gone and the select is driven by `approval_chains`; every live rule names a configured chain or defers to the value band; and the compliance chain carries no numeric band, so it is reachable by a rule naming it and never by value.. Since 2026-09-25 the threshold-driven rule is RR-902 (RR-001/006/007 were removed as unable to change an outcome) |
| TC-CFG-05 | Routing rules editor (`npm run test:routing-rules-ui`, stub-backed) | `/admin/rules` had no browser coverage while deciding the single most consequential thing the front door decides. Asserts a governed condition never shows the raw `policy:` token to the admin, names the threshold and shows its resolved amount; that the plain-English summary names the threshold rather than a bare number; that "Let the value band decide" is the default and none of the nine removed role-path strings is offered; and that a rule naming a chain shows it by name and says it overrides the band. |
| TC-CFG-06 | Routing fallback is data (`npm run test:routing-fallback`) | `fallbackBuyingChannel` — a five-branch if-ladder restating €25k, €100k and €50k where no admin could see them — is replaced by seeded catch-all rules RR-900…RR-905 at priority 900+. Asserts they reproduce the deleted ladder across 7 categories × 16 value boundaries (the ladder itself is kept in the test as the oracle), that the inclusive `between 0,businessLedCeiling` lands €50,000 on business-led where `less_than` would not, that raising a threshold moves the fallback, that rules are read priority-first (the select had no ORDER BY, so a catch-all could be evaluated before the rule it backs up), that deleting the always-true catch-all is reported to the admin, and that an empty rule set still yields a channel **and logs**. **Door 1 routing (2026-09-25):** routing now decides only business-led vs procurement-led. The rules that sent Door 1 demands to the catalogue (RR-002, RR-007, RR-900 — anything under €25,000, with no item behind it), to a call-off (RR-004, RR-903 — contingent labour with no contract), to Direct PO (RR-009) and the renewal / onboarding categories (RR-005, RR-008), and the duplicate consulting catch-all (RR-901) are removed; RR-013 sends contingent labour to procurement-led. The suite's oracle is the Door 1 policy across 96 demands, and it asserts no rule routes to a channel that needs a real item or contract (`backfill:door1-routing` applied live) |
| TC-CFG-07 | Approval-chain value bands (`npm run test:approval-bands`) | `approval_chains.threshold` was free-text English parsed by regex, and a string with no number in it parsed as `[0, ∞)` — so an unbanded chain matched **every** value and, found first, shadowed every banded chain behind it. Reachable two ways: the column defaults to `''` and the admin page created chains at `'TBD'`. Bands are structured `min_value`/`max_value` bounds now, each a literal or a `policy:` token. Asserts absence is never an open band (three spellings), that a freshly created chain listed first does not capture a €250k request, that bounds follow their governed threshold when it moves, that adjacent half-open bands claim each boundary exactly once, that gaps and overlaps are reported by name while an unbanded chain is **not** (that is how it says "reachable only by a routing rule"), that no test still mirrors the deleted parser, and that every live stored label matches the band it describes. |
| TC-CFG-08 | Approval chains editor (`npm run test:approval-chains-ui`, stub-backed) | `/admin/approvals` had no browser coverage while owning who approves. Asserts the structured band editor replaces the free-text threshold input, that a governed bound is offered by name and the editor says which thresholds the band follows, that no raw `policy:` token reaches the admin, that an unbanded chain reads "By routing rule only" rather than as an open band, that the hardcoded "EUR" prefix is gone now the label carries its own currency, and — against a deliberately gapped ladder — that the page names the values nobody would approve and explains why that matters. |
| TC-CFG-09 | Form gates agree (`npm run test:form-gates`) | Two places decide whether a stage is asking for a form — the request detail renders it, the advance action refuses to move while a `blocking` one is outstanding — and they disagreed: the renderer evaluated `triggerConditions`, the blocking gate never did. A template that was conditional **and** blocking therefore stranded every request in its stage, including those its own conditions exclude: never rendered, so never submittable, so never advanced. Both gates are views over one predicate now (`src/lib/forms/form-triggers.ts`). Asserts the strand directly, then holds the invariant across 180 combinations (category × value × submitted set × stage) that the blocking set is a **subset** of what renders; that conditions are ANDed with an unrecognised one suppressing rather than passing the form; that a form condition can reference a governed threshold and moves with it; and that neither gate has grown its own filter back. |
| TC-CFG-10 | Form Builder offers what runs (`npm run test:form-builder`) | Three ways this surface promised more than it delivered. It listed **nine** stages, omitting `risk` and `onboarding`, while three *active* templates trigger on exactly those — invisible in the builder, so un-removable, and toggling any other stage wrote the array back with the unseen entry intact. The condition **field** was a free-text input with no vocabulary, so a typo fell to `undefined` and the whole form silently never rendered (the failure `diagnoseRule` was added for on the rules page). And `blocking`, which gates a stage, could only be set by a direct database write. Asserts the stage list is derived and labelled, every stage a seeded template uses is offerable, the shared `ConditionCard` replaced the free-text field and the restated five-operator list, `blocking` is settable, and `diagnoseFormTemplate` reports each of: unknown field, unsupported operator, unknown stage, no stage, unknown governed threshold, one-bound `between`, and a field the form context never supplies — with a broken **blocking** form called out as stranding its stage. Runs against the seeded and live template sets. |
| TC-CFG-11 | Form Builder screen (`npm run test:form-builder-ui`, stub-backed) | Asserts the two stages the old hard-coded list omitted (Risk Assessment, Vendor Onboarding) are offered and show as selected for a form that uses them; that the stage-blocking toggle renders and states the admin exemption; and — against a template whose condition names a misspelled field — that the page says the form cannot be asked for, names the unknown field, and calls out that a broken **blocking** form strands its stage. Also that conditions render through the shared `ConditionCard` rather than the old free-text field. |
| TC-CFG-12 | Templates own the lifecycle (`npm run test:channel-stages`) | The flip: `buying-channel-stages.ts` is **deleted** and every consumer derives the channel path from the workflow templates. Replaces the parity test, which existed to prove equivalence before the code map went. Asserts the file is gone and no component restates a stage list or keeps its own stage-label map (there were four, with three different answers for `po` and two missing `risk`/`onboarding`); every channel claimed by exactly one template; each path starts at intake, repeats nothing and names every stage; walking `nextStageAfter` reproduces each path and terminates, skipping is its exact complement, and `firstActionableStage` always lands on a traversed stage that is not intake; an **unknown** channel degrades to the full union rather than the old nine-stage `FULL_LIFECYCLE` that silently dropped risk and onboarding; the live templates derive what the seed derives; and no open request sits in a stage its channel skips. **Requester wording (2026-09-24):** every channel's claiming template carries a headline and description and `channelCopy` returns them; a template with none falls back to the channel label, never another channel's sentence; the mapper round-trips both; `BUYING_CHANNEL_PLAIN` stays deleted; both intake screens read `useChannelCopy`; the designer saves the wording and a template switch discards unsaved channel and wording edits (it used to carry them onto the next template); live, every channel template has a headline. **Business-led has a contract (2026-09-25):** WF-006 runs Approval → Contracting (Legal, 10 days) → PO; it went straight to PO, so a business-led services buy had no contract behind it. |
| TC-CFG-13 | Decision branches decide (`npm run test:edge-conditions`) | A branch was a free-text label the engine tried to parse; it understood a handful of shapes and `getNextNodeIds` then silently took the first outgoing edge. WF-002's decision read `> €5K` / `< €5K` — exactly what an admin would write — and evaluated to nothing, so **every catalogue order took Manager Approval regardless of value**. Branches carry a typed `{field, operator, value}` condition now, in the routing vocabulary plus the workflow signals (`outcome`, `riskRequired`, `onboardingRequired`), resolved against the same governed thresholds. Asserts €500 and €50,000 take different branches and that raising `catalogueAutoApprovalThreshold` moves the boundary; that conditions are tried before the unconditional default and legacy signal labels still resolve; that `diagnoseTemplate` reports a caption that reads like a rule, a condition on a field nothing supplies, an unknown governed threshold, a decision with no default and an unreachable branch; that every palette type maps back through `reverseType` to a type the engine handles (it mapped four of ten, so an Approval or Timer node saved as a plain stage); that no control collects a field the save path drops; and that edge conditions round-trip. The test drives the engine's own `getNextNodeIds` — an earlier version mirrored the rule and a deliberately broken engine passed. |
| TC-CFG-13b | The channel's stages, before submit (`npm run test:channel-plan`) | The Channel page says which of the channel template's stages will run. Asserts it lands where the server lands the request (`firstActionableStage`, `checkoutEntryStage`) and walks from there with the engine's `getNextNodeIds`: stages in graph order (WF-001 onboarding after risk and before approval — the array and breadth-first orders both got it wrong); no risk → *Skipped · no risk assessment needed* (or *existing assessment reused*), onboarding *Skipped · only after Risk Assessment*; risk required with no supplier chosen → onboarding *If the supplier is new* and "10+ of 11"; business-led with no risk enters at Approval although its graph goes Intake → Risk unconditionally; the four real call-off decisions (auto-approved, over the threshold, expired assessment, beyond the contract) land at PO / Approval / Risk / Contracting with each jumped stage explained; raising `catalogueAutoApprovalThreshold` moves *Applies · over €…*; each entry rule's declared conditions fail for every stage it jumps and hold for its entry; no stage is ever skipped without a reason. Verified by walking from the start, listing in authoring order and inverting a declared condition — each fails. |
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
| TC-DET-05 | Residual questions (`npm run test:residual-questions` + UI smoke) | Stage-5 mini-IRQ is **criteria-driven**: privileged-access asked for IT/services/consulting/contingent or medium+ data sensitivity; critical-service asked for value ≥ threshold, elevated supplier risk, or high+ sensitivity; low-value low-sensitivity demand asks nothing ("No further questions"). Each shown question states "Asked because…". UI smoke asserts the rationale renders **inside the conversation bubble**. |
| TC-DET-05a | A new request's phase 3 | Only the service-description questions are asked first. The supplier question comes **after** the description and before the risk questions, and leaving the supplier to the market is a valid answer. The Details step used to render the chat, a risk card and supplier selection at once, before the requester had answered anything (`test:intake-conversation`, `test:ui`) |
| TC-SUP-C1 | The supplier section, with recommendations listed | Each row offers **Prefer** and **Also invite**: several suppliers go to sourcing while exactly one is preferred. Intake could name only one, so a requester who knew two or three plausible vendors dropped all but one and re-entered them at the sourcing event (`test:supplier-candidates`, `test:ui`) |
| TC-SUP-C2 | "I have none in mind — go out to market" | The choice is stated back and is reversible. This was only expressible by leaving the field blank, which reads as an omission rather than a decision, and gave no confirmation it had registered |
| TC-SUP-C3 | Submit with several candidates, then resubmit the same request | One row per supplier in `request_supplier_candidates`, the preferred one flagged. Upserted on `(request_id, supplier_id)`, so a retry cannot duplicate. The determination is unchanged — screening, risk reuse and contract coverage still run against the **preferred** supplier alone, because a compliance record that averaged several would stop meaning one thing |
| TC-SUP-C4 | Make the candidate write fail after a successful submit | The request stands and the screen says the shortlist could not be saved. It is deliberately outside the atomic intake write: a sourcing input must not roll back a submitted request, and a silent failure would leave sourcing to find an empty list with no explanation |
| TC-DET-06 | Reach the risk questions on the chat path | They are asked as **Yes/No choices in the conversation**, not as a card of switches below it, and the text input is disabled while one is pending. That disabling is the guarantee: there is no free-text path into a governance answer, so a model cannot fill one by extracting it from prose (`test:ui`, `test:demand-conversation`) |
| TC-DET-07 | Answer no, then check the record | `risk-question:<id>=no`. Leave it unanswered and the record says `not-answered` — never `no`. Both used to default to `false`, so the record could not tell the two apart (`test:intake-evidence`, `test:intake-determination`) |
| TC-DET-08 | Decline an optional question (say you don't know the need-by date) | The conversation moves on and completes: only the mandatory floor and the **triggered risk questions** hold it; a question it gave up on must not — gating on an empty agenda made the chat say "that's everything I need" while the step stayed blocked with nothing to explain why. Submit still needs the date, so the channel waits for it to be added on the right, and says so (`test:intake-conversation`) |
| TC-AST-EX | The intake assistant returns a field it was not asked for | It is discarded. The chat step spread every key of the model's `extracted` object into form state, so a response naming `preCheckOutcome`, `costCentre` or `miniIrq` would set it — the model answering a governance question the requester never was. The system prompt asks it not to; `EXTRACTABLE_FIELDS` is what stops it (`test:assistant-extraction`) |
| TC-DET-06 | Demand disposition (`npm run test:referral` + UI smoke) | proceed / request-change / refer-back, most-blocking-wins: missing-mandatory, out-of-scope, or **blocked supplier (screening)** → refer-back; failed policy check or duplicate → request-change; else proceed. Headline banner renders on the determination and appears in the export. |
| TC-ORC-01 | Transition records the first stage (`npm run test:orchestration`) | The stage a request is **created** in is recorded and left open. The idempotency guard is "already in this stage **and** already recorded as being in it" — a status-only guard declined to record the first stage, which is how wizard-created requests came to have no history and render as never started. Recording it twice still opens only one row |
| TC-ORC-02 | No-template fallback creates no instance | A request with no resolvable template gets **no** workflow instance and a proper stage transition (history, owner, SLA), not a `fallback:<channel>` instance. The old synthetic row made the Complete-stage button a silent no-op that still reported success, because `advanceWorkflow` returns early on an unresolvable template while the button's own fallback only runs when there is no instance at all |
| TC-ORC-03 | Seed parity with live (`npm run test:seed-parity`) | Every workflow template in `src/data/workflows.ts` matches its live row in the governance-bearing fields — node set, type, label, role, `slaDays`, `gate`, and each node's outgoing edges **in branch order**. `api/admin/seed.ts` upserts templates by id, which is a full column overwrite: live WF-001 had a 15th node ("Vendor Onboarding") and every WF-002/003/004 stage node had an `slaDays` that the seed file lacked, so a seed run would have deleted an entire lifecycle stage and every SLA outside WF-001. Array order across sources is deliberately *not* compared — only order within one source changes which branch the engine takes. |
| TC-SDC-01 | Service description config — question equivalence (`npm run test:service-description-config`) | The serialised template drives the same conversation the hardcoded `ALL_SLOTS` did: **every category × value × slot combination agrees** on whether a slot applies. `appliesWhen` is stored as `{field, operator, value}` — the vocabulary already shared with `routing_rules` and `form_templates.trigger_conditions` — and `policy:<key>` values still resolve through the governed thresholds, so `/admin/thresholds` keeps moving them. |
| TC-SDC-02 | Narrative composition | The compact narrative composes from `narrative_sections`, in order, in **one** function used by the API, the deterministic mock and the offline fallback — the three had drifted (six-field vs four-field joins) while the docstring claimed they were in step. An unanswered section contributes nothing rather than an empty clause. |
| TC-SDC-03 | Downstream seeding | `seedRequirementsFromDescription` turns each nominated section into one labelled requirement and skips empty ones (a requirement a supplier cannot respond to is worse than one fewer); `seedCriteriaFromTemplate` returns the configured criteria and **reports** when the weights do not total 100 rather than shipping an event the wizard will refuse to publish. |
| TC-SDC-04 | Resolution + fail-open | Category-first, then `default`, then the built-in template. A missing row, a malformed row, or an unreachable database all yield the built-in, so an admin mistake cannot take intake generation down. |
| TC-DET-07 | Supplier screening (`npm run test:screening` + UI smoke) | clear → cleared (green); flagged → blocking (red, refers the demand back); pending → caution (amber); unset → not-screened. "Supplier screening" line renders on the determination. |

### UI smoke (automated — `npm run test:ui`, Playwright)

| ID | Steps | Expected |
|---|---|---|
| TC-UI-01 | Boot app at `/` | React mounts; no console/page errors |
| TC-UI-01b | `/requests/new` render | Scrollable content reserves enough bottom clearance (`<main>` `padding-bottom` ≥ the fixed AI assistant button's own exclusion zone, measured from the button's actual rendered rect) that a page's own bottom-right content can never end up underneath it — and the conversation page's two columns, which scroll inside the window, end above the button. Regression for the old wizard's Next/Submit being unreachable behind the FAB |
| TC-UI-02 | `/requests/new` → say what is needed → **Yes** | **No commodity-category tiles** (Goods/Contingent Labour asserted absent); the words are read back as a category and code to confirm, then the catalogue and contracts are checked and the way to buy offered — a catalogue item to the basket, a call-off (the direct call-off limit held at the value) to its Channel page and submit, a new request through the supplier, the risk questions and a panel edit to its Channel page |
| TC-UI-03 | Inputs then conclusions (new request → the conversation → the Channel page) | The conversation carries every question — the service description, the supplier, the mini-IRQ questions with the "asked because" rationale. The Channel page carries the conclusions and nothing to fill in: the stages that will run and why, the checks, and the workings (materiality, inherent risk driven by the mini-IRQ answer, contract/sourcing type, approval-to-source, next steps) — with Save as draft and Submit |
| TC-UI-04 | Full-app sweep (`npm run test:e2e-ui`) | Every route (admin role for app/admin, supplier role for portal) + 5 detail pages render with no console errors, no white-screens, no uncaught exceptions. Guarded admin routes render real content (role injection verified). |
| TC-UI-05 | Interaction E2E (`npm run test:interactions-ui`, self-cleaning) | **The conversation to submit** creates a request (reaches confirmation, persists, then deleted); **admin category create** persists & shows in the table (then deleted); **AI assistant** returns a response within 25s (no hang) **and a supplier lookup returns connector-backed data** (AST-Q); **config wiring** — an admin lowers the approval threshold to 10k and saves, then the **same €50k demand that is a *light* gate at the default 250k becomes a *full* gate in the live determination** (proves admin config drives the live front door); **workflow designer** renders the selected template's nodes on first load and shows the channel's requester headline (regression: the ReactFlow canvas used to mount before the templates query resolved and stay blank until a manual template switch); **dashboard integrity** — System Health shows the live Data Source status + real request volume (no hardcoded "47 active users" / always-"Healthy" tile) and the "AI Insights" widget no longer claims analysis it never ran. The config-wiring flow **saves a threshold to the live policy row**; the suite snapshots that row over a direct connection first (it is not behind `/api/db`), skips the flow if it cannot, and restores it in its `finally` — before this, nothing restored it and a production run left the full-approval threshold at €10,000. Set `E2E_UI_BASE` to run it against a deployed Vercel build; its renewal path correctly starts at **Contract check**, not Catalogue check. No uncaught errors in any flow. |
| TC-UI-06 | Operational home dashboard | `/` renders one consistent Expert dashboard with live role-based widgets and quick actions. The retired alternate home layouts, their switcher, the `homeDesign` preference nothing read, and the browser suite that tested them have all been **deleted** — there is one home, so there is nothing to assert the absence of. |

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
13. **AI assistant button obstructing a page's bottom controls** (TC-SMK-08b / TC-UI-01b) — once the wizard's Next/Submit;
    fixed 29 Aug 2026; re-check on any change to `AppLayout`, `SupplierPortalLayout`, or the AI FAB's
    size/position.
14. **Request-detail content duplication** (TC-REQ-D6/D7/D8/D9/D10) — fixed 29 Aug 2026; a page hook
    existing in the codebase does not mean it is wired to the UI (`useCreateFormSubmission` had zero
    callers), and a filter that looks complete may be missing an obvious field (`forStage()` never
    checked template `status`). Re-check the ownership table in `docs/specs/design-document.md` §5.3
    before adding new content to any request-detail tab or the header — the failure mode is a new
    section quietly duplicating one that already exists elsewhere on the page.

15. **Role-aware deep links** (TC-NAV-01..05) — supplier and contract names on request
    details, expiring-contract rows, related records, and purchase-order links must land on
    their record route for entitled roles. Requesters may inspect supplier/contract details
    read-only; they must never be sent to Home because a visible link was unauthorized.

### Link navigation suite

`npm run test:link-route-integrity` checks the active route/link contract statically.
`npm run test:link-navigation` runs the deployed Playwright checks using the visible role controls. It captures before/after screenshots and a manifest under
`docs/testing/artifacts/ui-e2e/<run-id>/`, checks supplier and contract deep links, expiring
contract rows, read-only requester controls, privileged edit controls, keyboard activation,
console/runtime errors, and horizontal overflow. A local Vite run may classify `/api/*` failures
as serverless-unavailable; the meaningful navigation verdict is the deployed run.

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

## Stabilisation follow-up — 31 Aug 2026

- Full-intake writes now tolerate additive Neon schema rollout gaps by persisting only columns present
  in `information_schema` (including the optional `commodity_candidates` compatibility field).
- Neon connectivity checks classify DNS/network failures as unavailable rather than product failures;
  deployed runtime checks remain authoritative.
- Supplier risk pages expose a rationale-gated vendor-manager/admin decision form, and the onboarding
  pipeline exposes a rationale-gated procurement/admin completion action. These are simulation-role
  controls; production authorization is deferred.
- Remaining live gaps to validate: full text/PDF/DOCX intake submission, linked sourcing through PO,
  supplier onboarding form persistence, invoice variance/payment reloads, and assistant conversation
  persistence. No existing UAT evidence is removed.
- Latest deployed route checks completed successfully: `npm run test:ui-full` recorded 63 checkpoints
  with zero failures/runtime errors; the deployed link-navigation suite recorded 11/11 checks. Run
  directories are no longer committed (see below), so re-run the suite to reproduce the evidence
  rather than citing a run id that is not in the repository.

## UI-only procurement lifecycle run

> **What this proves.** `test:ui-full` is an **evidence harness**, not an assertion suite: across its
> 60+ checkpoints it checks only that no uncaught page error occurred and that the page rendered
> something. It records the heading it found without checking it, so a screen showing the wrong
> content still passes. Use it as a wide net for crashes and white screens; use the focused suites
> (`test:request-detail-ui` and the integration suites) for correctness.

> **Also covered here:** `test:ui-lifecycle` (`tests/integration/ui-lifecycle-hardening.mjs`) is a
> static guard that call-offs, stage actions and invoice transitions stay UI-governed — it reads the
> real sources rather than driving a browser, so it runs offline in the default gate.

`npm run test:ui-full` drives the live Vercel app through the visible role switcher. It covers
Simple and Expert catalogue checkout, contract call-off, full intake, sourcing, receipt, invoice
matching, approval and the internal scheduled/paid payment tracker. The suite never impersonates a
user through localStorage or calls application APIs directly. Screenshots and a manifest are kept in
`docs/testing/artifacts/ui-e2e/<run-id>/`, which is **gitignored**: a run writes ~5 MB of full-page
PNGs, and ten committed runs had reached 35 MB in the history before the rule existed. Treat the
output as local evidence for the run you just did, not as a repository artefact. Records are retained
in the database with a `UI-E2E-<timestamp>` prefix (ADR-0006) and need a periodic purge.

Required fields are asserted at the current stage only. Optional expert fields remain collapsed and
cannot block progression. A missing UI action, unavailable live fixture or lifecycle error is written
to the run manifest rather than silently bypassed.
