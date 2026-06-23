# Implementation Assessment & Execution Plan (codebase-verified)

**App:** orchestration-ui · **Build verified live:** `index-BxI8ggRp.js` · **Date:** 2 June 2026
**Verification:** black-box test of the deployed app **+** source cross-check (`src/`, `api/`, `supabase/`). Every claim below has a file reference.
**Goal:** a fully working end-to-end **orchestration + S2C + P2P** platform.

### Direction decided (drives scope of this plan)
- **Target:** Production-bound MVP → plan real **Supabase Auth/SSO + RLS** and **one live ERP integration**.
- **Workflow engine:** **Full template-driven runtime** → the Workflow Designer template becomes the execution source of truth.
- **Admin config:** **Full vocabulary tables** → categories, channels, stages, SLAs, thresholds become admin-managed Supabase tables.
- **Depth in scope now:** **P2P depth, Supplier risk feeds, Sourcing persistence.** **CLM (clause library/redline/e-sign) is DEFERRED** to a later phase.

---

## 0. Headline correction vs. the previous draft

The app is **more built than the black-box pass implied**. Much of the "orchestration core" already exists in code; it's blocked by **missing database tables** and a few wiring gaps, not absence. The single most important discovery:

> **Several tables referenced by code + admin UI are NOT in `supabase/schema.sql`:** `approval_chains`, `sla_targets`, `procurement_categories` (and there is no `goods_receipts` table). Their admin pages, TypeScript types, and `upsert` DB helpers all exist — so "Save" currently fails against a non-existent table. Creating these tables unlocks a large amount of already-written functionality.

This reframes the plan from "build" to mostly **"add the missing migrations + finish the wiring."**

---

## 1. What is genuinely already working (verified)

- Real Supabase read/write for **requests, purchase orders, invoices, contracts (`contracts_with_derived`), catalogue items** (`src/lib/db/*.ts`).
- **Workflow engine exists and executes** templates: `src/lib/workflow/engine.ts` — `initWorkflow`, `advanceInstance`, `executeNode` handle start/end/error/stage/decision/parallel/integration nodes, suspend/resume on approval, and **generate approval entries from a chain** (`generateApprovalEntries`, engine.ts:84–135). Instances tracked in `workflow_instances` (schema.sql).
- **Approval chains persist** via `upsertApprovalChain` → table `approval_chains` (`src/lib/db/approval-chains.ts`), and the engine reads them to create `approval_entries`.
- **Admin config UIs already built** for categories (`features/admin/categories-page.tsx` → `procurement_categories`), SLA targets (`features/admin/sla-targets-page.tsx` → `sla_targets`), routing rules (wired to intake), forms, workflow designer, AI agents.
- **AI agents wired at runtime:** **AI-001 Category Classifier** (`api/ai.ts` + `step-category.tsx`; status toggles LLM vs local) and **AI-005 Supplier Recommender** (`supplier-recommender-card.tsx`; verified live — enabling it surfaced ranked suppliers in Step 4).
- **Three-way match tolerance is configurable** and actually applied (`useSettingsStore.matchTolerancePct`, `three-way-match-page.tsx:16-34,127`).
- **Role now persists** across reload (Zustand `persist` to localStorage, `src/stores/auth-store.ts`).
- Already-fixed since first audit: wizard Step-4 crash, SRC-004 date crash, AI summary, Documents tab, portal Submit-Invoice dialog, confidence formatting, currency, exports.

---

## 2. PHASE 0 — Unblock the end-to-end thread (do first)

> **RETEST 2 June 2026 (build `index-Dh6g69hR.js`):** complex/wizard submission is **FIXED** (REQ-2025-9145 created & persisted; "By 31 December 2026" parsed to a real date; Open Demand 26→27). **Catalogue "Order Now" is STILL BROKEN** (see 0.1). Two new bugs found: classifier accuracy (0.7) and Step-1 category override not propagating (0.8). The **Service Description generator** is verbatim-echo only — new requirement in §10.

### 0.1 PARTIALLY FIXED — request insert dates (E2E-1)
- **Wizard/complex path: FIXED** — a `delivery_date` parser now converts "By 31 December 2026" → a real date; the row persists.
- **Catalogue "Order Now": STILL BROKEN.** Clicking Order Now on a catalogue cart returns toast **"Order failed: invalid input syntax for type date: \"\""** — an **empty string** is sent to a `DATE` column in the catalogue-order insert path (the date fix was applied to the wizard path only).
  - **Fix:** apply the same coercion in the catalogue/auto-PO order path — coerce empty/blank dates to `null` (or compute a delivery date = today + item lead-time) before insert. Find the Order-Now handler (catalogue command-bar cart + catalogue wizard path) and the order/PO insert; ensure every date field is `null` or valid `YYYY-MM-DD`. Audit all inserts for the same `'' → DATE` hazard.
- **Acceptance:** placing a catalogue order creates an order/PO and shows success; no date-syntax error; the order appears in Purchase Orders / the requester's list.

### 0.2 BLOCKER — Create the missing Supabase tables (+ seed)
Code, types, admin UIs and `upsert` helpers exist; the tables don't. Add migrations for:
- **`approval_chains`** (id PK, name, description, threshold text, steps jsonb, referenced_by text[], timestamps) — unblocks Approval Chains admin Save **and** the engine's `generateApprovalEntries`.
- **`sla_targets`** (stage, channel, days; PK(stage,channel)) — unblocks SLA admin + per-stage SLA logic (default 5d today).
- **`procurement_categories`** (id PK, label, description, icon, timeline_days, sort_order, active) — unblocks Categories admin + data-driven categories.
- **`goods_receipts`** (see 2-P2P) — referenced by three-way match / receipt.
- **Acceptance:** each admin Save persists and survives reload; `generateApprovalEntries` finds a chain and writes `approval_entries`.

### 0.3 HIGH — Re-anchor demo dates so KPIs/SLA/expiry are truthful (E2E-4)
- **Root cause:** `src/lib/demo-date.ts` `resolveDemoReference()` anchors to the latest record date, but seed requests/contracts are dated **2024**, so the trailing-window's final bucket is empty → Avg Cycle Time 0, Compliance 0, Expiring <90d = 0 (`use-live-kpis.ts:58-70`, `widget-expiring-contracts.tsx:13`).
- **Fix (production-bound choice):** re-seed `createdAt/updatedAt/endDate/dueDate` across requests, contracts, invoices, POs to **relative-to-now** ranges (some completed this/last month; some contracts expiring within 90 days), and switch KPIs to use `new Date()` as reference (drop the demo anchor) so it stays correct in production.
- **Acceptance:** dashboard shows non-zero cycle time + compliance; renewals shows a few expiring <30/<90d.

### 0.4 HIGH — Compliance tab never renders a report (E2E-3)
- **Root cause:** `tab-compliance.tsx` reads `compliance_reports` (Supabase) then falls back to seed `src/data/compliance-reports.ts`, which is keyed to **REQ-2024-*** only; live data is **REQ-2025-***; nothing generates reports.
- **Fix:** implement generation — when a request reaches/passes Validation, run the **PR Compliance Reviewer (AI-006)** and insert a `compliance_reports` row (6-category findings, decision, confidence per spec §6.3). Seed a few REQ-2025 reports for demo immediacy.
- **Acceptance:** any request at/after Validation shows a populated Compliance tab.

### 0.5 HIGH — AI Assistant leaks chain-of-thought, doesn't ground (E2E-2)
- **Root cause:** `api/chat.ts` calls Groq once (`callLLMWithTools`, `tool_choice:'auto'`, model `llama-3.3-70b-versatile`, `_llm.ts:52`); when the model returns CoT text + a narrated tool call, the fragile `parseTextToolCall` regex misses it and the **raw content is returned** (chat.ts:539-575,655-672). No real tool execution loop; no second `tool_choice:'none'` pass; CoT/LaTeX not stripped; system prompt doesn't forbid step output.
- **Fix:** (a) in `api/chat.ts` implement the proper loop — on structured `tool_calls`, execute the tool against KB/Supabase, append the tool result, call again with `tool_choice:'none'` for the final grounded answer; keep `parseTextToolCall` only as a guard. (b) Strengthen `SYSTEM_PROMPT` (chat.ts:143): forbid "## Step" reasoning and raw tool-name text. (c) In `turn-chat-answer.tsx`, strip `$\boxed{}$`/`## Step`/"The final answer is:" and render a **source chip**. Mirror the clean pattern already in `mockProvider.ts`/`capabilities/knowledge.ts`.
- **Acceptance:** the 4 brief scenarios return clean, cited answers in both `mock` and `groq`; no CoT/LaTeX leakage.

### 0.6 HIGH — Upgrade the Service Description (SOW) generator (see full spec in §10)
The conversational SOW currently stores each chat answer **verbatim** into its section — it does not produce a long, detailed, validated, best-in-class Statement of Work. This is a primary requirement; full spec in §10.

### 0.7 MEDIUM — Classifier accuracy (E2E-5, worse than noted)
- A clear **management consulting** engagement ("design a target operating model and lead a digital transformation") was classified **Goods** @90%. The local/LLM classifier mislabels operational/advisory services as Goods.
- **Fix:** improve `api/ai.ts` classifier prompt + few-shot examples (and the local fallback in `step-category.tsx`/`lib`): enforce the spec's category rules (advisory/strategy → Consulting; operational service → Services; physical product → Goods). Add the spec's worked examples as few-shots. Lower the displayed confidence when signals conflict.

### 0.8 MEDIUM — Step-1 category override doesn't propagate
- Editing the AI-classified **Category** field in Step 1 (e.g. Goods→Consulting) does not update `formData.category`: the Step-3 chat header, Summary panel, and the **submitted record all stayed "Goods"** even though I changed it. The pre-check used the new value but the form state didn't.
- **Fix:** bind the editable Category field to `formData.category` (controlled input + onChange) so manual correction persists through all steps and into the insert. (`step-category.tsx`.)

---

## 3. PHASE 1 — Orchestration backbone (your "full template-driven + full taxonomy" choices)

### G1 — Full template-driven workflow runtime
- **Now:** engine executes templates **but** stage progression uses the hardcoded `STAGES_BY_CHANNEL` fallback (`src/lib/workflow/buying-channel-stages.ts:19-25`); decision nodes don't truly branch.
- **Build:** on request submit, **always** `initWorkflow` from the request's attached `workflow_templates` graph (not the channel fallback); implement decision-node condition evaluation (value/category/risk → choose edge), timer/SLA nodes (from `sla_targets`), form nodes (require form completion to advance), and integration nodes (emit a `system_integrations` step). Keep `STAGES_BY_CHANNEL` only as a seed to author default templates. Wire request "advance" actions (approve/refer/etc.) through `advanceWorkflow`.
- **Acceptance:** changing a template in the Designer changes how a new request of that type actually progresses (skips, branches, SLAs), visible on the request Workflow tab.

### G2 — Finish approval-chain execution
- After 0.2 creates `approval_chains`: switch routing-rule linkage from **name string** to **chain id** (`types.ts:215` `approvalChain: string`; engine resolves by id then name `ilike`, engine.ts:89-98). Ensure `generateApprovalEntries` resolves role→user honoring **OOO/delegate**, and that generated entries appear in the Approvals queue and drive `advanceWorkflow`.
- **Acceptance:** editing a chain in Admin changes the approvers generated for a new matching request; OOO routes to delegate; audit entry written.

### G3 — Full taxonomy as admin-managed tables
- After 0.2 creates `procurement_categories` + `sla_targets`: also promote **buying channels** and **lifecycle stages + per-channel stage sequence** (today hardcoded: `KNOWN_CHANNELS` types.ts:15, `STAGES_BY_CHANNEL`) into tables with admin CRUD, and make **value-band thresholds** first-class (today only inside `approval_chains.threshold` free text + routing-rule values). Point routing/approvals/policy/intake at these tables. Add an "Affects/Used by" indicator per admin editor (extends the routing-rules match-count pattern).
- **Acceptance:** an admin can add a category/channel/stage/threshold/SLA with no code change and see it take effect in intake, routing, approvals, and the lifecycle.

---

## 4. PHASE 2 — Depth in scope (P2P, Sourcing, Supplier risk)

### G7 — P2P depth (POs & invoices already real Supabase)
- **Goods receipt:** add `goods_receipts` table + receipt write from `goods-receipt-page.tsx`; feed real GR into three-way match (replace the static `rawScenarios`, `three-way-match-page.tsx:48-94`) so match uses live PO/GR/Invoice.
- **Invoice extraction:** add `api/extract.ts` (Document Extractor / AI-003) — upload → structured fields → prefill invoice; wire to Invoice Queue.
- **Budget check:** replace the form checkbox (`form-templates.ts`) with a real budget lookup at compliance/PO (a `budgets` table by cost-centre; block/flag over-budget).
- **Payments:** add a sandbox payment step (status transitions + a mock/sandbox gateway adapter) and populate Payment Tracker "Paid Date".
- **Acceptance:** receive goods → match against real GR → approve → schedule → pay, all persisted; over-budget requests are flagged.

### G4 — Sourcing persistence + award→contract handoff
- **Now:** `new-event-page.tsx:152-160` only toasts+navigates; event list is a **mock array** (no `useSourcingEvents`).
- **Build:** `src/lib/db/sourcing-events.ts` (+ `sourcing_events`/`sourcing_responses` tables) and persist publish/draft; on award in the Evaluation Centre, generate a contract (and/or PO) linked to the winning supplier.
- **Acceptance:** a published event appears in the list and detail; awarding creates a linked contract/PO.

### G6 — Supplier risk via external feed
- Wire one real screening source (e.g., an OFAC/EU sanctions or financial API) behind `api/screen-supplier.ts`; store results on the supplier and surface in onboarding + Risk & Compliance; let the SRA status reflect the live result.
- **Acceptance:** onboarding a supplier triggers a real screen; a flagged result shows in Risk & Compliance and blocks/flags downstream.

---

## 5. PHASE 3 — Production hardening (target = production-bound MVP)

### G9 — Auth + RLS + one live integration
- **Auth:** replace the Zustand role switcher (`auth-store.ts`) with **Supabase Auth (+ SSO)**; map authenticated user → role; keep a dev-only role impersonation behind a flag.
- **RLS:** add row-level security per the spec §2.2 permission matrix (the audit found routes are guarded client-side, but the API/DB are open — "allow all" policies per `.env.example`). This is required before real data.
- **One live ERP integration:** replace the simulated `system_integrations` (static `src/data/system-integrations.ts`, display-only) with a real connector for **one** system (recommend SAP S/4HANA for PO/vendor/invoice sync) behind `api/integrations/*` + webhooks; keep the others simulated, clearly labeled.
- **Acceptance:** users log in (SSO), see only permitted data (RLS enforced server-side), and one integration performs a real round-trip with status reflected in System Health.

### Cross-cutting wiring (do alongside)
- **G10 — finish agent execution:** wire AI-002 Request Validator (Step 4 checks), AI-003 Document Extractor (G7), AI-004 Spend Anomaly (Spend dashboard), AI-006 PR Compliance (0.4). Make agent config params (weights/thresholds/inputs) actually drive behaviour, not just show/hide.
- **G11 — finish exports (PDF/Excel, not just CSV), persist notification prefs, apply the currency/locale setting, responsive/mobile approvals.**
- **E2E-6:** add visually-hidden `DialogTitle` to dialogs (Radix a11y warning persists).
- **E2E-5:** tune the classifier so operational services (e.g., "translation services") aren't labelled Consulting.

---

## 6. Explicitly DEFERRED (not in this plan, by decision)
- **G5 — CLM depth:** clause library, contract templating, redline/version, e-signature, obligations management. (Contracts register/detail stays as-is; templates remain static.)
- **G8 — Catalog punchout, vendor cards, global payments.**
- Additional simulated integrations beyond the one live connector.

---

## 7. Suggested execution order
1. **Phase 0** (0.1 → 0.2 → 0.3 → 0.4 → 0.5): unblock E2E creation, missing tables, truthful dates, compliance, assistant. *Nothing else works end-to-end until 0.1/0.2.*
2. **Phase 1** (G2 finish → G3 tables/wiring → G1 full runtime): the orchestration backbone.
3. **Phase 2** (G7 P2P → G4 sourcing → G6 risk): complete source-to-pay.
4. **Phase 3** (G9 auth/RLS/integration; G10/G11 wiring; E2E-5/6 polish).

## 8. Status table
| Item | Area | Sev/Phase | State (verified) | Effort |
|---|---|---|---|---|
| 0.1 request insert 400 | Intake | BLOCKER | 🔴 free-text date → DATE col | S |
| 0.2 missing tables (chains/SLA/categories/GR) | DB | BLOCKER | 🔴 code exists, tables absent | S–M |
| 0.3 re-anchor dates | Analytics | HIGH | 🔴 demo-date anchors to 2024 | S |
| 0.4 compliance report generation | Compliance | HIGH | 🔴 seed=REQ-2024 only, no gen | M |
| 0.5 assistant tool loop + render | AI | HIGH | 🔴 single-pass, CoT leak | M |
| G1 template-driven runtime | Orchestration | P1 | 🟡 engine exists, uses fallback | L |
| G2 approval-chain execution | Orchestration | P1 | 🟡 persists+generates; table missing; name-linked | M |
| G3 full taxonomy tables | Admin | P1 | 🟡 categories/SLA UI exist; channels/stages/thresholds hardcoded | M–L |
| G7 P2P depth | P2P | P2 | 🟡 PO/invoice real; GR/extract/budget/pay missing | L |
| G4 sourcing persistence | S2C | P2 | 🔴 toast-only, mock list | M |
| G6 supplier risk feed | S2C | P2 | 🔴 static | M |
| G9 auth + RLS + 1 integration | Platform | P3 | 🔴 role switcher; open policies; simulated | L |
| G10 agent execution | AI | P3 | 🟡 2/6 wired | M |
| G11 exports/notifs/i18n/mobile | Platform | P3 | 🟡 | M |
| G5 CLM | S2C | DEFERRED | 🔴 | — |
| G8 punchout/cards/payments | P2P | DEFERRED | 🔴 | — |

*Effort: S<½day · M 1–3 days · L 1–2 weeks (rough, single-dev).*

---

## 9. Open design questions for the build (flag before/while implementing)
- **Stages as data (G3):** promoting lifecycle **stages** to a table affects the `RequestStatus` enum used everywhere (`types.ts:2`) and the stepper UI — confirm whether to keep the enum as the canonical set and make tables *configure* sequence/visibility, vs. fully dynamic stages. (Recommend: keep enum as the superset; tables drive sequence/SLA/skip — lower risk, still "configurable".)
- **Decision-node condition language (G1):** what expression format for Designer decision edges (simple field/op/value like routing rules — recommended — vs. free expression)?
- **Live integration choice (G9):** confirm SAP S/4HANA first (vs. Ariba/Coupa) and whether a real sandbox/credentials are available, else build against a mock API with the real adapter shape.
- **Supplier risk provider (G6):** which screening source/API (sanctions only vs. financial/ESG) and is a key available?
- **Payments (G7):** sandbox provider preference (e.g., Stripe test) vs. status-only mock.

---

## 10. Service Description (SOW) generator — upgrade to a detailed, validated, best-in-class output

### Current behaviour (verified live)
- Step 3 asks one question per section and writes the **user's raw one-line answer verbatim** into that section (e.g. Objective = exactly the sentence the user typed). Empty sections read "Will be captured during conversation…".
- There is **no AI drafting, expansion, enrichment, or validation** — the result is a thin form capture, not a professional SOW. The "narrative summary" (spec §4.4) is effectively just the concatenated short answers.
- Files: `src/features/requests/new-request/` SOW chat component + the `serviceDescription`/`ServiceDescription` state and the right-hand 9-section panel; persisted via `service_descriptions` (see `src/data/service-descriptions.ts` / `src/lib/db/*`).

### Target behaviour
Produce a **long, structured, professionally-written, validated** 9-section SOW (Objective, Scope, Deliverables, Timeline, Resources, Acceptance Criteria, Pricing Model, Location, Dependencies) — comparable to what a senior category manager / consultant would draft — from the gathered context, then let the user refine.

### What to build
1. **LLM generation endpoint** — add `api/generate-sow.ts` (server-side, reuse the Groq/Gemini setup in `_llm.ts`). Input: category, title, description, value, timeline, supplier (if any), commodity code, and the user's captured chat answers. Output: a JSON object with all 9 sections, each a **rich, multi-sentence, professional draft** (not an echo), plus a `narrative` field (3–4 paragraph executive summary). Use a strong system prompt with category-specific guidance (consulting vs services vs software) and the spec §4.4 examples as few-shots.
2. **Expand-not-echo** — when the user gives a short answer, the model should **expand** it into a complete section (e.g. Objective answer "design TOM" → a full objective paragraph with business rationale and success framing), and **infer sensible defaults** for sections the user didn't explicitly answer, clearly marked as AI-drafted so they can edit.
3. **Validation / quality gate** — after generation, run a completeness+quality check (each section non-trivial, deliverables enumerated, acceptance criteria measurable, timeline phased, pricing model stated). Surface a **quality score / checklist** and flag weak sections ("Acceptance criteria not measurable — add metrics"). Block "best-in-class" claims until the gate passes; offer "Improve this section" regeneration per section.
4. **Editable + regenerate** — each section editable inline; per-section **Regenerate** and a global **Regenerate full SOW**; "Accept" locks it. Keep the copy-to-clipboard for the narrative (spec §4.4).
5. **Persistence** — save the full structured SOW + narrative + quality score to `service_descriptions` and show it on the request detail (Overview/Documents).
6. **Best-practice library (optional, recommended)** — seed category templates/exemplar SOWs the model can ground on (could live in the KB) so output reflects "state of the art" patterns (e.g. consulting: phased delivery, RACI, T&M-with-cap, KPIs/SLAs; software: licensing/DPA/security; services: SLAs/coverage/transition).

### Acceptance criteria
- For a consulting request, the generated SOW is **long and specific** (each of the 9 sections is a substantive paragraph/list, deliverables numbered, timeline phased with durations, acceptance criteria measurable, pricing model explicit), not a verbatim copy of the user's sentences.
- Unanswered sections are auto-drafted and labelled AI-generated; the user can edit/regenerate any section.
- A visible **quality score/checklist** validates completeness and flags weak sections; the SOW persists and appears on the request detail.
- Works in both `mock` (deterministic richer templates) and `groq/gemini` modes.

### Design decision to confirm
- Generation timing: **draft the full SOW up front** from the description (then refine via chat) vs. **keep the Q&A** but expand each answer live vs. **hybrid** (Q&A to gather, then one "Generate full SOW" step). *Recommended: hybrid — gather a few key answers, then generate the full validated SOW with per-section regenerate.* Confirm preference.
