# FR-01: Intake & New Request Wizard

**Version:** 1.0 · **Date:** 4 September 2026 · **Roles:** `service-owner`, `procurement-manager`, `admin`

---

## Purpose

The New Request wizard is the platform's primary front door — a single intelligent intake channel for any procurement need. It combines AI-assisted classification, natural language service-description generation, compliance checks, and routing preview into the current seven-stage Expert flow, with an adaptive Simple flow for requesters.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR01-01 | service-owner | I can describe what I need in plain English and the system classifies it into the right procurement category | Must |
| FR01-02 | service-owner | I can browse the catalogue and order a basket of approved items through governed checkout; a basket up to the auto-approval threshold (judged on its total) is approved automatically | Must |
| FR01-03 | service-owner | I can see exactly which approval path my request will follow before submitting | Must |
| FR01-04 | service-owner | After submitting I can track my request status and see "Track this Request" resolve correctly | Must |
| FR01-05 | procurement-manager | I can see all requests across the organization, not just my own | Must |
| FR01-06 | admin | I can configure which categories appear in Step 1 without a code change | Should |

---

## Intake steps

> **Updated September 2026.** The wizard was seven steps; it is now **four**,
> driven by one config (`src/features/requests/new-request/intake-steps.ts`)
> that owns step order, per-route applicability, gates and guidance copy. The
> organising rule is that **every question is asked before any conclusion is
> shown**: Details holds every input, the Channel page every conclusion. Simple and
> Expert are one page — `density` picks framing and how much evidence is shown,
> never a step, a gate, a decision, or what is written. FR numbers are unchanged
> so existing references still resolve; the step they sit under has moved.

    Describe → How you'll buy → Details → Your buying channel   (→ confirmation)

A **catalogue order** is not placed in this wizard: a catalogue match (and
"Browse the catalogue" on Describe) goes to the **Catalogue page** with the items
in the basket (FR01-60). Pre-approved, pre-priced items reach no determination,
and none is manufactured. The wizard's own catalogue route was retired on
2026-09-25.

### Step 1 — Describe: unified description and specific classification
- FR01-11 · A demand typed on Home is first shown as *Understood as — Something to buy* (Door 1's card, like every other outcome), and **Start the request** brings it here as `?q=`, seeding this step; classification runs on it without a further keystroke, and the requester is never asked for the text a second time.
- FR01-12 · User types/pastes a description or uploads a PDF/DOCX. AI-001 extracts title, supplier hint and estimated value; the server returns specific commodity/service-family candidates.
- FR01-13 · If AI-001 is disabled/draft, fallback to local keyword classification, and the screen says which produced the answer.
- FR01-14 · Broad Goods/Services values remain internal routing metadata and are never shown as a requester choice.
- FR01-15 · Show up to three candidates only when one or more probabilities are at least 90%; otherwise show the highest candidate and "None of these". A confirmed choice and alternatives are persisted.
- FR01-10 · *(superseded)* Urgency is captured with the demand detail rather than as a pre-step; RR-010 ("Urgent request fast-track") reads it, and the toggle states what it would change at the moment it is ticked.

### Step 2 — How you'll buy: catalogue, contract, or a new request
- FR01-16 · System checks for an existing active contract covering the demand; the server-side matcher (`api/_domains/contract-match.ts`, ADR-0004) confirms coverage and may ask up to three clarifying questions.
- FR01-17 · Catalogue match: a catalogue-eligible category plus a naming-word match offers the item; ordering it adds it to the basket on the Catalogue page.
- FR01-18 · Contract call-off: a matching framework contract offers the call-off path (skips sourcing/contracting stages).
- FR01-55 · **All three routes render together**, recommendation first and badged, each in requester language — the headline and description on the workflow template that claims the channel, edited in Admin → Workflows (`channelCopy`) — with the category SLA as an indicative timeline. A ruled-out route states its reason **in place** and stays clickable — the previous sequential funnel could hide the correct path behind a wrong match.
- FR01-56 · The buying channel is resolved here by `resolveDemandChannel`, the same function the determination behind the Channel page calls, so the two cannot disagree. The matched words, item scores, contract fit/utilisation and the routing rule id are evidence behind a **"Why this?"** disclosure, Expert density only.
- FR01-57 · When the catalogue and contract sources are unreachable the screen states that neither was checked and nothing was ruled in or out, and offers the full-request route. Never a spinner; never "no match" for a check that never ran.

### Step 3 — Details: everything the requester supplies
- FR01-19 · One question engine asks only the missing fields, with separate Included (`scope`), Excluded (`exclusions`), Deliverables and Acceptance Criteria sections.
- FR01-20 · Each message is processed by `api/chat-intake.ts`; extracted fields populate `formData.serviceDescription`.
- FR01-21 · **Delivery date** extracted as free text → converted to YYYY-MM-DD by `parseDeliveryDate()` (`src/lib/parse-delivery-date.ts`) at submit time.
- FR01-22 · Contextual guidance is optional, anonymised and explicitly applied; deterministic prompts remain available when AI is unavailable.
- FR01-58 · The conversation **opens with an open invitation**, never the first agenda question; the first turn extracts as many slots as it can, and every subsequent question states why it is being asked and what the answer is used for.
- FR01-25 · *(superseded 2026-09-26)* There is no risk triage form: the triage is derived, and it is stated as a check on the Channel page — *Risk assessment needed* / *reused* / *not needed*, with its reason. The intake copy of the IT Security Assessment (FORM-006) is gone too: it discarded its answers and said "submitted"; the form is filled at the risk stage it is configured for, where it is saved.
- FR01-59 · The **mini-IRQ** (0–2 questions: privileged access, critical service) is asked **inside the conversation**, as its tail, once the description is captured — as Yes/No choices with the free-text box disabled, each carrying its "asked because" rationale. It is never extracted from prose: a governance answer recorded as evidence has to be given by the requester. On the form-based paths (contract renewal, supplier onboarding) there is no conversation, so it is still asked as a card of switches.
- FR01-59a · An answer is **tri-state**. Absent means the question was never put, which is a different fact from "answered no"; the determination reports both in `riskQuestionnaire` and the compliance record carries `risk-question:<id>=yes|no|not-answered`. Both answers used to default to `false`, so a question nobody asked and one answered in the negative produced the same record.
- FR01-59b · An answer to a question the demand **no longer triggers** is ignored. Answer yes to critical-service at a material value, then drop the value, and the question disappears while the answer used to go on forcing materiality to critical.
- FR01-60 · Supplier selection happens here, not on the determination: it is an input that *feeds* the determination, so choosing it afterwards would move the conclusion under the reader.
- FR01-61 · A disabled Next names what is outstanding — the missing conversation slots, and what submit will require (need-by date, cost centre, override reason).

### Step 4 — Your buying channel: how it will be bought, then submit
The Channel page (Intake Prototype, 2026-09-26) replaced Review & submit, for a full request **and a contract call-off**.
- FR01-23 · The determination is computed **once per intake** by `useIntakeDetermination` over the pure `evaluateIntakeDetermination`, with stable module-level empty-array defaults; the previous arrangement recomputed it inside the step and mirrored it back into form state through `onUpdate` (the F14 infinite re-render). The mirrored form fields are deleted (2026-09-26).
- FR01-67 · The page opens with how this will be bought — the channel template's requester headline and sentence — with the value, the **stages that apply** ("10+ of 11": the + when a stage depends on something not yet known) and the **stage targets** (working days of the stages sure to run).
- FR01-68 · **Step by step** lists every stage of the channel's template in the order the graph reaches them, each with its purpose, owner role and target days. Each is tagged *You are here* (intake), *Applies · why* (when a branch or the entry rule put it there), *If …* (depends on a signal not yet known — "If the supplier is new" while no supplier is chosen) or *Skipped · why* (a branch that did not hold, the entry rule's condition, or "only after" a stage that is skipped). The plan runs the server's landing rule (`firstActionableStage`; `checkoutEntryStage` for a call-off, both with their declared entry conditions) and the engine's own `getNextNodeIds` (`lib/workflow/channel-plan.ts`, `test:channel-plan`).
- FR01-69 · A stage says what the requester does there ("You: …") from its `requesterAction` (Workflow Designer). It is set only where the requester really acts; never on a stage this request skips.
- FR01-70 · Submit says where the request goes first and who owns it ("sends it to Validation (Category Manager)"); an auto-approved call-off says its purchase order is raised straight away.
- FR01-71 · **What you are submitting**: the executive summary with "N of M required sections" and every section on request; the request's facts; who and where; the supplier or who will choose one; and, when the channel sources, **who will be invited** — `sourcingInvites`, the function the sourcing event calls (named, shortlist, every preferred supplier). A call-off's supplier is the contract's, and nobody is invited.
- FR01-24 · **Checks** (`lib/procurement/channel-checks.ts`, `test:channel-checks`), most consequential first: why this channel, in the matched routing rule's own description; a refer-back or change request; supplier screening; contract coverage (a lapsed contract is named); who sourcing invites, or a supplier outside the preferred list; risk; the approvers submit will write; every failed policy check; missing required sections.
- FR01-26 · AI-002 (Request Validator) gates the policy checks. When inactive the determination records one failed check naming the agent — never an empty list — and the page says **policy checks did not run**, in the requester's terms, not the instruction to an administrator the record carries.
- FR01-27 · The approvers are derived as submit derives them: the chain the determination pinned, else the value band, under the governed thresholds (`chainIdFor`), with the category, cost centre, contract and preferred-supplier override (`useApproversOnSubmit`). The Review preview chose its own chain and left out the cost centre, so it could name people submit would not ask. While they load there is no approvals line, never "No approval needed".
- FR01-62 · A contract call-off reaches this page too. Its Details form continues here ("See how it will be bought") rather than submitting; the governed decision is built once by `call-off.ts` for the page and the submit, and Submit is held when the decision refuses the call-off, with the reason as a check.
- FR01-63 · **How this was worked out** — collapsed: materiality, inherent and operational risk, approval to source and its gates, contract and sourcing type, every policy check with its result, supplier assessment and the next steps with their deep links. The conclusions are the checks; these are the reasons behind them.
- FR01-64 · Anything that **blocks** the request — a refer-back, a blocking screening result, a call-off the decision refuses — is a check in the page's first view, not behind the disclosure.
- FR01-28 · *(superseded)* There is **no workflow-template picker**. The template is the one that claims the channel, as on submit.
- FR01-65 · The determination is exportable to structured Markdown from the workings.
- FR01-72 · Removed with Review: "Add reviewers / watchers" and "Notes for approvers" (collected and never saved), the routing preview's synthetic risk and onboarding steps and regex-guessed owners, and a "smart assessment" that re-derived contract coverage with its own €25,000 literal.

### Confirmation and automatic stage transition
- FR01-29 · The submit calls `/api/intake-submit`, which commits request, service description, intake compliance, stage history and workflow instance **atomically** with an idempotency key.
- FR01-30 · On success the workflow engine instance starts.
- FR01-31 · On failure a clean API/database error is shown without provider internals; the wizard stays on the current step. Neon is the active R1 provider.
- FR01-32 · "Track this Request" deep-link navigates to `/requests/{id}` which loads via `useRequest(id)`.
- FR01-33 · A complete submission enters the first actionable workflow stage and creates stage history, owner and SLA; it remains in `intake` only when required information is genuinely missing.
- FR01-66 · The compliance record is built by one function for both densities from the determination's **structured fields**, never from display strings, and **never records a check that did not run** (`duplicateCheck.performed`, `sraCheck: not-run`).

---

## Service description (§10 — unified, auto-composed)

### Architecture (conversation-driven, no manual generate)

The SOW and the service description are **one document**. The intake chat gathers the required
components through guided Q&A, and the service description is **composed automatically** once all
components are captured — there is **no manual "Generate SOW" action** and no per-section regenerate.

- FR01-40 · The conversation keeps asking until every required component is captured (title, value,
  objective, scope, deliverables, resources); only then is the document composed.
- FR01-41 · On completion the front door **automatically** calls `POST /api/generate-sow` with:
  `category`, `title`, `value`, `supplier`, `timeline`, `capturedAnswers` (all filled SOW sections),
  `commodityCode` — no user action required.
- FR01-42 · The endpoint uses a **category-specific system prompt** (consulting → phased delivery/RACI/KPIs; services → SLAs/coverage; software → licensing/DPA; goods → spec/incoterms) and LLM expansion — not verbatim echo.
- FR01-43 · Each structured section is **editable inline** (textarea); changes propagate to `formData.serviceDescription` immediately on edit and retain capture provenance.
- FR01-44 · If the endpoint is unavailable the step **degrades gracefully** — the conversation has already composed a working narrative — with no user-facing error and no button to retry.
- FR01-45 · The endpoint returns a **quality score (0–100)** and per-section checklist (pass/fail + issue description).
- FR01-46 · The quality badge is shown in the SOW panel header; clicking expands a checklist panel.
- FR01-47 · Quality rules: acceptance criteria must contain measurable KPIs; deliverables must be a numbered list; timeline must reference phases.
- FR01-48 · LLM unavailable → deterministic mock fallback generates expanded sections from a category template.
- FR01-49 · The full SOW (sections + narrative + quality_score + quality_checks) persists to `service_descriptions` table.
- FR01-50 · The request detail Overview tab shows the SOW quality badge next to the Service Description card title.

### Classifier fixes (June 2026)
- FR01-51 · `api/ai.ts` includes explicit category decision rules with 7 few-shot examples to reduce consulting/services/goods confusion.
- FR01-52 · `localClassify()` expanded with consulting keywords: `operating model`, `TOM`, `change management`, `programme management`, `maturity assessment`.
- FR01-53 · When the requester rejects the inferred commodity family ("None of these"), `accepted` and `aiResult` are reset so the correction propagates through all subsequent steps. There is no category tile grid to override — the broad category is never a requester choice (FR01-14).

### The Catalogue page (Door 2)
- FR01-60 · `/catalogue`: the catalogues the items belong to, a search across them, item cards (price, agreement, lead time), and a basket with total, deliver to and charged to (the profile first; active `delivery_locations` and `cost_centres` only), a required purpose, and a note taken from the governed decision. A basket across suppliers is placed as one order per supplier and contract, **approved on the basket total**, all or none (ADR-0009). The Home box, the assistant, an item's page and intake's catalogue match all add to this basket (`/catalogue?add=ID`), once.
- FR01-54 · ~~The command-bar catalogue Order Now path~~ — retired: the Home box no longer places orders.

---

## Data Flow

```
User input
    │
    ▼ api/chat-intake.ts (LLM extraction)
formData { title, category, supplierId, deliveryDate (freetext), estimatedValue, serviceDescription }
    │
    ▼ parseDeliveryDate(formData.deliveryDate) → YYYY-MM-DD | null
    │
    ▼ createRequest() → requests table
    │
    ▼ initWorkflow(id, templateId, buyingChannel) → workflow_instances table
    │
    ▼ Navigate to /requests/{id}
```

---

## Acceptance Criteria

1. Submit wizard with delivery phrase "end of Q3 2026" → request created, no 400, `delivery_date = 2026-09-30`.
2. Select Consulting category → Step 5 shows "procurement-led" buying channel, "Standard Procurement" template.
3. Add catalogue items on the Catalogue page → no compliance step; the basket is placed through the governed checkout, one order per supplier.
4. Confirmed request → appears in All Requests list immediately.

---

## Key Files

- `src/features/requests/new-request/new-request-page.tsx` — orchestrator
- `src/features/requests/new-request/step-*.tsx` — individual steps
- `src/lib/parse-delivery-date.ts` — delivery date normalisation
- `api/chat-intake.ts` — LLM intake extraction
- `src/lib/routing/evaluate-routing-rules.ts` — routing engine
