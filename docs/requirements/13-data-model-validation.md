# FR-13: Data Model & Validation Rules

**Version:** 1.0 · **Date:** June 2026

---

## Purpose

This document is the authoritative reference for all Supabase tables, key field constraints, enum values, and validation rules applied at the application layer.

---

## Core Entities

### requests
| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| id | text PK | `REQ-YYYY-NNNN` format | Generated client-side |
| title | text | NOT NULL | |
| description | text | NOT NULL | Derived from SOW narrative or businessJustification |
| category | text | NOT NULL | From `procurement_categories.id` |
| status | text | enum RequestStatus | See §2 |
| priority | text | low/medium/high/urgent | |
| value | numeric | NOT NULL | EUR default |
| delivery_date | date | nullable | Must be YYYY-MM-DD; `parseDeliveryDate()` normalises freetext |
| buying_channel | text | NOT NULL | From `buying_channels` / KNOWN_CHANNELS |
| days_in_stage | int | NOT NULL DEFAULT 0 | |
| is_overdue | boolean | NOT NULL DEFAULT false | |
| refer_back_count | int | NOT NULL DEFAULT 0 | |

### approval_entries
| Field | Type | Constraint |
|-------|------|-----------|
| id | uuid PK | |
| request_id | text FK → requests | NOT NULL |
| approver_id | text FK → users | NOT NULL |
| status | text | pending/approved/rejected/delegated/info-requested |
| responded_at | timestamptz | null until actioned |
| chain_id | text FK → approval_chains | nullable |
| step_order | int | |

### workflow_instances
| Field | Type | Constraint |
|-------|------|-----------|
| id | text PK | UUID |
| request_id | text FK → requests | NOT NULL, CASCADE DELETE |
| template_id | text | |
| current_node_ids | jsonb | array of node id strings |
| status | text | running/suspended/completed/error |
| variables | jsonb | |

### goods_receipts
| Field | Type | Constraint |
|-------|------|-----------|
| id | text PK | UUID |
| po_id | text FK → purchase_orders | NOT NULL, CASCADE DELETE |
| received_by | text | NOT NULL |
| line_items | jsonb | `[{ description, quantity, unitPrice, received }]` |
| status | text | complete/partial |

---

## Status Enums

### RequestStatus
`draft` | `intake` | `validation` | `approval` | `sourcing` | `contracting` | `po` | `receipt` | `invoice` | `payment` | `completed` | `cancelled` | `referred-back`

### BuyingChannel (extensible via admin)
`procurement-led` | `business-led` | `direct-po` | `framework-call-off` | `catalogue`
**KNOWN_CHANNELS** const array for compile-time hints; type is `string` for admin extensibility.

### RequestCategory (extensible via admin)
`goods` | `services` | `software` | `consulting` | `contingent-labour` | `contract-renewal` | `supplier-onboarding` | `catalogue`
**KNOWN_CATEGORIES** const array; type is `string`.

---

## Validation Rules (Application Layer)

| Entity | Field | Rule |
|--------|-------|------|
| Request | delivery_date | `parseDeliveryDate()` → YYYY-MM-DD or null (never raw string) |
| Request | value | > 0 |
| Request | title | non-empty |
| Invoice | amount | > 0 |
| ProcurementCategory | id | lowercase, kebab-case, unique |
| SlaTarget | days | 1–90 |
| SourcingEvent | type | RFI/RFP/RFQ |
| MatchTolerance | matchTolerancePct | 0–20 |

---

## All Supabase Tables (35)

requests, stage_history, comments, comment_reads, approval_entries, audit_entries, users, user_preferences, suppliers, contracts, purchase_orders, invoices, notifications, routing_rules, workflow_templates, workflow_step_details, workflow_instances, risk_assessments, ai_agents, ai_conversations, knowledge_base, chat_feedback, form_templates, form_submissions, intake_compliance_records, compliance_reports, catalogue_items, service_descriptions, system_integrations, kpi_data, approval_chains, sla_targets, procurement_categories, goods_receipts, sourcing_events, sourcing_responses, tickets

---

## Schema Source

`supabase/schema.sql` — kept in sync with all migrations. Run in SQL Editor to recreate all tables.
