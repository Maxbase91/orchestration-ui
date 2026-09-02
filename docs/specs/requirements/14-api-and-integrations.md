# FR-14: API & Integrations

**Version:** 1.1 · **Date:** 30 August 2026

---

## Purpose

This document covers the Vercel serverless API endpoints, the AI tool call contract, the workflow action API, and the integration framework (current simulation + future live connector shape).

---

## Serverless Endpoints

Public endpoints remain under `/api/`. The twelve-function Hobby deployment budget is enforced by
keeping low-volume domain handlers in `src/server/api/` and routing them through the explicit
allowlisted `api/[...route].ts` dispatcher; this does not change any browser URL.

| Handler / public path | Method | Purpose |
|------|--------|---------|
| `api/chat.ts` | POST | AI assistant — tool-calling loop, KB search, object lookup, action proposal |
| `api/chat-intake.ts` | POST | Request intake — NLU extraction (title, category, value, delivery date) |
| `api/ai.ts` | POST | Context-specific AI responses (approval card, supplier summary, etc.) |
| `api/workflow-action.ts` | POST | Advance request stage, record stage history |
| `api/governed-checkout.ts` | POST | Server-authoritative catalogue/contract checkout; atomic request → PR → lines → conditional internal PO with replay-safe idempotency |
| `src/server/api/intake-submit.ts` | POST `/api/intake-submit` | Validate complete adaptive intake and atomically persist request, structured description, compliance, stage history, workflow instance and initial approval entry; server selects the first actionable stage |
| `src/server/api/contract-match.ts` | POST `/api/contract-match` | Effective-dated, explainable contract-scope matching with clarification questions and safe AI reranking |
| `src/server/api/contract-scope.ts` | GET/POST `/api/contract-scope` | Procurement maintenance of contract coverage versions, deliverables and exclusions |
| `src/server/api/contract-vocabulary.ts` | GET/POST `/api/contract-vocabulary` | Controlled service-family and deliverable vocabulary for scope administration |
| `src/server/api/policy-config.ts` | GET/POST `/api/policy-config` | Load, validate, save, and reset the server-persisted active procurement policy |
| `src/server/api/intake-upload.ts` | POST `/api/intake-upload` | Validate PDF/DOCX uploads, extract text server-side, and return a confirmation-ready attachment |
| `src/server/api/commodity-match.ts` | POST `/api/commodity-match` | Resolve specific commodity/service-family candidates with probability and reasons |
| `api/execute-action.ts` | POST | Execute confirmed AI action (add_watcher, set_delegate, etc.) |
| `api/conversations.ts` | GET/POST | AI conversation history CRUD |
| `api/seed.ts` | POST | Seed demo data (dev only) |
| `api/admin/seed.ts` | POST | Admin seed data |
| `api/_llm.ts` | — | Shared Groq/Gemini LLM helpers (not a route) |
| `api/_supabase-admin.ts` | — | Compatibility admin adapter; Neon is active, Supabase is rollback-only (not a route) |

---

## AI Chat Tool Schema

### `search_knowledge`
```json
{ "query": "string" }
```
Searches `knowledge_base` table by keyword scoring. Falls back to hardcoded `knowledgeBase` array.

### `lookup_object`
```json
{ "type": "request|supplier|contract|po|invoice|risk-assessment", "identifier": "string" }
```
Queries the application-owned Neon store by id or name. Returns typed object or `{ found: false }`.

### `filter_objects`
```json
{ "object_type": "requests|suppliers|contracts|purchase_orders|invoices", "filters": "JSON string", "limit": 1-10 }
```

### `propose_action`
```json
{ "action_type": "add_watcher|set_delegate|set_ooo|reassign_request|...", "params": "JSON string", "read_back": "string" }
```
Returns a `ConfirmTurn` to the UI; execution requires user confirmation.

### `create_ticket`, `start_demand`, `remember_preference`
See `api/chat.ts` TOOLS array for full schemas.

---

## Workflow Action API

`POST /api/workflow-action`
```json
{ "requestId": "REQ-...", "action": "approved|rejected|cancelled|...", "newStatus": "sourcing|..." }
```
Updates `requests.status`, inserts to `stage_history`, creates `audit_entries` row.

---

## Integration Framework (Current State)

FR14-10 · System integrations are represented as internal handover/status records in the Neon-backed `system_integrations` table (SAP S/4HANA, SAP Ariba, Coupa, Sirion CLM).
FR14-11 · Integration badges are shown on workflow stage cards as planned/internal handovers.
FR14-12 · External integrations are **deferred to R2** — no real HTTP calls or upstream writes occur in R1. Internal handover records and system-status presentation remain available for simulation.

FR14-13 · Governed checkout accepts the existing client intent but reloads all governance records and policy from Neon. A deterministic requisition fingerprint makes a matching idempotency-key retry return the existing aggregate; a conflicting payload returns HTTP 409. Request, requisition, lines and any permitted internal PO are committed in one transaction.

FR14-14 · `procurement_policy_configs` is the server-owned singleton policy record. Admin saves validate the complete `PolicyConfig` before persistence; missing/unavailable policy data falls back to shipped defaults without claiming that a failed save succeeded.

FR14-15 · Contract matching is server-authoritative. Rules gate on active/effective scope, exclusions,
supplier, geography, business unit and capacity before weighted scoring. Groq/Gemini may only rerank
eligible candidates. Governed checkout re-runs the matcher and records the selected scope version,
score, reasons, algorithm version and input fingerprint.

FR14-16 · Unified intake is server-bounded: upload extraction, commodity candidates, contextual
guidance and the final workflow transition are explicit endpoints or domain services. The browser
may preview and request confirmation, but cannot independently route a request. Guidance responses
contain only generalized suggestions from approved/completed records or configured templates; raw
historical request text and identifiers are not returned.

### Planned Live Connector Shape (R2)

```
api/integrations/{system}.ts
  ├── sync-vendors(params) → upsert suppliers
  ├── create-po(po) → return external PO number
  ├── sync-invoice(invoice) → return status
  └── health-check() → return { status, latency }
```

FR14-20 · One live connector (SAP S/4HANA) targeted for Phase 3 behind `VITE_SAP_ENABLED=true`.
FR14-21 · All other integrations remain simulated with real adapter shapes for future activation.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEON_DATABASE_URL` | Private Neon connection string (server-only, active R1 provider) |
| `NEON_DATABASE_URL` | The private Neon connection. There is no provider switch; Supabase is decommissioned |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Legacy rollback variables only |
| `GROQ_API_KEY` | Groq LLM API key |
| `GEMINI_API_KEY` | Gemini fallback API key |
| `VITE_ASSISTANT_PROVIDER` | `mock` or `groq` (client-side) |
