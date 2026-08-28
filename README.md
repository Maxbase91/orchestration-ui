# Procurement Orchestration Platform — UI Prototype

A full-featured procurement orchestration platform prototype built for stakeholder design workshops. Demonstrates end-to-end procurement workflows, AI-assisted decision making, and system integration handovers across 40+ interactive screens.

**Live demo:** [orchestration-ui-khaki.vercel.app](https://orchestration-ui-khaki.vercel.app)

---

## What This Is

An interactive UI prototype that shows what a modern procurement orchestration platform looks and feels like. All data is mocked client-side — no backend required. Built to let stakeholders react to something tangible before committing to implementation.

### Key Capabilities Demonstrated

- **Intelligent Intake** — AI-assisted request wizard that auto-classifies categories, suggests commodity codes, and runs compliance checks
- **Workflow Orchestration** — Kanban, table, and timeline views of active procurement workflows with bottleneck detection
- **System Integration Handovers** — Visual tracking of requests across SAP Ariba, Coupa Risk, Sirion CLM, and SAP S/4HANA
- **AI Compliance Agent** — Automated PR compliance reviews with detailed check reports before PO creation
- **Supplier 360** — Unified supplier directory with risk, spend, performance, and compliance views
- **Supplier Portal** — Self-service portal for external suppliers (onboarding, invoices, messaging)
- **No-Code Admin** — Visual routing rules engine, drag-and-drop workflow designer, AI agent configuration
- **Analytics** — Spend dashboards, compliance KPIs, pipeline analytics, and a drag-and-drop report builder
- **Support Ticket Inbox** — agent-side queue for tickets raised from Contact Support or the assistant: assign, forward, reply, internal notes, resolve, **priority-based SLAs with breach flags**, references to the requests / POs / suppliers a ticket is about, and the full chat transcript for assistant-raised tickets

---

## Screens

### Core Experience
| Screen | Description |
|--------|-------------|
| Role-Based Dashboards | 5 tailored dashboards (Service Owner, Procurement Manager, Vendor Manager, Operations Lead, Admin) |
| Switchable home designs | The home (`/`) ships in 4 selectable designs — the default Dashboard plus three Apple-style layouts (1a Cupertino · 1b Bento · 1c Editorial), all fully functional (front door, quick actions, live KPIs + demand pipeline). Picked from a top-bar toggle next to the role-switcher; persisted per user |
| New Request Wizard | 7-step intake with a **staged-intake funnel**: free-text entry (no category selection — the path is derived), then a sequential **catalogue → enrich → contract** pre-check (no premature contract assertion). The pre-check makes **one explainable routing decision** (`lib/procurement/intake-routing.ts`) — catalogue order, call-off against an existing contract, or new demand — and says *why*, including why the other routes were ruled out. A category the catalogue cannot fulfil (consulting, services, …) **skips the catalogue stage with the reason shown** rather than being offered unrelated items; all three destinations stay reachable from every stage. Then service description, **risk & assessment**, **determination**, routing, confirmation. The service-description capture is a **dynamic, answer-driven conversation** (next question depends on prior answers, nothing is re-asked — `demand-conversation.ts`). **Requester context** is established up front: the requester's **country is auto-derived from their profile** (read-only) and the **beneficiary defaults to self** with a type-ahead to buy on behalf of someone else. **The wizard explains itself**: every step carries a header panel — what it is for, what it needs from you, what happens after (`step-guidance.ts`) — and the stepper renders each step's description. **Step 1 shows one classification block** (category as the headline, commodity code beneath as the derived specific code; supplier and value labelled *extracted*), not the demand three times over. **The buying channel is shown on the pre-check**, four steps earlier than before, with its indicative timeline and the rule that decided it — resolved by `lib/routing/demand-channel.ts`, the same function the determination calls, so the two cannot drift. Urgency is the one input that can still move it, and the toggle says so as it is ticked. **The conversation finishes**: progress is measured against the questions this demand is actually asked (so it reaches 100%), sections the template marks inferred are shown as such rather than outstanding, conditional questions state why they are being asked, and step 3 will not release until the mandatory service-description floor is met |
| Request Detail | Full lifecycle tracker with 7 tabs (Overview, Workflow, Comments, Approvals, Documents, Related, Audit). Validation, risk, approval, sourcing and contracting show the **service description** and its quality score, so a reviewer sees what they are approving |
| Vendor onboarding | A real conditional stage, not a preview label. **Light onboarding** (supplier record exists and screening has cleared) gates **sourcing** — you cannot invite a supplier that does not exist — and gates **completing the risk assessment**, which hangs off a supplier record. **Full onboarding** gates **contracting** for the awarded supplier only, so paperwork is not demanded up front from vendors who may not win. A supplier named at intake but absent from the directory can be created as a **prospective** record from the wizard |
| Active Workflows | Kanban board (drag-and-drop), sortable table, Gantt timeline — with system integration badges |
| Workflow Monitor | Bottleneck dashboard, stuck requests, SLA tracker, heatmap, AI bottleneck analysis |

### Supplier Management
| Screen | Description |
|--------|-------------|
| Supplier Directory | Card grid and table views with risk ratings, compliance status, spend data |
| Supplier Profile | 7-tab 360 view (Overview, Contracts, Risk, Spend charts, Performance, Documents, Activity) |
| Supplier Portal | External self-service: dashboard, onboarding wizard, invoices, **real sourcing invitations with response submission**, documents, messaging |
| Supplier Messages | Internal messaging threads with suppliers |

### Sourcing & Contracts
| Screen | Description |
|--------|-------------|
| Sourcing Events | DB-backed event register and detail, **raised from a request in the sourcing stage** (`request_id` link, incumbent seeded as the first invitation) and surfaced two-way on the request's Related tab. Q&A board remains a labelled mock |
| Evaluation & Award | Weighted scoring of real supplier responses against the event's criteria, persisted as they are edited; ranking and award gates come from one shared rule so the recommendation and the award cannot disagree. **The award writes the winning supplier back onto the request, closes the event and resumes the workflow** — a half-applied write-back is detected and repairable |
| Sourcing Pipeline | The same live events as the register, arranged by stage (Draft → Published → In Evaluation → Award Pending → Completed) with real invitation counts; rows deep-link into the event |
| Contract Register | Lifecycle management with renewal alerts, obligation tracking, financial comparison |
| Purchase Orders | PO management with goods receipt, AI compliance review |
| Invoice Queue | Invoice management with AI data extraction, three-way match visualizer |

### Admin & Configuration
| Screen | Description |
|--------|-------------|
| Smart Command Bar | Free-text entry on the home page. A demand the **catalogue genuinely serves** opens the catalogue inline for direct ordering; anything else is handed to the assistant or straight into intake. The catalogue decision is `lib/procurement/intake-routing.ts` — the same category-gated, naming-word decision the wizard's pre-check makes, so both entry points agree |
| Routing Rules Engine | 3-panel layout: rule tree, visual IF/THEN editor, test panel. The **editor, the test panel and the runtime share one vocabulary** — every field and operator the editor offers is evaluated in production, and the test panel calls the production evaluator rather than reimplementing it. An **active rule that cannot fire is diagnosed** at the top of the page (unknown field, unsupported operator, malformed `between`, no conditions) instead of silently never matching |
| Decisioning Thresholds | Edit the governed decisioning thresholds (approval/materiality/risk/sourcing/contract); Save applies them to the live front door; live simulation previews a sample demand's outcome |
| Service Description | Configure the service description end to end: the **generation prompt** (guidance, system prompt, temperature, token budget, with a preview of the assembled prompt), the **components asked** at intake (question, example, required, and the condition that shows it), **what is generated** (the detailed sections, which are asked vs inferred, and which compose the compact narrative), and **reuse in later steps** (which sections seed a sourcing event's requirements, plus the default evaluation criteria). Per-category with a `default` fallback; stored in Postgres so the serverless generation and intake routes read the same config Generation is **signal-aware**: the capture-time materiality, inherent risk, data sensitivity and sourcing read (`demand-signals.ts`) is passed to the model, and the template's `requiredWhen` conditions say which sections that read makes mandatory — so a material, competitively-sourced engagement is required to cover scope, deliverables and measurable acceptance criteria while a small order is not. The determination reports any required section still missing rather than regenerating the document behind the requester. |
| Workflow Designer | React Flow canvas with 10 custom node types, drag-from-palette, node configuration, simulation |
| AI Agent Configuration | Agent library, type-specific config forms, test panel, performance dashboard |
| Categories | The demand taxonomy: label, description, icon, timeline, active — and **whether the category can be fulfilled from the catalogue**, which gates the intake funnel's catalogue check |
| Approval Chains | Visual approval chain editor with threshold configuration |
| Policy Management | Procurement policy library with expandable full-text preview |

### Analytics & Platform
| Screen | Description |
|--------|-------------|
| Spend Overview | Bar charts, treemap, top suppliers, managed vs unmanaged, contract coverage |
| Compliance KPIs | Policy breaches, first-time-right rate, classification accuracy, SRA coverage |
| Pipeline & Cycle Time | Funnel visualization, cycle time distribution, throughput, ageing analysis. **"Active Sourcing" counts live sourcing events**, not requests parked in the stage |
| Report Builder | Drag-and-drop report creation with chart type selection |
| Notifications | Grouped feed with type filtering and notification preferences |
| AI Assistant | Floating chat overlay + full-page mode with keyword-triggered responses |
| Ticket Inbox | Agent-only support queue (`/help/inbox`): standing views incl. **Breaching**, SLA badges, headline metrics, filters and search, plus a drawer to **assign, forward, reply, add internal notes and resolve**. Tickets link to requests, POs, suppliers, contracts and invoices; assistant-raised tickets carry the **full conversation transcript** |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Build | Vite |
| Framework | React 19 + TypeScript |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Workflow Canvas | @xyflow/react (React Flow) |
| State | Zustand |
| Icons | lucide-react |
| Deployment | Vercel (static SPA) |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing

Integration tests run as standalone Node scripts under `tests/integration/`:

```bash
npm run test:e2e                  # end-to-end request → approval workflow
npm run test:routing              # routing-rule evaluator
npm run test:routing-rule-integrity # editor ↔ runtime ↔ test-panel parity — every offered field/operator is evaluated, a broken rule is diagnosed
npm run test:intake               # intake sequence
npm run test:connectors           # source-connector layer (registry, query, live-swap seam)
npm run test:preference           # preferred-supplier (PSL) + competitive-sourcing controls
npm run test:materiality          # materiality & criticality determination
npm run test:category-code        # category-code mapping (taxonomy translation)
npm run test:risk-segmentation    # inherent-risk cascade + risk outcome (reuse/amend/change/new)
npm run test:risk-reuse           # structured risk-register reuse model (supplier/scope/data-class/validity)
npm run test:handoff              # downstream handoff / next-steps model (systems, status, deep-links)
npm run test:determination        # contract-type + sourcing-type determination
npm run test:determination-export # exportable determination (structured Markdown)
npm run test:second-contract      # second contract check (frameworks/MSAs vs transactable)
npm run test:sourcing             # sourcing: weights, ranking, award write-back, stage gate, entitlement
npm run test:sow-narrative        # SOW narrative is synthesised from the service description
npm run test:service-description-config # service description config — serialised slots, narrative composition, sourcing seed
npm run test:tickets              # support tickets — entitlement, internal notes, status lifecycle, references
npm run test:ticket-sla           # ticket SLA — targets, due dates, breach/at-risk, waiting-on-user pause
npm run test:approval-to-source   # approval-to-source gate (light vs full pre-sourcing approvals)
npm run test:residual-questions   # criteria-triggered stage-5 residual questions (mini-IRQ deltas)
npm run test:demand-conversation  # dynamic intake — answer-driven next question + carry-forward + branching + conditional rationale
npm run test:intake-guidance      # progress reaches 100%, inferred sections are not outstanding, step-3 floor, per-step guidance copy
npm run test:assistant-intents    # assistant routes procurement demands to intake, not a support ticket
npm run test:operational-risk     # preliminary operational risk assessment (per-dimension screen)
npm run test:classification-eval  # classification eval harness + accuracy baseline (CLS-G1)
npm run test:demand-signals       # capture-time governance read (materiality/risk/sourcing) + config-driven required sections
npm run test:onboarding-stage     # vendor onboarding — light gate (sourcing + risk) and full gate (contracting)
npm run test:intake-routing       # catalogue vs contract vs new demand — category gate, naming-word rule, LLM intent
npm run test:intake-routing-eval  # intake routing eval harness + accuracy baseline
npm run test:referral             # demand disposition — proceed / request-change / refer-back (RTE-06)
npm run test:knowledge            # grounded policy-Q&A retrieval (ranking, citations, low-confidence)
npm run test:policy-config        # central decisioning thresholds (defaults pinned + override resolver)
npm run test:screening            # supplier screening — clear / pending / flagged / unknown + blocking
npm run test:supplier-data        # supplier master-data completeness → remediation handoff (RTE-04)
npm run test:approver-resolution  # approval step role → switchable directory rep (one identity namespace)
npm run test:workflow-steps       # config-driven Routing — template lifecycle + risk/onboarding steps + approval-chain banding
npm run test:admin-editors        # admin config saves
npm run walkthrough               # visual QA harness (Playwright) — drives the front door across scenarios + every tab, screenshots to /tmp/fd (no assertions)
npm run test:ui                   # browser smoke (Playwright) — wizard end-to-end through the determination + config-driven routing steps
npm run test:e2e-ui               # full-app browser sweep — every route × role, captures console/runtime errors
npm run test:service-description-ui # browser smoke — /admin/service-description renders all four config areas
npm run test:intake-guidance-ui   # browser smoke — step-1 single classification block, per-step header panels, the step gate
npm run test:interactions-ui      # interaction E2E — wizard submit, admin save, AI assistant (self-cleaning)
npm run test:home-designs         # alternative home designs (1a/1b/1c) are fully functional + dashboard intact
# …see package.json "test:*" scripts for the full list
```

`test:ui` uses Playwright. First-time setup: `npm install` then `npx playwright install chromium`.
It boots the dev server itself and needs `.env.local` (Supabase creds).

Per the repo's Definition of Done (see `CLAUDE.md`), every change ships with updated tests and docs.

### Role Switching

Use the role switcher dropdown in the top-right corner to switch between:

- **Service Owner** — simplified view focused on requests and actions
- **Procurement Manager** — full orchestration control tower
- **Vendor Manager** — validation queue and compliance focus
- **Operations Lead** — workflow health, bottlenecks, SLA tracking
- **Supplier (External)** — self-service portal with distinct layout
- **Admin** — routing rules, workflow designer, AI agents, system health

---

## Mock Data

The prototype is pre-loaded with realistic mock data:

| Entity | Count |
|--------|-------|
| Procurement Requests | 35 |
| Suppliers | 23 |
| Contracts | 18 |
| Purchase Orders | 13 |
| Invoices | 14 |
| Users | 12 |
| Routing Rules | 12 |
| AI Agents | 6 |
| Compliance Reports | 10 |
| System Integrations | 15 |
| Notifications | 25 |
| Comments | 60 |
| KPI Data | 12 months |

AI features use keyword-triggered responses (~50 patterns) to simulate intelligent behavior without requiring an API connection.

---

## System Integrations

The platform visualizes handovers to enterprise systems at each workflow stage:

| Stage | System | Purpose |
|-------|--------|---------|
| Validation | Coupa Risk Assess | Supplier risk assessment |
| Sourcing | SAP Ariba | RFx creation and bid management |
| Contracting | Sirion CLM | Contract drafting and review |
| Purchase Order | SAP S/4HANA | PO creation in ERP |

Integration status is visible on the process stepper, workflow cards, request detail, and table views.

### Source-connector layer

Upstream business objects (requests, orders, invoices, contracts, suppliers, tickets, risk records, …)
are read through a single, standardised connector interface in `src/lib/integrations`. The default
implementation reads the platform's **own store** — the system of record for this release — so no live
connection is required. A later release can register a **live** connector for any object type with no
change at the call site. Every result carries a provenance envelope (`sourceSystem`, `mode`,
`retrievedAt`, freshness). See `src/lib/integrations/README.md` for the layer and the live-swap seam.

---

## Project Structure

```
src/
├── config/          # Theme, navigation, roles
├── data/            # Mock data (typed TypeScript files)
├── stores/          # Zustand state stores
├── hooks/           # Custom React hooks
├── lib/             # Utilities, formatters, mock AI engine
│   ├── db/          # Data-access modules + TanStack Query hooks
│   ├── integrations/# Standardised source-connector layer (own-store → live swap)
│   ├── procurement/ # Pure decisioning modules (classify, materiality, risk, determination, …) + service description config (SERVICE_DESCRIPTION.md)
│   ├── routing/     # Routing-rule evaluator + diagnostics, and the one buying-channel resolver both the pre-check and the determination call
│   └── workflow/    # Workflow engine, transition primitive, gate model (see its README)
├── components/
│   ├── ui/          # shadcn/ui primitives
│   ├── layout/      # App shell, sidebar, topbar, portal layout
│   ├── shared/      # Reusable components (badges, cards, tables, charts)
│   └── charts/      # Recharts wrappers
└── features/        # Feature modules
    ├── dashboard/   # Role-based dashboards + home-designs/ (alternative Apple-style homes)
    ├── requests/    # New request wizard (per-step guidance map + header panel), request detail
    ├── workflows/   # Kanban, table, timeline, monitor
    ├── suppliers/   # Directory, profile, portal
    ├── approvals/   # Approval queue, delegation
    ├── admin/       # Rules, workflow designer, AI agents, service description config
    ├── sourcing/    # Events, evaluation centre (picker + per-event scoring and award)
    ├── contracts/   # Register, detail
    ├── purchasing/  # PO, invoice, three-way match
    ├── analytics/   # Dashboards, report builder
    ├── notifications/
    ├── ai-assistant/
    └── help/        # Knowledge base, support
```

---

## Deployment

Deployed as a static SPA on Vercel. The `vercel.json` handles client-side routing:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Push to `main` triggers automatic deployment.

### Environment variables

Set these in **Vercel → Settings → Environment Variables** (all environments) before deploying.
Full descriptions live in `.env.example`.

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Yes | Project REST URL, e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Browser | Yes | Legacy **anon JWT** — see the key note below |
| `SUPABASE_URL` | Serverless (`api/`) | Yes | Same URL, without the `VITE_` prefix |
| `SUPABASE_ANON_KEY` | Serverless (`api/`) | Yes | Same anon JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverless (`api/`) | Only for seeding | Bypasses RLS. Never prefix with `VITE_` |
| `ADMIN_SEED_SECRET` | Serverless (`api/`) | Only for seeding | Shared secret for `api/admin/seed.ts` |
| `VITE_ASSISTANT_PROVIDER` | Browser | No | `groq` (default) or `mock` for a fully offline assistant |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | Serverless (`api/`) | For the assistant | Server-side only, used by `api/chat.ts` |

Two things that reliably break a deploy:

- **`VITE_*` variables are baked in at build time, not read at runtime.** Adding or changing one has
  no effect until you trigger a *new build* — a redeploy from cache keeps the old values. Because
  `src/lib/supabase-client.ts` throws on module load when they are missing, a build without them
  ships a bundle that white-screens on first paint.
- **Use the legacy anon JWT (`eyJhbGciOi…`), not a `sb_publishable_…` key.** The REST helper in
  `src/lib/supabase.ts` sends the key as `Authorization: Bearer <key>`, which PostgREST rejects
  unless it is a JWT.

If the Supabase project was provisioned through the Vercel integration, it injects `SUPABASE_URL`
and `SUPABASE_ANON_KEY` automatically but **not** the `VITE_`-prefixed pair — add those by hand.

> Supabase free-tier projects pause after a period of inactivity, which surfaces in the app as
> connection timeouts. Restore the project from the Supabase dashboard to bring it back.

---

## License

This is a prototype for internal design workshops. Not intended for production use.
