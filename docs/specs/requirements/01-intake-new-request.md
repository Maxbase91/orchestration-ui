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

## Wizard Steps

### Step 0 — Pre-check
- FR01-10 · User selects urgency level. Emergency bypass routes directly to a fast-track channel.
- FR01-11 · If category hint is detected from the command bar, it pre-populates Step 1.

### Step 1 — Unified description and specific classification
- FR01-12 · User types/pastes a description or uploads a PDF/DOCX. AI-001 extracts title, supplier hint and estimated value; the server returns specific commodity/service-family candidates.
- FR01-13 · If AI-001 is disabled/draft, fallback to local keyword classification.
- FR01-14 · Broad Goods/Services values remain internal routing metadata and are never shown as a requester choice.
- FR01-15 · Show up to three candidates only when one or more probabilities are at least 90%; otherwise show the highest candidate and “None of these”. A confirmed choice and alternatives are persisted.

### Step 2 — Pre-check / Contract Match
- FR01-16 · System checks for an existing active contract with the suggested supplier.
- FR01-17 · Catalogue match: if category = 'catalogue' or a catalogue item matches, user is offered a direct-purchase path.
- FR01-18 · Contract call-off: if a matching framework contract exists, user is offered the call-off path (skips sourcing/contracting stages).

### Step 3 — Adaptive description and clarification
- FR01-19 · One question engine asks only the missing fields, with separate Included (`scope`), Excluded (`exclusions`), Deliverables and Acceptance Criteria sections.
- FR01-20 · Each message is processed by `api/chat-intake.ts`; extracted fields populate `formData.serviceDescription`.
- FR01-21 · **Delivery date** extracted as free text → converted to YYYY-MM-DD by `parseDeliveryDate()` (`src/lib/parse-delivery-date.ts`) at submit time.
- FR01-22 · Contextual guidance is optional, anonymised and explicitly applied; deterministic prompts remain available when AI is unavailable.

### Step 4 — Compliance
- FR01-23 · Loads `useSuppliers()`, `useMatchingRiskAssessments()`, `useRoutingRules()`, `useWorkflowTemplates()` with stable module-level empty-array defaults to prevent infinite re-render (F14 fix).
- FR01-24 · Policy checks: contract coverage, budget authority, SRA status, competitive quotes.
- FR01-25 · Risk triage form rendered if triage is required (new/unknown supplier, expired SRA, high data sensitivity).
- FR01-26 · AI-002 (Request Validator) gates the policy check display; if disabled, shows a "Validator agent inactive" notice.

### Step 5 — Routing Preview
- FR01-26 · Calls `resolveRouting()` against `routing_rules` table → returns buying channel + approval chain name.
- FR01-27 · Displays the matched rule name, buying channel label, and approval chain steps.
- FR01-28 · Workflow template picker shown; default selects "Standard Procurement" for non-catalogue categories.

### Step 6 — Confirmation and automatic stage transition
- FR01-29 · `createRequest()` called with all formData fields, `deliveryDate` sanitized.
- FR01-30 · On success: `initWorkflow()` starts the workflow engine instance.
- FR01-31 · On failure: a clean API/database error is shown without provider internals; the wizard stays on the current step (does not advance). Neon is the active R1 provider.
- FR01-32 · "Track this Request" deep-link navigates to `/requests/{id}` which loads via `useRequest(id)`.
- FR01-33 · A complete submission enters the first actionable workflow stage and creates stage history, owner and SLA; it remains in `intake` only when required information is genuinely missing.

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
- FR01-53 · When the user manually overrides the AI-classified category (clicking a tile), `accepted` and `aiResult` are reset so the override propagates correctly through all subsequent steps.

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
