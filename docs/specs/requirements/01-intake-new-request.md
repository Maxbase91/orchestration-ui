# FR-01: Intake & New Request

**Version:** 1.0 · **Date:** 4 September 2026 · **Roles:** `service-owner`, `procurement-manager`, `admin`

---

## Purpose

New request is the platform's primary front door — a single intelligent intake channel for any procurement need. One conversation classifies the demand, checks the catalogue and the contracts, and asks only what the chosen route still needs, while the request builds beside it; the Channel page then shows how it will be bought, and submits.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR01-01 | service-owner | I can describe what I need in plain English and the system classifies it into the right procurement category | Must |
| FR01-02 | service-owner | I can browse the catalogue and order a basket of approved items through governed checkout; a basket up to the auto-approval threshold (judged on its total) is approved automatically | Must |
| FR01-03 | service-owner | I can see exactly which approval path my request will follow before submitting | Must |
| FR01-04 | service-owner | After submitting I can track my request status and see "Track this Request" resolve correctly | Must |
| FR01-05 | procurement-manager | I can see all requests across the organization, not just my own | Must |
| FR01-06 | admin | I can configure which categories the conversation classifies into without a code change | Should |

---

## The conversation, then the Channel page

> **Updated 26 September 2026.** The wizard — seven steps, then four
> (Describe → How you'll buy → Details → Your buying channel) — is replaced by the
> Intake Prototype's conversation page (`src/features/requests/new-request/conversation/`).
> It asks in the same order and keeps the organising rule — **every question is
> asked before any conclusion is shown**: the conversation holds every input, the
> Channel page every conclusion. There is one page and one view of it. FR numbers
> are unchanged so existing references still resolve; the phase they sit under
> has moved.

    the conversation — 1 What you need · 2 How it is bought · 3 What it needs
      → Buying channel confirmed → the Channel page → submit → confirmation

A **catalogue order** is not placed here: a catalogue offer's **Order it** goes to
the **Catalogue page** with the item in the basket (FR01-60). Pre-approved,
pre-priced items reach no determination, and none is manufactured.

### Across the page
- FR01-73 · **Your request**, beside the conversation, shows every value the request carries with where it came from — *from you*, *derived*, *drafted — check it*, *still to come* — and edits **inputs** in place: the title, the value, dates, who and where, the supplier and the description's sections. What the platform decides — the channel, the category's code, a contract's supplier, a catalogue price — has no editor and changes through the conversation (decided 2026-09-26). An edit is written where the conversation reads it; a call-off edit is held to the rules a typed answer is.
- FR01-74 · **N of M known** counts what the route needs — a new request's key facts, supplier decision, risk answers and required sections; a call-off's details — and the channel is one of them, so it reaches M of M exactly when the channel is confirmed (decided 2026-09-26). A catalogue match is complete as it stands.
- FR01-77 · **One set of required sections.** A service-description section the template's rules make mandatory for this demand (`ConfiguredSection.requiredWhen` — materiality, risk tier, data sensitivity, sourcing type, category, value) makes the question that fills it **asked and required**, whatever that question's own condition says, and the question says why ("the description must cover acceptance criteria for this demand: its materiality is important"). The panel, the Channel page's "N of M required sections" and the record submit writes all read `requiredSectionIds`, so "Buying channel confirmed" cannot appear while the determination would still find an asked-for section missing. A mandatory section no question asks (`asked: false`) is in the same set; generation writes it and the Channel page names it if it is empty (decided 2026-09-26).
- FR01-75 · The transcript is **history**: an answered turn — an offer card included — is kept as it was said, its buttons disabled, and is never rewritten by a later check or edit.
- FR01-76 · The header names the three phases and marks the current one; the assistant's status line says what it is doing. There is no stepper and no Next.

### Phase 1 — What you need
- FR01-11 · A demand typed on Home is first shown as *Understood as — Something to buy* (Door 1's card, like every other outcome), and **Start the request** brings it here as `?q=`: it is the conversation's first message, classified without a further keystroke, and the requester is never asked for it a second time.
- FR01-12 · The requester says what they need, pastes a brief or attaches a PDF/DOCX; before anything is said, the document **is** the description (the turn shows its name), after, it is attached. AI-001 extracts title, supplier hint and estimated value; the server returns specific commodity/service-family candidates. A long brief is titled by its first sentence.
- FR01-13 · If AI-001 is disabled/draft, fallback to local keyword classification, and the turn says which produced the answer.
- FR01-14 · Broad Goods/Services values remain internal routing metadata and are never shown as a requester choice.
- FR01-15 · The reading is one question: "That sounds like *category* — *code*. Is that right?", with up to two other candidates as **It's …** (only candidates above the configured confidence), **None of these codes**, and **describe it again**. A confirmed choice and alternatives are persisted.
- FR01-10 · *(superseded)* Urgency is the requester's to set, as the **Urgent** row in Your request; RR-010 ("Urgent request fast-track") reads it, and the row's editor states what it would change — derived from the live rules, silent when nothing would.

### Phase 2 — How it is bought
- FR01-16 · The conversation checks for an existing active contract covering the demand; the server-side matcher (`api/_domains/contract-match.ts`, ADR-0004) confirms coverage and may ask up to three clarifying questions — the conversation asks its first as "One detail decides it".
- FR01-17 · Catalogue match: a catalogue-eligible category plus a naming-word match offers the item — naming the words it matched on — and **Order it** adds it to the basket on the Catalogue page. A contract that also covers it is offered on the same card.
- FR01-18 · Contract call-off: a matching framework contract is offered with its supplier, end date, ceiling left and the direct call-off limit; **Call it off** skips sourcing/contracting stages.
- FR01-18a · A contract past its **end date** is never offered, whatever its status column says — the governed checkout refuses a call-off against it — and the check names it: "No contract in date — *title* ended *date*". A contract is in force through its end date, in the server matcher and the local preview alike. Alternates are offered only where the matcher is at least medium-confident.
- FR01-55 · The checks are reported in one turn before anything is offered, and each offer is headed in its channel's requester wording — the headline and description on the workflow template that claims the channel, edited in Admin → Workflows (`channelCopy`). A ruled-out route states its reason; when nothing covers the demand it becomes a new request on its own.
- FR01-56 · The buying channel is resolved by `resolveDemandChannel`, the same function the determination behind the Channel page calls, so the two cannot disagree. The routing rule that decided it is named on the right and in the Channel page's workings.
- FR01-57 · When the catalogue and contract sources are unreachable the conversation says that neither was checked and nothing was ruled in or out, and continues as a new request. Never a spinner; never "no match" for a check that never ran.

### Phase 3 — What it needs
- FR01-62 · **A contract call-off** fills what it can from the words and the profile, says how much is left, and asks the rest one at a time — value, dates (a service's start and end), who it is for, the purpose, where it goes, what it is charged to; a choice between configured rows is answered with buttons or a list. A value above the direct call-off limit is refused at the value, with **Raise a new request instead**. The governed decision is built once by `call-off.ts` for the Channel page and the submit.
- FR01-19 · For **a new request**, one question engine asks only the missing fields, with separate Included (`scope`), Excluded (`exclusions`), Deliverables and Acceptance Criteria sections.
- FR01-20 · Each message is processed by `api/chat-intake.ts`; extracted fields populate `formData.serviceDescription`.
- FR01-21 · **Delivery date** extracted as free text → converted to YYYY-MM-DD by `parseDeliveryDate()` (`src/lib/parse-delivery-date.ts`) at submit time.
- FR01-22 · Deterministic prompts remain available when AI is unavailable.
- FR01-58 · The page **opens with an open invitation** ("What do you need? Say it in your own words…"), never an agenda question; the service description then starts from the engine's next question, and every conditional question states why it is being asked and what the answer is used for.
- FR01-25 · *(superseded 2026-09-26)* There is no risk triage form: the triage is derived, and it is stated as a check on the Channel page — *Risk assessment needed* / *reused* / *not needed*, with its reason. The intake copy of the IT Security Assessment (FORM-006) is gone too: it discarded its answers and said "submitted"; the form is filled at the risk stage it is configured for, where it is saved.
- FR01-60 · **The supplier** is asked after the description and before the risk questions — it is an input that *feeds* the determination, and it decides them (a high-risk supplier adds the critical-service question). The category's preferred suppliers are named and, on a sourcing channel, invited; "go to market" is an explicit answer; with AI-005 active its ranking is offered; a supplier outside the preferred list owes a reason, asked in the reply box.
- FR01-59 · The **mini-IRQ** (0–2 questions: privileged access, critical service) is asked **inside the conversation**, after the supplier — as Yes/No choices with the reply box disabled, each carrying its "asked because" rationale. It is never extracted from prose: a governance answer recorded as evidence has to be given by the requester.
- FR01-59a · An answer is **tri-state**. Absent means the question was never put, which is a different fact from "answered no"; the determination reports both in `riskQuestionnaire` and the compliance record carries `risk-question:<id>=yes|no|not-answered`. Both answers used to default to `false`, so a question nobody asked and one answered in the negative produced the same record.
- FR01-59b · An answer to a question the demand **no longer triggers** is ignored. Answer yes to critical-service at a material value, then drop the value, and the question disappears while the answer used to go on forcing materiality to critical.
- FR01-61 · **Buying channel confirmed** (`conversation-rules.ts`) is the one way on to the Channel page. It appears when the conversation is through — the mandatory floor and every triggered risk question, not an empty agenda, so a question it gave up on cannot hold it — the supplier question is answered, a determination exists, and nothing submit would refuse is missing (a need-by date that parses, a cost centre, an override reason); the conversation names each gap and says where to add it.

### The Channel page — Your buying channel: how it will be bought, then submit
The Channel page (Intake Prototype, 2026-09-26) replaced Review & submit, for a new request **and a contract call-off**. It is headed "Your buying channel", with **Back to the conversation** — which returns to the conversation as it was left.
- FR01-23 · The determination is computed **once per intake** by `useIntakeDetermination` over the pure `evaluateIntakeDetermination`, with stable module-level empty-array defaults; the previous arrangement recomputed it inside the step and mirrored it back into form state through `onUpdate` (the F14 infinite re-render). The mirrored form fields are deleted (2026-09-26).
- FR01-67 · The page opens with how this will be bought — the channel template's requester headline and sentence — with the value, the **stages that apply** ("10+ of 11": the + when a stage depends on something not yet known) and the **stage targets** (working days of the stages sure to run).
- FR01-68 · **Step by step** lists every stage of the channel's template in the order the graph reaches them, each with its purpose, owner role and target days. Each is tagged *You are here* (intake), *Applies · why* (when a branch or the entry rule put it there), *If …* (depends on a signal not yet known — "If the supplier is new" while no supplier is chosen) or *Skipped · why* (a branch that did not hold, the entry rule's condition, or "only after" a stage that is skipped). The plan runs the server's landing rule (`firstActionableStage`; `checkoutEntryStage` for a call-off, both with their declared entry conditions) and the engine's own `getNextNodeIds` (`lib/workflow/channel-plan.ts`, `test:channel-plan`).
- FR01-69 · A stage says what the requester does there ("You: …") from its `requesterAction` (Workflow Designer). It is set only where the requester really acts; never on a stage this request skips.
- FR01-70 · Submit says where the request goes first and who owns it ("sends it to Validation (Category Manager)"); an auto-approved call-off says its purchase order is raised straight away.
- FR01-71 · **What you are submitting**: the executive summary with "N of M required sections" and every section on request; the request's facts; who and where; the supplier or who will choose one; and, when the channel sources, **who will be invited** — `sourcingInvites`, the function the sourcing event calls (named, shortlist, every preferred supplier). A call-off's supplier is the contract's, and nobody is invited.
- FR01-24 · **Checks** (`lib/procurement/channel-checks.ts`, `test:channel-checks`), most consequential first: why this channel, in the matched routing rule's own description; a refer-back or change request; supplier screening; contract coverage (a lapsed contract is named); who sourcing invites, or a supplier outside the preferred list; risk; the approvers submit will write; every failed policy check; missing required sections.
- FR01-26 · AI-002 (Request Validator) gates the policy checks. When inactive the determination records one failed check naming the agent — never an empty list — and the page says **policy checks did not run**, in the requester's terms, not the instruction to an administrator the record carries.
- FR01-27 · The approvers are derived as submit derives them: the chain the determination pinned, else the value band, under the governed thresholds (`chainIdFor`), with the category, cost centre, contract and preferred-supplier override (`useApproversOnSubmit`). The Review preview chose its own chain and left out the cost centre, so it could name people submit would not ask. While they load there is no approvals line, never "No approval needed".
- FR01-62a · A contract call-off reaches this page too, from its own "Buying channel confirmed", and Submit is held when its governed decision refuses the call-off, with the reason as a check.
- FR01-63 · **How this was worked out** — collapsed: materiality, inherent and operational risk, approval to source and its gates, contract and sourcing type, every policy check with its result, supplier assessment and the next steps with their deep links. The conclusions are the checks; these are the reasons behind them.
- FR01-64 · Anything that **blocks** the request — a refer-back, a blocking screening result, a call-off the decision refuses — is a check in the page's first view, not behind the disclosure.
- FR01-28 · *(superseded)* There is **no workflow-template picker**. The template is the one that claims the channel, as on submit.
- FR01-65 · The determination is exportable to structured Markdown from the workings.
- FR01-72 · Removed with Review: "Add reviewers / watchers" and "Notes for approvers" (collected and never saved), the routing preview's synthetic risk and onboarding steps and regex-guessed owners, and a "smart assessment" that re-derived contract coverage with its own €25,000 literal.

### Confirmation and automatic stage transition
- FR01-29 · The submit calls `/api/intake-submit`, which commits request, service description, intake compliance, stage history and workflow instance **atomically** with an idempotency key.
- FR01-30 · On success the workflow engine instance starts.
- FR01-31 · On failure a clean API/database error is shown without provider internals; the page stays on the Channel page. Neon is the active R1 provider.
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
- FR01-43 · Each structured section is **editable in place** in Your request (textarea); changes propagate to `formData.serviceDescription` immediately on edit and retain capture provenance.
- FR01-44 · If the endpoint is unavailable the conversation **degrades gracefully** — the captured sections stand — with no user-facing error and no button to retry.
- FR01-45 · The endpoint returns a **quality score (0–100)** and per-section checklist (pass/fail + issue description).
- FR01-46 · The quality badge is shown beside the executive summary in Your request; clicking it lists the checks that failed.
- FR01-47 · Quality rules: acceptance criteria must contain measurable KPIs; deliverables must be a numbered list; timeline must reference phases.
- FR01-48 · LLM unavailable → deterministic mock fallback generates expanded sections from a category template.
- FR01-49 · The full SOW (sections + narrative + quality_score + quality_checks) persists to `service_descriptions` table.
- FR01-50 · The request detail Overview tab shows the SOW quality badge next to the Service Description card title.

### Classifier fixes (June 2026)
- FR01-51 · `api/ai.ts` includes explicit category decision rules with 7 few-shot examples to reduce consulting/services/goods confusion.
- FR01-52 · `localClassify()` expanded with consulting keywords: `operating model`, `TOM`, `change management`, `programme management`, `maturity assessment`.
- FR01-53 · When the requester rejects the inferred commodity family ("None of these codes", or "describe it again"), the correction propagates through everything after it. There is no category tile grid to override — the broad category is never a requester choice (FR01-14).

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

1. Submit a request whose need-by date is given as "end of Q3 2026" → request created, no 400, `delivery_date = 2026-09-30`.
2. A consulting demand → the conversation confirms "New request — Procurement-Led Sourcing", and the Channel page draws WF-001 Standard Procurement's stages.
3. Add catalogue items on the Catalogue page → no compliance step; the basket is placed through the governed checkout, one order per supplier.
4. Confirmed request → appears in All Requests list immediately.

---

## Key Files

- `src/features/requests/new-request/new-request-page.tsx` — orchestrator
- `src/features/requests/new-request/step-*.tsx` — individual steps
- `src/lib/parse-delivery-date.ts` — delivery date normalisation
- `api/chat-intake.ts` — LLM intake extraction
- `src/lib/routing/evaluate-routing-rules.ts` — routing engine
