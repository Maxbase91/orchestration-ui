# Procurement Orchestration Platform — Design Document

**Version:** 2.0
**Status:** Prototype Complete
**Last Updated:** 30 August 2026

---

## 1. Executive Summary

The Procurement Orchestration Platform is a unified digital workspace that manages the internal procurement lifecycle — from demand intake through sourcing, contracting, purchasing, and payment status. It replaces fragmented tools and manual processes with a single, AI-assisted platform. R1 stores internal records in private Neon; enterprise-system connections are deferred to R2.

This document describes the design of the working R1 application and its simulation surfaces. The app covers 53 routes, 6 switchable simulation roles, and a Neon-backed internal data store; typed fixtures remain available for offline UI tests.

---

## 2. Design Principles

### 2.1 Simplicity First
Every screen follows the principle of progressive disclosure. Users see what matters most — details are one click away but never forced upon them. The sidebar navigation collapses to icons, tables have inline actions, and forms auto-fill from context.

### 2.2 AI as Co-Pilot
AI is woven into every layer — not bolted on as a chatbot. The platform proactively suggests categories, validates compliance, generates service descriptions, detects anomalies, and guides users to the right process. AI features are visually distinct (blue-tinted cards, sparkle icon, confidence badges) so users always know when a recommendation is machine-generated.

### 2.3 System-Aware Orchestration
Procurement spans multiple enterprise systems. The platform visualises handovers to SAP Ariba, Coupa Risk, Sirion CLM, and SAP S/4HANA — showing exactly where a request sits across the technology landscape and what response is pending.

### 2.4 Role-Based Experience
Every user sees a tailored view. A business requestor sees a simplified "what do you need?" front door. A procurement manager sees the full orchestration control tower. An admin sees configuration tools. The same data, different lenses.

### 2.5 No-Code Configuration
Procurement rules change. Approval chains shift. New forms are needed. The admin layer lets procurement teams configure routing rules, design workflows, build forms, and manage AI agents — without writing code or filing IT tickets.

---

## 3. User Roles

| Role | Label | Primary Use Cases |
|------|-------|-------------------|
| Requestor / End User | General business user | Submit requests, track progress, browse catalogues, approve |
| Strategic Procurement Manager | Category/sourcing lead | Manage demand pipeline, oversee sourcing, monitor KPIs |
| Vendor Manager | Compliance/validation | Validate requests, assess supplier risk, manage compliance |
| Procurement Operations Lead | Workflow operations | Monitor bottlenecks, reassign work, manage SLAs |
| Supplier (External) | Self-service portal | Onboard, submit invoices, respond to sourcing events, message |
| Admin / Platform Owner | System configuration | Configure rules, workflows, forms, AI agents, manage users |

### 3.1 Role-Based Dashboards

Each role sees a tailored dashboard on login:

**Requestor / End User:**
- Active requests with status badges and click-to-detail
- Actions required count
- Quick actions: New Request, Track Request, Approvals, AI Assistant
- Recent activity feed
- AI contract renewal suggestions

**Strategic Procurement Manager:**
- KPI row: Open Demand, Active Sourcing, Avg Cycle Time, Compliance Rate
- Demand pipeline bar chart by stage
- Team workload chart
- Attention required list (overdue, referred-back)
- AI insights panel

**Vendor Manager:**
- Validation queue with AI pre-validation assessments
- Today's review count
- Recently validated items
- Quick access to Risk & Compliance, Supplier Directory

**Operations Lead:**
- Workflow health KPIs (active, stuck, avg days)
- Bottleneck analysis table sorted by days stuck
- SLA tracker with countdowns
- Unresolved queries
- Reassign/Escalate/Remind actions

**Admin:**
- System health metrics (users, request volume, API status)
- Configuration alerts
- Recent changes audit log
- Quick access to admin tools

---

## 4. Visual Design System

### 4.1 Colour Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Navy 800 | #1B2A4A | Primary brand, sidebar background, headings |
| Medium Blue 500 | #2D5F8A | Interactive elements, info badges, nav icons |
| Amber 500 | #D4782F | Accent, primary action buttons, warnings |
| Surface | #F3F5F9 | Page backgrounds |
| Card | #FFFFFF | Card backgrounds |
| Text Primary | #1E1E1E | Body text |
| Text Secondary | #4A5568 | Supporting text |
| Text Muted | #718096 | Labels, timestamps |
| Success | #2E7D4F | Completed, approved, passed |
| Warning | #D4782F | In progress, pending, approaching SLA |
| Danger | #B5392E | Overdue, rejected, blocked, errors |
| Info | #2D5F8A | Informational badges |

### 4.2 Typography

- **Font family:** Inter (system sans-serif fallback)
- **Headings:** font-semibold, text-gray-900
- **Body:** text-sm (14px), text-gray-700
- **Labels:** text-xs (12px), text-gray-500, uppercase tracking-wider
- **Mono:** font-mono for IDs (REQ-2024-0001, PO-001)

### 4.3 Component Patterns

**Cards:** White background, shadow `0 1px 4px rgba(0,0,0,0.08)`, border-radius 6px. Used for KPIs, content sections, form groups.

**Status Badges:** Rounded pills with semantic background/text colours. 40+ status variants mapped across workflow, contract, PO, invoice, and matching statuses.

**AI Visual Language:**
- Blue-tinted background (`bg-blue-50/70`)
- Left border accent (`border-l-2 border-blue-400`)
- Sparkle icon (Sparkles from lucide-react)
- "AI-generated" label
- Confidence badge (Low/Medium/High or percentage)
- "Why this suggestion?" expandable explanation
- Accept/Dismiss action buttons

### 4.4 Layout

- **Sidebar:** 260px expanded / 64px collapsed, navy background, white text. Collapsible with smooth transition. Groups separated by uppercase labels. Active item highlighted with blue-500/20.
- **Top bar:** 56px height, white background, border-bottom. Contains breadcrumbs (left), global search, notification bell with badge, role switcher (right).
- **Content area:** `bg-surface`, padded, scrollable.
- **Supplier Portal:** Distinct layout with horizontal tab navigation, amber-branded header.

### 4.5 Icons

Lucide React icon library. Outlined style throughout. 60+ icons mapped to navigation items, actions, and status indicators.

---

## 5. Information Architecture

### 5.1 Navigation Structure

```
HOME (all roles)

WORK
  Requests → My Requests, All Requests, New Request
  Approvals → My Approvals, Delegation
  Tasks → My Tasks, Team Tasks

ORCHESTRATION
  Workflows → Active Workflows, Workflow Monitor, Bottlenecks & Alerts
  Pipeline → Demand Pipeline, Sourcing Pipeline

SOURCING
  Events → Active Events, New Event, Templates, Evaluation Centre

SUPPLIERS
  Directory → All Suppliers, Onboarding Pipeline, Risk & Compliance,
              Portal Admin, Messages

CONTRACTS
  Contract Register → Active Contracts, Renewals & Expiries, Templates

PURCHASING
  Purchase Orders → Open POs, Goods Receipt
  Invoices → Invoice Queue, Three-Way Match, Payment Tracker

ANALYTICS
  Dashboards → Spend Overview, Compliance KPIs, Pipeline & Cycle Time,
               Supplier Performance
  Reports → Report Builder, Scheduled Reports, Exports

ADMIN (admin only)
  Routing Rules, Form Builder, Approval Chains, Workflow Designer,
  AI Agent Configuration, Knowledge Base, User Management,
  System Health, Audit Log

HELP
  AI Assistant, Knowledge Base, Contact Support
```

Navigation items are filtered by role — each role sees only what's relevant.

### 5.2 Screen Inventory

| Module | Screens | Key Patterns |
|--------|---------|--------------|
| Dashboard | 5 role views | KPI cards, charts, action lists |
| Requests | 10 (the conversation, the Channel page, detail, lists) | Conversation with a live summary panel, tabbed detail, data tables |
| Workflows | 6 (kanban, table, timeline, monitor) | View toggle, heatmap; the board is view-only |
| Approvals | 3 (queue, delegation, detail) | Card-based queue, one-click approve |
| Tasks | 2 (my, team) | Priority-sorted tables |
| Pipelines | 2 (demand, sourcing) | Funnel charts, grouped tables |
| Sourcing | 5 (list, detail, new, eval, templates) | Scoring matrix, Q&A board |
| Suppliers | 14 (directory, profile, portal, admin) | Card grid, 7-tab profile, portal layout |
| Contracts | 4 (register, detail, renewals, templates) | Lifecycle tracking, financial charts |
| Purchasing | 6 (PO, invoice, receipt, match, payment) | Three-way match, process steppers |
| Analytics | 7 (dashboards, builder, reports, exports) | Recharts, drag-and-drop builder |
| Admin | 9 (rules, forms, chains, designer, agents) | 3-panel editors, visual canvas |
| Platform | 6 (notifications, AI chat, settings, help) | Chat overlay, FAQ, forms |
| **Total** | **~55 screens** | |

### 5.3 Request Detail — Content Ownership

The request-detail page (header + 7 tabs) had accumulated real duplication: compliance
content rendered on its own tab *and* a second time inside every Workflow stage card;
documents shown as a dedicated tab *and* again per-stage; two independent comment
systems stacked in one stage card; a "latest document" chip in the header repeating
the whole Documents tab. Each was confirmed by tracing the actual hooks/components,
not assumed — see `tasks/todo.md` (2026-08-29) for the evidence trail. The fix is a
rule, not a one-off cleanup: **one topic, one home**. Anything new added to this page
should be placed per this table, not wherever seems locally convenient.

| Owns | Lives only in | Notes |
|---|---|---|
| Identity, current status/priority/SLA, primary actions, the 11-stage timeline | **Header** (`request-header.tsx` + `LifecycleStepper`) | Persists across every tab. Does **not** repeat any tab's content — the header used to duplicate the newest document; removed. |
| The request's own facts (category, value, supplier, channel, dates), AI summary, the Service Description / SOW | **Overview** | The SOW summary is intentionally also shown per relevant Workflow stage (`step-detail-card.tsx`) — that one repeat is deliberate, not drift. |
| All risk/compliance/policy content: front-door determination, intake compliance summary, duplicate check, reused risk assessments, risk flags, the full compliance report, and the linked supplier's own risk/SRA/screening status | **Compliance** | Single home for every risk signal about this request, including the supplier's — Related no longer carries a risk card. |
| Per-stage process detail only: handler, decision, event banners, duration/SLA, system integration, forms, and the stage-scoped comment thread (real comments merged with any historical entries for that stage) | **Workflow** | Does not repeat the header's timeline, Compliance's content, or Documents' list. One comment thread per stage, not two. |
| The approval chain and each approval's status/actions | **Approvals** | |
| The full documents list | **Documents** | Sole home — no per-stage copy in Workflow. |
| The unified chronological feed (comments, stage events, audit, notifications) | **Activity** | |
| Linked records only: contract, PO, sourcing events, other requests/contracts with the same supplier | **Related** | Purely linkage — no risk/compliance content (moved to Compliance). |

---

## 6. Core User Flows

### 6.1 New Request — Intelligent Intake

The single front door for all procurement needs, as the Intake Prototype draws
it (Door 1, 26 September 2026): a **conversation** that ends on "Buying channel
confirmed", then the **Channel page**, then the confirmation. The requirement
detail is FR-01 (`docs/specs/requirements/01-intake-new-request.md`).

**The conversation page** — two columns that fill the window and scroll inside
it, ending above the floating assistant button.

- **Header:** "New request" and the three phases — *1 · What you need*, *2 · How
  it is bought*, *3 · What it needs* — the current one in ink, the ones before it
  in ink-2.
- **Left — the conversation:** a status bar ("Procurement assistant · checking
  the catalogue and contracts"); the transcript, with a phase label where each
  phase begins; one reply box with **Attach a document** and **Send**. Assistant
  turns are cards on the left, the requester's turns filled accent bubbles on the
  right. A question with a reason carries "Asked because …" beneath it, an
  example "For example: …". A turn answered with buttons keeps them, disabled,
  so the history reads as it happened; a Yes/No governance question disables the
  reply box. Offers — a catalogue item, a contract, the supplier question — are
  cards with an eyebrow; "Buying channel confirmed" is the green card that ends
  it, with **See how it will be bought** and "Nothing is submitted yet." Once the
  conversation reaches the supplier, the middle of the description folds behind
  "Show N earlier answers" — the answers are all on the right.
- **Right — Your request (420px):** "N of M known" with a meter (accent, green
  at M of M); a legend of four dots — from you, derived, drafted — check it,
  still to come; the rows grouped Channel · Who and where · What (or The
  call-off) · Supplier · Service description, each a dot, a label, a one-line
  value and — for an input — a pencil. Clicking an input opens its editor in
  place (text, amount, date, a picker, a directory search), with where the value
  came from and "the assistant uses your edit from here on". The executive
  summary sits beneath, with its quality score.

**The Channel page** — "Back to the conversation | Your buying channel", then
two columns (400px on the right): the navy band with the channel's headline, the
value, the stages that apply and the stage targets; *Step by step*, every stage
of the template with its tag, purpose, owner and target days; and, on the right,
*What you are submitting* and the *Checks*, with the workings collapsed beneath.
The footer carries Back, Save as draft and Submit, with a note saying where the
request goes first and who owns it.

### 6.2 Request Lifecycle

A request progresses through up to 10 stages:

```
Intake → Validation → Approval → Sourcing → Contracting → PO → Receipt → Invoice → Payment → Completed
```

The Request Detail page provides full visibility across 8 tabs:

| Tab | Content |
|-----|---------|
| Overview | Request details + AI summary |
| Compliance | Buying channel reasoning, SRA check, policy checks, risk flags, PR compliance report |
| Workflow | Interactive lifecycle stepper + expandable step detail cards with handler, decision, system integration, forms, documents, comments, SLA |
| Comments | Threaded discussion with internal/external visibility |
| Approvals | Approval chain, status, remind/escalate actions |
| Documents | Uploaded files with AI document reader |
| Related | Linked contracts, POs, invoices, supplier profile |
| Audit | Immutable event log, filterable, exportable |

### 6.3 Workflow Orchestration

The control tower for procurement operations. Three views of active workflows:

**Kanban Board:** 9 columns (one per stage), view-only — a card is a button that opens its request, and nothing on the board moves a stage (2026-09-26). Cards show ID, title, value, days in stage, owner, priority, AI-reviewed badge, active system integration status. SLA-based border colouring (green/amber/red).

**Table View:** Full sortable/filterable table with all request fields plus System column showing active external system integration.

**Timeline View:** Gantt-style horizontal bars showing time spent in each stage. Highlights bottlenecks where requests spent disproportionately long.

**Workflow Monitor:** Bottleneck dashboard with horizontal bar chart (avg days per stage vs SLA target), stuck requests table, heatmap (stages × weeks), AI bottleneck analysis with actionable insights.

### 6.4 Supplier Portal (External)

Separate layout for supplier self-service:
- Dashboard with action items and onboarding progress
- Profile management (company details, contacts, bank info)
- 6-step onboarding wizard
- Sourcing event responses
- Invoice submission and status tracking
- Document library with expiry alerts
- Secure messaging with procurement team

---

## 7. AI Capabilities

### 7.1 AI Agents

| Agent | Type | Function | Accuracy |
|-------|------|----------|----------|
| Category Classifier | Classification | Auto-classifies requests, assigns commodity codes | 94.2% |
| Request Validator | Validation | Completeness, policy compliance, duplicate detection | 91.8% |
| Document Extractor | Extraction | OCR/NLP from invoices, contracts, quotes | 89.5% |
| Spend Anomaly Detector | Anomaly Detection | Spend spikes, off-contract, duplicates | 87.3% |
| Supplier Recommender | Recommendation | Optimal supplier scoring (pilot) | 78.6% |
| PR Compliance Reviewer | Validation | Pre-PO compliance checks across 6 categories | 96.1% |

### 7.2 AI-Powered Features

**Intake Intelligence:**
- Natural language category detection from free text
- Buying channel and commodity code auto-suggestion
- AI Service Description Generator (guided Q&A → professional scope)
- Supplier context enrichment (show existing contracts, risk rating, spend)

**Compliance Automation:**
- Policy checks on the Channel page (the Request Validator, AI-002 — rules on Decisioning thresholds): a failed one is a check, every one is in the workings; with the validator off the page says they did not run
- Risk triage: whether a supplier risk assessment is needed, derived at intake and stated on the Channel page as needed / reused / not needed
- (The PR Compliance Reviewer, AI-006, was removed on 2026-09-25 with its 14 stored reports: its sanctions, contract-coverage, SRA and benchmark checks were recorded as passes without running.)

**Operational Intelligence:**
- Bottleneck analysis: identifies which stage, who, and why
- Workload prediction: queue clearance estimates
- SLA breach prediction and proactive alerts
- Invoice anomaly detection (amount vs PO variance)

**AI Assistant (Chat):**
- Context-aware floating panel accessible from any screen
- 62 keyword-triggered response patterns across 5 contexts
- Actionable navigation links that close the chat and navigate to the relevant page
- Suggested action chips
- Covers: request creation, tracking, approvals, suppliers, contracts, invoices, spend, analytics, workflows, settings

### 7.3 AI Visual Language

All AI features share a consistent visual treatment:
- Blue-tinted card (`bg-blue-50/70` + `border-l-2 border-blue-400`)
- Sparkle icon in top-left
- "AI-generated" label
- Confidence badge (percentage or Low/Medium/High)
- "Why this suggestion?" expandable explanation
- Accept/Dismiss or Override controls
- Users can always override AI decisions with one click

---

## 8. System Integrations

The platform orchestrates work across enterprise systems and visualises handover status at every stage.

### 8.1 Integration Mapping

| Workflow Stage | External System | Purpose |
|----------------|----------------|---------|
| Validation | Coupa Risk Assess | Supplier risk assessment and screening |
| Sourcing | SAP Ariba | RFx creation, bid collection, supplier responses |
| Contracting | Sirion CLM | Contract drafting, review, execution, storage |
| Purchase Order | SAP S/4HANA | PO creation, goods receipt, financial posting |

### 8.2 Integration Status Tracking

Each handover has a lifecycle: Pending Handover → Submitted → Awaiting Response → Processing → Completed (or Error/Timeout).

**Visibility points:**
- **Process stepper:** Coloured badge below the relevant step (e.g., "Sirion CLM — Awaiting response")
- **Kanban cards:** Compact badge (e.g., "⏳ Awaiting Ariba")
- **Table view:** System column with coloured badge
- **Request detail → Workflow tab:** Full System Integration Timeline with timestamps, reference IDs, durations
- **Step detail cards:** System involvement section showing reference ID, status, and detail

### 8.3 System Badge Colours

| System | Colour |
|--------|--------|
| SAP Ariba | Blue |
| Coupa Risk Assess | Purple |
| Sirion CLM | Teal |
| SAP S/4HANA | Amber |

---

## 9. Configurable Forms

Forms are a first-class concept — admin-configurable, pre-populated from context, and integrated at both intake and workflow stages.

### 9.1 Form Templates

5 templates across 3 categories, each attached to the workflow stage whose evidence it collects:

**Risk** (risk stage):
- Full Risk Questionnaire (13 fields) — comprehensive supplier risk assessment
- IT Security Assessment (10 fields, software only) — data classification, hosting, encryption, access controls

**Procurement:**
- Vendor Onboarding Form (10 fields, onboarding stage) — company details, tax, banking, contacts
- Contract Intake Form (10 fields, contracting stage) — contract type, terms, obligations, SLAs

**Compliance:**
- Budget Approval Form (7 fields, approval stage) — budget code, GL account, cost allocation, manager sign-off

Risk Assessment Triage, Goods Receipt Confirmation and Change Request were removed on 2026-09-25 with their seeded submissions: none ever rendered (the intake triage and the goods receipt do their jobs; Change Request was a draft on seven stages).

### 9.2 Field Types

text, textarea, number, select, multi-select, radio, checkbox, date, file-upload, separator (section header), info-text (read-only guidance)

### 9.3 Pre-Population

Fields can be configured to auto-fill from request context: supplier name, estimated value, category, commodity code, cost centre, SRA status, PO reference. Reduces manual entry and ensures consistency.

### 9.4 Admin Form Builder

Three-panel editor:
- **Left:** Form list grouped by category with status badges and field counts
- **Centre:** Form editor — name, description, status, trigger stages, conditions, field management (add/remove/reorder)
- **Right:** Field configuration (label, type, options, validation, pre-populate source) + live preview

### 9.5 Integration Points

- **During workflow steps:** Completed forms shown in step detail cards. Active steps show "Fill Out Form" button with inline DynamicForm
- **Workflow step details:** Forms completed, fields filled, timestamps recorded

---

## 10. Analytics & Reporting

### 10.1 Dashboards

**Spend Overview:** Monthly spend bar chart, category treemap, top 20 suppliers, managed vs unmanaged donut, contract coverage donut.

**Compliance KPIs:** 6 large KPI cards — Policy Breaches, First Time Right Rate, Classification Accuracy, SRA Coverage, Screening Duplication, Avg Cycle Time. Each with sparkline trend, drill-down capability.

**Pipeline & Cycle Time:** Funnel visualisation (Intake → PO with conversion rates), cycle time distribution by stage, throughput line chart, ageing analysis.

**Supplier Performance:** Top/bottom performers, performance by category bar chart, risk vs spend matrix.

### 10.2 Report Builder

Drag-and-drop report creation: data sources sidebar → canvas with configurable chart widgets → chart type selector (bar, line, pie, table, scatter) → export (PDF, Excel, CSV).

### 10.3 Scheduled Reports & Exports

5 pre-configured scheduled reports with frequency, recipient, and enable/disable toggles. Export page with data type, date range, and format selection.

---

## 11. Admin Configuration

### 11.1 Routing Rules Engine

Three-panel visual editor:
- **Rule list:** Grouped by category, status badge, match count, drag-to-reorder
- **Rule editor:** IF [conditions] THEN [actions] with field/operator/value cards, AND/OR logic, buying channel and approval chain selection, auto-generated plain-English description
- **Test panel:** Enter sample parameters, see which rule fires, test all rules for coverage analysis, highlight dead rules

### 11.2 Workflow Designer

Full visual canvas powered by React Flow:
- **Node palette:** 10 node types — Start, End, User Task, Approval, System Action, AI Agent, Decision/Gateway, Notification, Timer/Wait, Sub-workflow
- **Canvas:** Zoom, pan, minimap, snap-to-grid, drag-from-palette, click to configure
- **Node configuration:** Type-specific settings (approver, AI agent, conditions, timeouts, escalation)
- **Template library:** 4 pre-built workflow templates
- **Simulation:** Step-through execution path with dead path and infinite loop detection

### 11.3 AI Agent Configuration

- Agent library table with accuracy, decision count, status
- Type-specific configuration (classification taxonomy, validation rules, extraction fields, confidence thresholds)
- Test panel with sample input and response preview
- Performance dashboard with accuracy trend, override rate, common corrections

### 11.4 Approval Chains

4 pre-built chains (Standard, Fast-Track, VP-Level, Board-Level) with visual step display, inline editing, threshold configuration, and routing rule cross-references.

### 11.5 Policy Management (removed)

Removed on 2026-09-25 — a static copy of the policy text. Policy text is maintained in the Knowledge base.

### 11.6 User Management

Full user table (12 users) with role badges, department, active/OOO status, last login, role editing, password reset, and deactivation.

### 11.7 System Health

Integration status grid (SAP, Coupa Risk, Sirion, Email — all with uptime), request volume chart, system metrics (sessions, response time, error rate, uptime), and recent error log.

---

## 12. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Build | Vite 6.x | Fast SPA bundler |
| Framework | React 19 + TypeScript | UI framework with type safety |
| Routing | React Router 7 | Nested layouts, role-based guards |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| Components | shadcn/ui (20 components) | Accessible UI primitives |
| Charts | Recharts | Bar, line, pie, area, sparkline charts |
| Drag & Drop | @dnd-kit | Dashboard customisation (widget order) |
| Workflow Canvas | @xyflow/react (React Flow) | Visual workflow designer |
| State | Zustand | Lightweight store per domain |
| Icons | lucide-react (60+ icons) | Consistent outlined icon set |
| Forms | React Hook Form + Zod | Wizard forms, validation |
| Dates | date-fns | Formatting, relative time |
| Notifications | sonner | Toast notifications |
| Deployment | Vercel | Static SPA hosting |

### 12.1 Architecture

```
src/
├── config/          Theme, navigation, roles
├── data/            22 mock data files (typed TypeScript)
├── stores/          Zustand stores (auth, UI)
├── hooks/           Custom hooks (role, breadcrumbs, AI)
├── lib/             Utilities, formatters, mock AI engine
├── components/
│   ├── ui/          20 shadcn/ui primitives
│   ├── layout/      8 layout components (shell, sidebar, topbar)
│   ├── shared/      21 reusable components
│   └── charts/      5 chart wrapper components
└── features/        20 feature modules with co-located components
```

### 12.2 Key Patterns

- **Feature modules:** Each feature (requests, workflows, suppliers) is self-contained with its own pages, components, and sub-components
- **Mock data as TypeScript:** Typed arrays with helper functions (e.g., `getRequestById`, `getSuppliersByRisk`), enabling IDE autocomplete and compile-time safety
- **AI simulation:** Keyword-matching engine with 62 response patterns across 5 contexts, confidence scores, auto-fill data, and navigation links
- **Role-based rendering:** Sidebar navigation filtered by role, dashboard switching, route guards

---

## 13. Mock Data Summary

| Entity | Count | Key Variations |
|--------|-------|----------------|
| Procurement Requests | 35 | All statuses, 5 complete lifecycle, 3 overdue, 4 referred-back |
| Suppliers | 23 | 6 countries, mixed risk/onboarding/SRA states, 3-year spend history |
| Contracts | 18 | Active, expiring, expired, draft, under-review |
| Purchase Orders | 13 | Draft through closed, with line items |
| Invoices | 14 | Matched, unmatched, paid, disputed |
| Users | 12 | 2 per role, some OOO with delegates |
| Routing Rules | 12 | By value/category/supplier status |
| Workflow Templates | 4 | Standard, sourcing, onboarding, renewal |
| AI Agents | 6 | 5 active + 1 pilot |
| Form Templates | 8 | 72 total fields across 4 categories |
| Form Submissions | 15 | Completed and in-progress |
| Compliance Reports | 10 | 7 approved, 2 needs-review, 1 rejected |
| System Integrations | 15 | Ariba, Coupa Risk, Sirion, SAP |
| Notifications | 25 | All types, read/unread |
| Comments | 60 | Internal/external, AI-generated |
| KPI Data | 12 months | Monthly aggregates with improving trends |
| AI Responses | 62 | Across intake, chat, approval, supplier, general |
| Stage History | ~100 entries | For all 35 requests |
| Workflow Step Details | Rich data for 10 requests | Handler, decision, system, forms, documents |
| Intake Compliance | 35 records | Buying channel reasoning for all requests |
| Catalogue Items | ~45 | Across 6 sub-catalogues |

---

## 14. Deployment

Static SPA deployed to Vercel. Client-side routing handled by rewrite rule:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Build: `npm run build` → `dist/` (~1.8MB JS, ~97KB CSS). No environment variables, no backend, no API keys required.

Push to `main` branch triggers automatic deployment.

---

## 15. Future Considerations

The following areas are represented in the prototype but would require deeper implementation for production:

- **Backend services:** API layer for data persistence, authentication, and real-time updates
- **Real AI integration:** Replace keyword-matching with LLM-based responses for the AI assistant, classification, and document extraction
- **System connectors:** Live API integration with SAP Ariba, Coupa Risk, Sirion, and SAP S/4HANA
- **Notifications:** WebSocket or SSE for real-time push notifications
- **Audit & compliance:** Immutable audit log with cryptographic verification
- **Multi-language:** i18n framework for internationalisation
- **Accessibility:** WCAG 2.1 AA compliance audit
- **Performance:** Code splitting, lazy loading for route-level chunks
- **Mobile:** Responsive optimisation for tablet/mobile approval workflows
