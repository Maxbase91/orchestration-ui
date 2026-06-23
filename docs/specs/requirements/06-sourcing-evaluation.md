# FR-06: Sourcing & Evaluation

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `procurement-manager`, `vendor-manager`, `admin`

---

## Purpose

Sourcing covers the RFx lifecycle: event creation, supplier invitations, Q&A board, response tracking, weighted scoring, AI-assisted evaluation, and award. Events now persist to Supabase (`sourcing_events` table).

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR06-01 | proc-manager | I can create a sourcing event (RFI/RFP/RFQ) and publish it to invited suppliers | Must |
| FR06-02 | proc-manager | I can track which suppliers have viewed or responded to the event | Must |
| FR06-03 | proc-manager | I can score responses using a configurable weighted matrix | Must |
| FR06-04 | proc-manager | The system suggests an AI-assisted award recommendation | Should |
| FR06-05 | vendor-manager | Saving a draft event persists across reloads | Must |

---

## Event Creation Wizard (5 steps)

FR06-10 · Step 1: Event details (title, category, type, budget range, deadline).
FR06-11 · Step 2: Supplier selection (multi-select from directory, or search).
FR06-12 · Step 3: Requirements (text sections with rich editor).
FR06-13 · Step 4: Evaluation criteria (weighted scoring template).
FR06-14 · Step 5: Review & publish.
FR06-15 · **Publish** calls `createSourcingEvent()` with `status = 'published'` → event appears in list immediately.
FR06-16 · **Save Draft** calls `createSourcingEvent()` with `status = 'draft'` → persists for later editing.

---

## Event List

FR06-20 · `/sourcing` loads from `useSourcingEvents()` (Supabase `sourcing_events` table).
FR06-21 · Draft events listed with 0 suppliers — clicking navigates to detail without 404 (SRC-004 fix).
FR06-22 · Filters: status, type, category.

---

## Event Detail

FR06-30 · Shows supplier response pipeline: Not Viewed → Viewed → Responded.
FR06-31 · Q&A Board: suppliers post questions; internal team answers; visible to all invited suppliers.
FR06-32 · Response Rate: `respondedCount / totalInvited` — guarded against 0-supplier events.
FR06-33 · Dates display `—` if null (draft events have no publish/evaluation/award dates).

---

## Evaluation Centre

FR06-40 · `/sourcing/evaluation` provides a side-by-side scoring matrix.
FR06-41 · Each criterion has a weight (0–100); weights must sum to ≤ 100.
FR06-42 · Scores are entered per supplier per criterion (1–10).
FR06-43 · Weighted score computed: `Σ(score_i × weight_i / 100)`.
FR06-44 · AI-006 (PR Compliance Reviewer) generates a narrative recommendation.
FR06-45 · Award button triggers award→contract/PO handoff (future phase).

---

## Data Model

```
sourcing_events:  id, title, category, type, status, budget, deadline, publish_date, evaluation_date, award_date, owner_id, description

sourcing_responses: id, event_id → sourcing_events, supplier_id, supplier_name, status (not-viewed|viewed|responded), response_date
```

---

## Key Files

- `src/lib/db/sourcing-events.ts`
- `src/lib/db/hooks/use-sourcing-events.ts`
- `src/features/sourcing/event-list-page.tsx`
- `src/features/sourcing/event-detail-page.tsx`
- `src/features/sourcing/new-event-page.tsx`
- `src/features/sourcing/evaluation-centre-page.tsx`
