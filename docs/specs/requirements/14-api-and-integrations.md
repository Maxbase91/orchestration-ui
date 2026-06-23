# FR-14: API & Integrations

**Version:** 1.0 · **Date:** June 2026

---

## Purpose

This document covers the Vercel serverless API endpoints, the AI tool call contract, the workflow action API, and the integration framework (current simulation + future live connector shape).

---

## Serverless Endpoints

All endpoints are in `/api/` and deployed as Vercel serverless functions.

| File | Method | Purpose |
|------|--------|---------|
| `api/chat.ts` | POST | AI assistant — tool-calling loop, KB search, object lookup, action proposal |
| `api/chat-intake.ts` | POST | Request intake — NLU extraction (title, category, value, delivery date) |
| `api/ai.ts` | POST | Context-specific AI responses (approval card, supplier summary, etc.) |
| `api/workflow-action.ts` | POST | Advance request stage, record stage history |
| `api/execute-action.ts` | POST | Execute confirmed AI action (add_watcher, set_delegate, etc.) |
| `api/conversations.ts` | GET/POST | AI conversation history CRUD |
| `api/seed.ts` | POST | Seed demo data (dev only) |
| `api/admin/seed.ts` | POST | Admin seed data |
| `api/_llm.ts` | — | Shared Groq/Gemini LLM helpers (not a route) |
| `api/_supabase-admin.ts` | — | Supabase admin client (not a route) |

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
Queries Supabase by id or name. Returns typed object or `{ found: false }`.

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

FR14-10 · System integrations are displayed in `system_integrations` table (SAP S/4HANA, SAP Ariba, Coupa, Sirion CLM).
FR14-11 · Integration badges shown on workflow stage cards (e.g. "Created in SAP Ariba").
FR14-12 · Integrations are **simulated** — no real HTTP calls. Status shown in System Health as mock data.

### Planned Live Connector Shape (Phase 3)

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
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `GROQ_API_KEY` | Groq LLM API key |
| `GEMINI_API_KEY` | Gemini fallback API key |
| `VITE_ASSISTANT_PROVIDER` | `mock` or `groq` (client-side) |
