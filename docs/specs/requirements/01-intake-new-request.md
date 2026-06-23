# FR-01: Intake & New Request Wizard

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `service-owner`, `procurement-manager`, `admin`

---

## Purpose

The New Request wizard is the platform's primary front door — a single intelligent intake channel for any procurement need. It combines AI-assisted classification, natural language SOW generation, compliance checks, and routing preview into an 8-step guided flow.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR01-01 | service-owner | I can describe what I need in plain English and the system classifies it into the right procurement category | Must |
| FR01-02 | service-owner | I can browse and order from the approved catalogue without going through the full approval workflow | Must |
| FR01-03 | service-owner | I can see exactly which approval path my request will follow before submitting | Must |
| FR01-04 | service-owner | After submitting I can track my request status and see "Track this Request" resolve correctly | Must |
| FR01-05 | procurement-manager | I can see all requests across the organization, not just my own | Must |
| FR01-06 | admin | I can configure which categories appear in Step 1 without a code change | Should |

---

## Wizard Steps

### Step 0 — Pre-check
- FR01-10 · User selects urgency level. Emergency bypass routes directly to a fast-track channel.
- FR01-11 · If category hint is detected from the command bar, it pre-populates Step 1.

### Step 1 — Category Classification
- FR01-12 · User types a free-text description. AI-001 (Category Classifier) classifies → category, title, supplier hint, estimated value, commodity code.
- FR01-13 · If AI-001 is disabled/draft, fallback to local keyword classification.
- FR01-14 · Categories are loaded from `procurement_categories` table (admin-configurable); fallback to `KNOWN_CATEGORIES` if DB empty.
- FR01-15 · User can override the suggested category by selecting a tile manually.

### Step 2 — Pre-check / Contract Match
- FR01-16 · System checks for an existing active contract with the suggested supplier.
- FR01-17 · Catalogue match: if category = 'catalogue' or a catalogue item matches, user is offered a direct-purchase path.
- FR01-18 · Contract call-off: if a matching framework contract exists, user is offered the call-off path (skips sourcing/contracting stages).

### Step 3 — AI Chat Intake
- FR01-19 · Conversational extraction of 9 SOW fields: objective, scope, deliverables, timeline, resources, acceptance criteria, pricing model, location, dependencies.
- FR01-20 · Each message is processed by `api/chat-intake.ts`; extracted fields populate `formData.serviceDescription`.
- FR01-21 · **Delivery date** extracted as free text → converted to YYYY-MM-DD by `parseDeliveryDate()` (`src/lib/parse-delivery-date.ts`) at submit time.

### Step 4 — Compliance
- FR01-22 · Loads `useSuppliers()`, `useMatchingRiskAssessments()`, `useRoutingRules()`, `useWorkflowTemplates()` with stable module-level empty-array defaults to prevent infinite re-render (F14 fix).
- FR01-23 · Policy checks: contract coverage, budget authority, SRA status, competitive quotes.
- FR01-24 · Risk triage form rendered if triage is required (new/unknown supplier, expired SRA, high data sensitivity).
- FR01-25 · AI-002 (Request Validator) gates the policy check display; if disabled, shows a "Validator agent inactive" notice.

### Step 5 — Routing Preview
- FR01-26 · Calls `resolveRouting()` against `routing_rules` table → returns buying channel + approval chain name.
- FR01-27 · Displays the matched rule name, buying channel label, and approval chain steps.
- FR01-28 · Workflow template picker shown; default selects "Standard Procurement" for non-catalogue categories.

### Step 6 — Confirmation
- FR01-29 · `createRequest()` called with all formData fields, `deliveryDate` sanitized.
- FR01-30 · On success: `initWorkflow()` starts the workflow engine instance.
- FR01-31 · On failure: error toast with Supabase error detail; wizard stays on Step 5 (does not advance).
- FR01-32 · "Track this Request" deep-link navigates to `/requests/{id}` which loads via `useRequest(id)`.

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
- FR01-43 · Each of the 9 sections is **editable inline** (textarea); changes propagate to `formData.serviceDescription` immediately on edit.
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
