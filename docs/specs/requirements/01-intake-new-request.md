# FR-01: Intake & New Request Wizard

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `service-owner`, `procurement-manager`, `admin`

---

## Purpose

The New Request wizard is the platform's primary front door — a single intelligent intake channel for any procurement need. It combines AI-assisted classification, natural language service-description generation, compliance checks, and routing preview into the current seven-stage Expert flow, with an adaptive Simple flow for requesters.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR01-01 | service-owner | I can describe what I need in plain English and the system classifies it into the right procurement category | Must |
| FR01-02 | service-owner | I can browse and submit an approved catalogue order through governed checkout; eligible low-value orders may auto-approve | Must |
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
> shown**: Details holds every input, Review holds every conclusion. Simple and
> Expert are one page — `density` picks framing and how much evidence is shown,
> never a step, a gate, a decision, or what is written. FR numbers are unchanged
> so existing references still resolve; the step they sit under has moved.

    Describe → How you'll buy → Details → Review & submit   (→ confirmation)

The **catalogue route** is `Describe → How you'll buy → Details (order)` and has
no Review step: pre-approved, pre-priced items reach no determination, and none
is manufactured so that the step counts match.

### Step 1 — Describe: unified description and specific classification
- FR01-11 · A demand typed on Home arrives as `?q=` and seeds this step; classification runs on it without a further keystroke, and the requester is never asked for the text a second time.
- FR01-12 · User types/pastes a description or uploads a PDF/DOCX. AI-001 extracts title, supplier hint and estimated value; the server returns specific commodity/service-family candidates.
- FR01-13 · If AI-001 is disabled/draft, fallback to local keyword classification, and the screen says which produced the answer.
- FR01-14 · Broad Goods/Services values remain internal routing metadata and are never shown as a requester choice.
- FR01-15 · Show up to three candidates only when one or more probabilities are at least 90%; otherwise show the highest candidate and "None of these". A confirmed choice and alternatives are persisted.
- FR01-10 · *(superseded)* Urgency is captured with the demand detail rather than as a pre-step; RR-010 ("Urgent request fast-track") reads it, and the toggle states what it would change at the moment it is ticked.

### Step 2 — How you'll buy: catalogue, contract, or a new request
- FR01-16 · System checks for an existing active contract covering the demand; the server-side matcher (`api/contract-match.ts`, ADR-0004) confirms coverage and may ask up to three clarifying questions.
- FR01-17 · Catalogue match: a catalogue-eligible category plus a naming-word match offers a direct-purchase path to the item's governed checkout.
- FR01-18 · Contract call-off: a matching framework contract offers the call-off path (skips sourcing/contracting stages).
- FR01-55 · **All three routes render together**, recommendation first and badged, each in requester language (`buyingChannelPlain`) with the category SLA as an indicative timeline. A ruled-out route states its reason **in place** and stays clickable — the previous sequential funnel could hide the correct path behind a wrong match.
- FR01-56 · The buying channel is resolved here by `resolveDemandChannel`, the same function the Review step calls, so the two cannot disagree. The matched words, item scores, contract fit/utilisation and the routing rule id are evidence behind a **"Why this?"** disclosure, Expert density only.
- FR01-57 · When the catalogue and contract sources are unreachable the screen states that neither was checked and nothing was ruled in or out, and offers the full-request route. Never a spinner; never "no match" for a check that never ran.

### Step 3 — Details: everything the requester supplies
- FR01-19 · One question engine asks only the missing fields, with separate Included (`scope`), Excluded (`exclusions`), Deliverables and Acceptance Criteria sections.
- FR01-20 · Each message is processed by `api/chat-intake.ts`; extracted fields populate `formData.serviceDescription`.
- FR01-21 · **Delivery date** extracted as free text → converted to YYYY-MM-DD by `parseDeliveryDate()` (`src/lib/parse-delivery-date.ts`) at submit time.
- FR01-22 · Contextual guidance is optional, anonymised and explicitly applied; deterministic prompts remain available when AI is unavailable.
- FR01-58 · The conversation **opens with an open invitation**, never the first agenda question; the first turn extracts as many slots as it can, and every subsequent question states why it is being asked and what the answer is used for.
- FR01-25 · The risk triage form renders here when triage is required (new/unknown supplier, expired SRA, high data sensitivity).
- FR01-59 · The **mini-IRQ** (0–2 switches: privileged access, critical service) is asked here, beside the demand it refers to, each with its "asked because" rationale — and says so when there is nothing left to ask.
- FR01-60 · Supplier selection happens here, not on the determination: it is an input that *feeds* the determination, so choosing it afterwards would move the conclusion under the reader.
- FR01-61 · A disabled Next names what is outstanding — the missing conversation slots on the chat path, the missing fields on the form paths.

### Step 4 — Review & submit: everything the platform concluded
- FR01-23 · The determination is computed **once per intake** by `useIntakeDetermination` over the pure `evaluateIntakeDetermination`, with stable module-level empty-array defaults; the previous arrangement recomputed it inside the step and mirrored it back into form state through `onUpdate` (the F14 infinite re-render).
- FR01-24 · Policy checks: contract coverage, budget authority, SRA status, competitive quotes.
- FR01-26 · AI-002 (Request Validator) gates the policy checks; when inactive, exactly one failed check names the agent — never an empty list, which reads as "all clear".
- FR01-27 · Displays the matched rule name, buying channel label and approval chain steps (Expert density).
- FR01-62 · The screen is grouped, and each group states what it **means**: How you'll buy · Risk · Routing & approvals · Checks we ran. The channel leads in outcome language and names the **whole downstream process** before the submit button.
- FR01-63 · The risk read is stated as a consequence ("a risk assessment is required — nothing for you to do now"), not as a tier and its drivers. Tier, drivers, per-dimension operational risk and the Smart Assessment projection are Expert-density workings.
- FR01-64 · Anything that **blocks** the request — a blocking screening result, a missing mandatory field — is shown in **both** densities.
- FR01-28 · *(superseded)* There is **no workflow-template picker**. The template is derived from the category and attached silently.
- FR01-65 · The determination is exportable to structured Markdown (Expert density).

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

### Catalogue "Order Now"
- FR01-54 · The command-bar catalogue Order Now path (`handleOrderNow`) applies `parseDeliveryDate()` to the item's delivery date field before calling `createRequest()`, preventing the empty-string DATE column error.

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
3. Add catalogue item → no compliance step shown, direct PO path offered.
4. Confirmed request → appears in All Requests list immediately.

---

## Key Files

- `src/features/requests/new-request/new-request-page.tsx` — orchestrator
- `src/features/requests/new-request/step-*.tsx` — individual steps
- `src/lib/parse-delivery-date.ts` — delivery date normalisation
- `api/chat-intake.ts` — LLM intake extraction
- `src/lib/routing/evaluate-routing-rules.ts` — routing engine
