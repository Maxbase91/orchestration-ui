# FR-10: Admin Configuration

**Version:** 1.0 · **Date:** 30 August 2026 · **Roles:** `admin` only

---

## Purpose

Admin is the platform's control plane — all configuration that changes platform behaviour without code changes. This document covers all 14+ admin pages.

---

## Admin Sections

### Taxonomy & Vocabulary

FR10-01 · **Categories** (`/admin/categories`): full CRUD on `procurement_categories`. Fields: id (slug), label, description (read by the AI classifier's prompt, built on the server from the configured categories), **classifier keywords** (the offline classifier, matched at the start of a word), **order** (the classifier's precedence — the first category whose keywords match wins; goods last as the default), active, catalogue eligibility, supplier tags, commodity codes with keywords and a default code; managers and preferred suppliers on the same row. Removed 2026-09-25: `icon` (never shown) and `timeline_days` (a second "how long" that disagreed with the workflow; durations are the channel template's stage targets). The classifier's regex list and the AI prompt's own category rules, catalogue price list and route list were removed with them.

FR10-02 · **SLA Targets** (`/admin/sla-targets`): **read-only view of template-owned stage SLAs.** The workflow template is the single source — a stage's SLA is its node's `slaDays`, set in the Workflow Designer (`/admin/workflows`). The bottleneck chart, stuck requests and timeline view read `useStageSlas()`, which derives from the templates; `requests.sla_deadline` is computed from the same node by `slaDeadlineFor()`. `sla_targets` is no longer a stage-SLA table — it retains only its `stage='ticket'` rows, which set ticket first-response targets by priority.

FR10-03 · (Future) **Buying Channels** (`/admin/channels`): `buying_channels` table — admin-managed channel definitions.

FR10-04 · (Future) **Stage Sequences** (`/admin/stage-sequences`): per-channel stage order configurable without code changes.

---

### Policies & Routing

FR10-10 · **Routing Rules** (`/admin/rules`): condition/action pairs that map (category, value, urgency, supplier) → buying channel + approval chain. Wired to intake (wizard Step 5 preview + compliance step). Match count shown per rule.

FR10-11 · **Approval Chains** (`/admin/approvals`): CRUD on the Neon-backed `approval_chains` table. Each chain has a value band (literal or `policy:` bounds) and steps whose roles are picked from the **Roles** list on the same page. The rules that name a chain are read from the routing rules (a stored "referenced by" list of names no rule carried was removed, 2026-09-25).

FR10-11a · **Roles** (Approval Chains page, `functional_roles`): which system role acts as each functional role a chain step or workflow stage names (Finance, Legal, VP Procurement, CFO, Board, Supplier Manager, Third-party risk, Vendor management…). It was a constant in code; "Vendor management" had no entry, so its stage had no owner. Budget Owner, Category Manager and Contract Owner resolve from the record first (cost-centre owner, category managers, contract owner); *acts as* decides when the record names nobody — an ownerless Budget Owner step goes to procurement managers. Nobody may approve any step of a request they raised. A role still named somewhere cannot be deleted; a named role nobody configured is flagged.

FR10-12 · **Form Builder** (`/admin/forms`): create/edit form templates (8 built-in: risk triage, IT security, etc.). Form fields (11 types), conditional logic. Forms are triggered by workflow stage nodes.

FR10-13 · ~~Policy Management~~ — removed 2026-09-25. It was a static, display-only third copy of the policy text (it still described a direct PO channel), used by nothing. Policy text lives in the **Knowledge base** (`/admin/kb`), with figures linked to **Decisioning thresholds**.

---

### Automation

FR10-20 · **Workflow Designer** (`/admin/workflows`): visual React Flow graph editor. Templates persist to `workflow_templates` table. Nodes: start, stage, decision, parallel, integration, error, end. The workflow engine reads these templates at runtime.

FR10-21 · **AI Agent Configuration** (`/admin/agents`): 5 agents — AI-001 category classifier, AI-002 request validator, AI-004 spend anomaly checks, AI-005 supplier recommender, AI-007 status answers — each with a status (active/draft/disabled) that switches something real, and a description of what it actually does. Toggling status changes runtime behaviour: AI-001 gates LLM classification in the describe step and the Home box; AI-002 gates the Review step's policy checks (reported as not run when off); AI-004 the Analytics anomaly card; AI-005 the supplier recommendations; AI-007 status answers. Removed 2026-09-25: AI-003 (relabelled a disabled button), AI-006 (wrote compliance reports whose checks were invented passes — the agent, its generator and its 14 stored reports), and the invented accuracy figures, decision counts, random performance charts and canned test results.

FR10-21a · **Status Answers agent** (AI-007, type `status`): answers status questions on Home and in the assistant (browser lookups and `api/chat.ts` `lookup_object` / `filter_objects`). Its configuration (`ai_agents.config`, `lib/assistant/status-config.ts`) lists, per object — requests, approvals, purchase orders, invoices, contracts, suppliers — **every attribute of the data model**, each with the label the chatbot uses, whether it is part of the status answer or answered only when asked for, and who may see it (anyone who can see the record / procurement roles only). An attribute the data gains later appears as *New*, switched off. A **role × object matrix** (None / Own / All) says whose records each role may ask about; *Own* is defined per object (raised, buying for or owning a request; its POs, invoices, linked contracts and supplier; approvals waiting on you). A record the role may not see answers as not found. The test panel asks as any role against live data. Setting the agent to Draft or Disabled switches status answers off.

FR10-22 · Each agent card shows **"Affects:"** badges indicating which product surfaces it powers (from `AGENT_AFFECTS` map in `agent-library.tsx`).

---

### Knowledge & Assistant

FR10-30 · **KB Management** (`/admin/kb`): add/edit/delete `knowledge_base` entries. Tags, source, body. The AI assistant `search_knowledge` tool and the Home box answer policy questions from this table. A governed figure is **referenced, not restated** — `{{policy:<key>}}` (a Decisioning threshold), `{{approval-chains}}`, `{{preferred-suppliers:<category>}}` — and rendered from the live configuration when answered (`lib/procurement/knowledge-links.ts`, one renderer for browser and server). Each entry is marked *Linked to configuration* or *Policy text only*; a reference that names nothing is flagged and cannot be saved. The editor inserts references from a list and previews the entry as a requester reads it.

FR10-31 · **AI Analytics** (`/admin/ai-analytics`): accuracy trends, tool usage, latency per agent.

---

### People & Access

FR10-40 · **User Management** (`/admin/users`): list all users with role, OOO status, delegate. Actions: edit role, reset password (stub), activate/deactivate.

FR10-41 · Route guard: `/admin/*` requires `roles={['admin']}`. Direct URL access by non-admin redirects to `/`.

---

### System

FR10-50 · **System Health** (`/admin/health`): integration status (Ariba, Coupa, Sirion, S4HANA), uptime, error rate, request volume (7d).

FR10-51 · **Audit Log** (`/admin/audit`): full `audit_entries` table — all human, system, AI, and warning events. Filterable by user, type, time.

FR10-52 · **Database Admin** (`/admin/database`): controlled CRUD on application-owned Neon tables via the private API boundary.

---

## Key Files

- `src/features/admin/categories-page.tsx`
- `src/features/admin/sla-targets-page.tsx`
- `src/features/admin/approval-chains-page.tsx`
- `src/features/admin/routing-rules/routing-rules-page.tsx`
- `src/features/admin/workflow-designer/`
- `src/features/admin/ai-agents/`
- `src/features/admin/user-management-page.tsx`
