# FR-10: Admin Configuration

**Version:** 1.0 · **Date:** June 2026 · **Roles:** `admin` only

---

## Purpose

Admin is the platform's control plane — all configuration that changes platform behaviour without code changes. This document covers all 14+ admin pages.

---

## Admin Sections

### Taxonomy & Vocabulary

FR10-01 · **Categories** (`/admin/categories`): full CRUD on `procurement_categories` table. Fields: id (slug), label, description, timeline_days, sort_order, active. Changes visible in New Request Step 1 immediately.

FR10-02 · **SLA Targets** (`/admin/sla-targets`): set days per stage (default channel). Changes propagate to bottleneck chart, stuck requests, timeline view — all read `useSlaTargets()`.

FR10-03 · (Future) **Buying Channels** (`/admin/channels`): `buying_channels` table — admin-managed channel definitions.

FR10-04 · (Future) **Stage Sequences** (`/admin/stage-sequences`): per-channel stage order configurable without code changes.

---

### Policies & Routing

FR10-10 · **Routing Rules** (`/admin/rules`): condition/action pairs that map (category, value, urgency, supplier) → buying channel + approval chain. Wired to intake (wizard Step 5 preview + compliance step). Match count shown per rule.

FR10-11 · **Approval Chains** (`/admin/approvals`): CRUD on `approval_chains` table. Each chain has steps with role labels. Save persists to Supabase; `generateApprovalEntries` reads chains by id.

FR10-12 · **Form Builder** (`/admin/forms`): create/edit form templates (8 built-in: risk triage, IT security, etc.). Form fields (11 types), conditional logic. Forms are triggered by workflow stage nodes.

FR10-13 · **Policy Management** (`/admin/policies`): policy document viewer with structured threshold blocks (display-only; future: editable thresholds feeding routing engine).

---

### Automation

FR10-20 · **Workflow Designer** (`/admin/workflows`): visual React Flow graph editor. Templates persist to `workflow_templates` table. Nodes: start, stage, decision, parallel, integration, error, end. The workflow engine reads these templates at runtime.

FR10-21 · **AI Agent Configuration** (`/admin/agents`): 6 agents with status (active/draft/disabled), accuracy, decisions made, config params (weights, thresholds, input sources). Toggling status changes runtime behaviour: AI-001 gates LLM classification in Step 1; AI-005 gates supplier recommender card.

FR10-22 · Each agent card shows **"Affects:"** badges indicating which product surfaces it powers (from `AGENT_AFFECTS` map in `agent-library.tsx`).

---

### Knowledge & Assistant

FR10-30 · **KB Management** (`/admin/kb`): add/edit/delete `knowledge_base` entries. Tags, source, body. The AI assistant `search_knowledge` tool queries this table.

FR10-31 · **AI Analytics** (`/admin/ai-analytics`): accuracy trends, tool usage, latency per agent.

---

### People & Access

FR10-40 · **User Management** (`/admin/users`): list all users with role, OOO status, delegate. Actions: edit role, reset password (stub), activate/deactivate.

FR10-41 · Route guard: `/admin/*` requires `roles={['admin']}`. Direct URL access by non-admin redirects to `/`.

---

### System

FR10-50 · **System Health** (`/admin/health`): integration status (Ariba, Coupa, Sirion, S4HANA), uptime, error rate, request volume (7d).

FR10-51 · **Audit Log** (`/admin/audit`): full `audit_entries` table — all human, system, AI, and warning events. Filterable by user, type, time.

FR10-52 · **Database Admin** (`/admin/database`): full CRUD on all Supabase tables via admin UI.

---

## Key Files

- `src/features/admin/categories-page.tsx`
- `src/features/admin/sla-targets-page.tsx`
- `src/features/admin/approval-chains-page.tsx`
- `src/features/admin/routing-rules/routing-rules-page.tsx`
- `src/features/admin/workflow-designer/`
- `src/features/admin/ai-agents/`
- `src/features/admin/user-management-page.tsx`
