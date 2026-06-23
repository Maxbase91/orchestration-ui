# FR-00: System Overview, Roles & Permissions

**Version:** 1.0 · **Date:** June 2026 · **Status:** Approved
**App:** Procurement Orchestration Platform (orchestration-ui)

---

## Purpose

This document defines the system overview, the six user roles, and the role-based access control (RBAC) matrix that governs every feature domain. It is the root reference for all other feature requirement documents.

---

## 1. System Overview

The platform is a **procurement orchestration hub** — a single intelligent front door for all spend requests, routing them through configurable workflows, approvals, sourcing, contracting, and payment. It benchmarks against Zip and Oro Labs (orchestration-first) rather than SAP Ariba (suite depth-first).

```
Requestor (any employee)
    │
    ▼ New Request wizard (8 steps)
[Routing Rules Engine] ──► Buying Channel + Approval Chain
    │
    ▼
[Workflow Engine] ──► stage nodes drive: validation, approval, sourcing, PO, receipt, invoice, payment
    │
    ▼
[AI Assistant] ──► Q&A, lookups, propose/confirm/execute actions
```

**Supabase tables:** 35 tables — requests, workflow_instances, approval_entries, approval_chains, contracts, purchase_orders, invoices, goods_receipts, suppliers, sourcing_events, sourcing_responses, compliance_reports, procurement_categories, sla_targets, routing_rules, workflow_templates, form_templates, form_submissions, knowledge_base, ai_agents, users, user_preferences, notifications, audit_entries, stage_history, comments, risk_assessments, catalogue_items, service_descriptions, system_integrations, kpi_data, intake_compliance_records, ai_conversations, chat_feedback, tickets.

---

## 2. Roles

| Role ID | Display Name | Persona |
|---------|-------------|---------|
| `service-owner` | Requestor / End User | Business user who needs to buy something |
| `procurement-manager` | Strategic Procurement Manager | Manages demand pipeline and sourcing strategy |
| `vendor-manager` | Vendor Manager | Validates sourcing requests and supplier compliance |
| `operations-lead` | Procurement Operations Lead | Handles operational queries and workflows |
| `supplier` | Supplier (External) | Self-service supplier portal access only |
| `admin` | Admin / Platform Owner | Configures rules, workflows, taxonomy, and policies |

**Internal roles** (access the main app): all except `supplier`.
**`supplier` role** is redirected to `/portal` on login.

---

## 3. Navigation Visibility Matrix

| Section | `service-owner` | `proc-mgr` | `vendor-mgr` | `ops-lead` | `supplier` | `admin` |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| Home | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Requests (My) | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Requests (All) | — | ✅ | ✅ | ✅ | — | ✅ |
| New Request | ✅ | ✅ | — | — | — | ✅ |
| Approvals | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Tasks | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Workflows | — | ✅ | — | ✅ | — | ✅ |
| Pipeline | — | ✅ | — | ✅ | — | ✅ |
| Sourcing | — | ✅ | ✅ | — | — | ✅ |
| Suppliers | — | ✅ | ✅ | ✅ | — | ✅ |
| Contracts | — | ✅ | — | ✅ | — | ✅ |
| Purchasing | — | ✅ | — | ✅ | — | ✅ |
| Analytics | — | ✅ | — | ✅ | — | ✅ |
| Admin | — | — | — | — | — | ✅ |
| Help | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supplier Portal | — | — | — | — | ✅ | — |

---

## 4. Route Guard Rules

FR00-01 · Every protected route is wrapped with `<RequireRole roles={[...]}>` in `src/App.tsx`. Unauthorized direct URL access redirects to `/`.
FR00-02 · The `supplier` role is redirected from any internal route to `/portal`.
FR00-03 · Non-supplier roles navigating to `/portal/*` are redirected to `/`.
FR00-04 · Route guards use `useAuthStore().currentRole` which persists across reloads via localStorage (`auth` key).

---

## 5. AI Assistant Actions — Role Gating

| Action | Allowed Roles |
|--------|-------------|
| `add_watcher`, `set_delegate`, `set_ooo` | All internal roles |
| `reassign_request`, `raise_payment_escalation`, `request_contract_renewal`, `request_po_change` | `procurement-manager`, `operations-lead`, `admin` |
| `approver_substitution`, `request_risk_reassessment` | `procurement-manager`, `vendor-manager`, `admin` |
| `supplier` role | No actions |

Source: `src/lib/assistant/capabilities/action.ts:ROLE_ALLOWED_ACTIONS`

---

## 6. Demo / Dev Impersonation

FR00-05 · A role switcher is available in the topbar for all users (demo environment only).
FR00-06 · In a production-bound build, the role switcher is replaced by Supabase Auth + SSO; the `switchRole` action becomes admin-only for impersonation.

---

## Dependencies

- All feature docs reference this document for role permissions.
- `src/config/roles.ts` — canonical role definitions.
- `src/config/navigation.ts` — `visibleTo` arrays drive sidebar filtering.
