# Procurement Orchestration Platform

A procurement orchestration platform with a React SPA, a private application-owned Neon PostgreSQL store, and Vercel API functions. Browser data access is routed through the allowlisted `/api/db` boundary. It demonstrates end-to-end internal procurement workflows, AI-assisted decision making, and integration handover records across 40+ interactive screens.

**Live demo:** [orchestration-ui.vercel.app](https://orchestration-ui.vercel.app)

The 31 August lifecycle-stabilisation changes are verified locally (including
the full wizard smoke and atomic intake source checks) and are ready for a
deployment-backed rerun. Neon live checks remain environment-dependent and
must be repeated once the configured database hostname is reachable.

**Release documentation:** [product backlog](docs/roadmap/PRODUCT_BACKLOG.md) · [R1 roadmap](docs/roadmap/R1_BACKLOG_FIT_GAP.md) · [implementation evidence index](docs/roadmap/R1_IMPLEMENTATION_EVIDENCE.md) · [test playbook](docs/testing/TEST_PLAYBOOK.md)

---

## What This Is

R1 is an internally operated system of record backed by private Neon. It owns request, PR, internal PO, workflow, sourcing, supplier, contract, risk, catalogue, ticket, conversation, and audit records. There are no live upstream writes: the connector layer is the seam for R2 integrations. Governed catalogue and contract checkout submits through `/api/governed-checkout`, which recomputes policy and contract coverage server-side and atomically captures a request, purchase requisition and lines before creating an internal PO when policy permits. Contract scope is effective-dated and matched on service description, deliverables, exclusions and context; `/api/contract-match` provides explainable candidates and targeted clarification questions. Policy edits persist through `/api/policy-config` so browser previews and server writes share one configuration. Role switching remains a simulation/UAT mechanism; authentication and production authorization are deferred.

### Key Capabilities Demonstrated

- **Intelligent Intake** — a four-step AI-assisted wizard that auto-classifies categories, suggests commodity codes, shows every way to buy on one screen, and runs compliance checks — asking everything before concluding anything
- **Contract-aware intake** — structured scope versions, deliverable/exclusion matching, explainable ranking and adaptive clarification before a call-off
- **Dual-mode requester experience** — requesters start in a plain-language Simple view with adaptive routing; reviewers retain the full Expert view, with a keyboard-accessible per-user switch
- **Requester home** — Simple mode focuses the home page on starting a request, tracking the requester’s own active work, and getting help; Expert mode retains configurable dashboards and operational widgets
- **Workflow Orchestration** — Kanban, table, and timeline views of active procurement workflows with bottleneck detection
- **System Integration Handovers** — Internal handover records for future SAP Ariba, Coupa Risk, Sirion CLM, and SAP S/4HANA connectors (R2; no external writes)
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
| Operational home dashboard | Expert users receive one consistent role-based dashboard with live KPIs, pipeline, workload and action widgets. Decorative alternate layouts were retired to avoid confusing users with inconsistent navigation. |
| New Request Wizard | One shared intake for every demand type, in **four steps** — Describe → How you'll buy → Details → Review & submit — on one engine, where **every question is asked before any conclusion is shown**: Details holds everything the requester supplies (service description, residual risk questions, supplier), Review holds everything the platform concluded (buying channel and timeline, risk outcome, approvals, checks that ran). Simple and Expert are **one page**: `density` picks the header framing and how much evidence the Review step shows, never a step, a gate, a decision or what is written — and anything that *blocks* the request is shown in both. The step order, gates and guidance live in one config (`intake-steps.ts`), and `test:mode-equivalence` asserts there is no second intake page to drift. Describe or upload a brief, confirm a specific commodity/service family, clarify only missing details, review the recommended route, complete governed fulfilment fields, and submit. Goods/Services is an internal routing value and is never a requester choice. PDF/DOCX text is extracted server-side for confirmation; the structured description keeps Included, Excluded, Deliverables and Acceptance Criteria separate with provenance. The adaptive conversation and contextual guidance are deterministic when AI is unavailable, and completed submissions enter the first actionable workflow stage rather than remaining in intake. Catalogue remains the only visible shortcut; contract and P-card routes are discovered by governance. A demand started from the Simple home entry point carries its text into route evaluation and skips the duplicate describe screen; choosing “Proceed to full request” always opens the adaptive details path. |
| Request Detail | Full lifecycle tracker with 7 tabs (Overview, Workflow, Comments, Approvals, Documents, Related, Audit). Validation confirms the request, supplier, contract, risk, and capacity data; approval is the separate budget/authority decision and is only required when policy or risk calls for it. Both stages show the **service description** and its quality score, so a reviewer sees what they are approving |
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
| Smart Command Bar | Free-text entry on the home page. A **demand goes straight into intake**, carrying its wording, so classification starts immediately; only lookups and open questions reach the assistant. A demand the **catalogue genuinely serves** is **named** — the matched item, its price and lead time — with a link to its governed checkout and an always-visible "not what you need?" route into full intake; it never navigates on the requester's behalf. The catalogue decision is `lib/procurement/intake-routing.ts` — the same category-gated, naming-word decision the wizard's pre-check makes, so both entry points agree |
| Routing Rules Engine | 3-panel layout: rule tree, visual IF/THEN editor, test panel. The **editor, the test panel and the runtime share one vocabulary** — every field and operator the editor offers is evaluated in production, and the test panel calls the production evaluator rather than reimplementing it. An **active rule that cannot fire is diagnosed** at the top of the page (unknown field, unsupported operator, malformed `between`, no conditions) instead of silently never matching |
| Decisioning Thresholds | Edit the governed decisioning thresholds (approval/materiality/risk/sourcing/contract); Save applies them to the live front door; live simulation previews a sample demand's outcome |
| Service Description | Configure the service description end to end: the **generation prompt** (guidance, system prompt, temperature, token budget, with a preview of the assembled prompt), the **components asked** at intake (question, example, required, and the condition that shows it), **what is generated** (the detailed sections, which are asked vs inferred, and which compose the compact narrative), and **reuse in later steps** (which sections seed a sourcing event's requirements, plus the default evaluation criteria). Per-category with a `default` fallback; stored in Postgres so the serverless generation and intake routes read the same config Generation is **signal-aware**: the capture-time materiality, inherent risk, data sensitivity and sourcing read (`demand-signals.ts`) is passed to the model, and the template's `requiredWhen` conditions say which sections that read makes mandatory — so a material, competitively-sourced engagement is required to cover scope, deliverables and measurable acceptance criteria while a small order is not. The determination reports any required section still missing rather than regenerating the document behind the requester. |
| Workflow Designer | React Flow canvas with 10 custom node types, drag-from-palette, node configuration, simulation |
| AI Agent Configuration | Agent library, type-specific config forms, test panel, performance dashboard |
| Categories | The demand taxonomy: label, description, icon, timeline, active — and **whether the category can be fulfilled from the catalogue**, which gates the buy-route screen's catalogue check |
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

# Lint — clean, and expected to stay that way
npm run lint

# Preview production build
npm run preview
```

`npm run lint` exits 0 on `main`. It runs the React Compiler rules, which catch
more than style: impure render, refs read during render, state mirrored from
server data by an effect, and manual memoization the compiler cannot preserve
(which silently disables optimization for the whole component). Note that the
compiler stops analysing a file after a bailout, so fixing one finding often
reveals others in the same file — a falling count is progress, not regression.

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing

Integration tests run as standalone Node scripts under `tests/integration/`:

```bash
npm run test:all                  # every suite above in one run — pass/skip/fail counted separately
npm run test:ui:all               # …including the browser suites (needs a Chromium binary)
npm run test:db-casts             # every query parameter is cast to its column's type, never blindly to text
npm run test:mode-equivalence     # Simple and Expert reach the same governance decision for the same demand —
                                  # the determination takes no density argument, and both write an identical compliance record
npm run test:intake-determination # the intake determination, pinned: determinism (`now` is an input), honesty
                                  # (no unrun check is recorded as passed) and one derivation of the buying channel
npm run test:intake-evidence      # a request never carries a compliance check that did not run
npm run test:e2e                  # end-to-end request → approval workflow
npm run test:routing              # routing-rule evaluator
npm run test:routing-rule-integrity # editor ↔ runtime ↔ test-panel parity — every offered field/operator is evaluated, a broken rule is diagnosed
npm run test:intake               # intake sequence
npm run test:connectors           # source-connector layer (registry, query, live-swap seam)
npm run test:contract-matching    # deterministic scope matching, exclusions, dates and clarification gates
npm run test:contract-match-api   # read-only live Neon contract-match endpoint check
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
npm run test:intake-guidance      # progress reaches 100%, inferred sections are not outstanding, the Details gate, per-step guidance copy,
                                  # the four-step config (order, per-route steps, derived submit step), the chat's opening invitation,
                                  # every question's stated reason, and a source scan: no service-description record cast to a map of
                                  # strings, no unguarded .trim() over its values
npm run test:unified-intake        # unified text/PDF/DOCX intake, specific commodity candidates, separate scope/exclusions,
                                  # contextual guidance boundaries, no requester-facing Goods/Services choice, and the
                                  # deep-link parsers (a route is never taken as a category; fulfilment context survives)
npm run test:answer-quality       # the deterministic answer judge — placeholder/filler rejected, real answers accepted, slot-aware floor
npm run test:assistant-intents    # assistant routes procurement demands to intake, not a support ticket
npm run test:assistant-honesty    # the assistant never claims it did something it did not do — start_demand
                                  # offers a pre-filled form and says so, and a completion claim is replaced
npm run test:operational-risk     # preliminary operational risk assessment (per-dimension screen)
npm run test:classification-eval  # classification eval harness + accuracy baseline (CLS-G1)
npm run test:demand-signals       # capture-time governance read (materiality/risk/sourcing) + config-driven required sections
npm run test:onboarding-stage     # vendor onboarding — light gate (sourcing + risk) and full gate (contracting)
npm run test:intake-routing       # catalogue vs contract vs new demand — category gate, naming-word rule, LLM intent
npm run test:intake-routing-eval  # intake routing eval harness + accuracy baseline
npm run test:referral             # demand disposition — proceed / request-change / refer-back (RTE-06)
npm run test:knowledge            # grounded policy-Q&A retrieval (ranking, citations, low-confidence)
npm run test:policy-config        # central decisioning thresholds (defaults pinned + override resolver)
npm run test:policy-config-server # Neon policy singleton save/load/validation (self-cleaning)
npm run test:governed-checkout    # contract/risk/capacity gates and PR/PO routing decisions
npm run test:governed-checkout-atomic # atomic Neon request → PR → lines → conditional PO, replay/conflict/concurrency
npm run test:intake-submit        # atomic full-demand intake, ISO-date validation and first-stage selection
# Neon-backed live suites report unavailable when the configured database hostname cannot be resolved.
npm run test:catalogue-ui         # catalogue item detail and checkout entry-point regressions
npm run test:p-card               # governed P-card eligibility and route-only safety guard
npm run test:dashboard-widgets    # the widget catalogue and its renderer agree — nothing offered that cannot render,
                                  # nothing rendered that cannot be reached, every icon mapped
npm run test:experience-mode      # role defaults, preference normalization, and pilot eligibility contract
npm run test:screening            # supplier screening — clear / pending / flagged / unknown + blocking
npm run test:supplier-data        # supplier master-data completeness → remediation handoff (RTE-04)
npm run test:approver-resolution  # approval step role → switchable directory rep (one identity namespace)
npm run test:workflow-steps       # config-driven Routing — template lifecycle + risk/onboarding steps + approval-chain banding
npm run test:approval-chain-persistence # self-cleaning DB check — a value-banded approval-chain key persists on a request
npm run test:ai-api-config        # API regression — missing active database/AI server config returns a controlled 503, not a function crash
npm run test:api-imports          # every api/*.ts function's import graph has explicit file extensions (tsc/vercel dev don't enforce this; Vercel's real build does)
npm run test:vercel-functions     # keeps the explicit API surface within the Vercel Hobby 12-function budget
npm run test:admin-editors        # admin config saves
npm run walkthrough               # visual QA harness (Playwright) — drives the front door across scenarios + every tab, screenshots to /tmp/fd (no assertions)
npm run test:ui                   # browser smoke (Playwright) — wizard end-to-end through the determination + config-driven routing steps
npm run test:e2e-ui               # full-app browser sweep — every route × role, captures console/runtime errors
npm run test:ui-full              # evidence harness — 60+ checkpoints screenshotted; asserts only "no crash, not blank"
              # UI-only UAT sweep with visible role switching and retained screenshot artifacts
npm run test:ui-lifecycle         # static guard that call-offs, stage actions and invoice transitions stay UI-governed
npm run test:service-description-ui # browser smoke — /admin/service-description renders all four config areas
npm run test:intake-guidance-ui   # browser smoke — step-1 single classification block, per-step header panels, the step gate
npm run test:dashboard-ui         # browser smoke — the role's default dashboard covers its work, and adding or
                                  # removing a widget survives a reload
npm run test:request-detail-ui    # browser check on fixtures (no credentials, no network) — the request detail renders, every
                                  # workflow step opens, and the risk form pre-populates from the service description
npm run test:interactions-ui      # interaction E2E — wizard submit, admin save, AI assistant (self-cleaning)
npm run test:link-route-integrity # static deep-link contract for active request/dashboard destinations
npm run test:link-navigation      # deployed role-aware link navigation and requester read-only details
npm run test:neon-migration       # one data path, one client, and no Supabase identifier in src/, api/ or tests/
npm run test:neon-live            # read-only Neon schema, relationship, and catalogue-governance validation
npm run test:sql-splitter         # a backfill splits on real statement boundaries — a `;` or `--` inside a
                                  # quoted string is data, not a boundary
# GET /api/neon-health reports safe configuration, DNS, TLS, authentication, connection, and schema classes.
# …see package.json "test:*" scripts for the full list

npm run backfill:compliance       # one-time data migration, NOT a test — fills the front-door
                                   # determination fields on application-owned `requests` rows that predate
                                   # them, using the same decisioning logic the live wizard runs.
                                   # Only ever fills nulls; safe to re-run.
npm run backfill:intake-compliance # restores the 39 intake_compliance_records rows the cutover's
                                   # copy list omitted. Every statement is ON CONFLICT DO NOTHING.
npm run purge:ui-e2e              # remove retained UI-E2E-* lifecycle records (dry run; --apply to delete)
npm run backfill:neon-catalogue-governance # idempotent repair when the migrated data predates the
                                           # explicit catalogue contract/risk columns.
```

`test:ui` uses Playwright. First-time setup: `npm install` then `npx playwright install chromium`.
It boots the dev server itself and needs `.env.local` with `NEON_DATABASE_URL` set.

Four suites are the exception — `test:request-detail-ui`, `test:experience-mode-ui`,
`test:service-description-ui` and `test:intake-guidance-ui`. They stub the data API inside the browser
(`installDbStub()` in `tests/ui/db-stub.mjs`) and run with **no credentials and no network**, so all
four run in CI. Use that harness for any screen worth checking where the database is unreachable — a
suite that can only run against a live database does not run in CI or in a sandbox, which is how a
render crash on the request detail reached production unnoticed.

Stub the boundary the client actually posts to, `/api/db`. `test:experience-mode-ui` intercepted
`**/rest/v1/**`, the PostgREST path from before the Neon cutover, so it caught nothing and two of its
checks failed for months against a pre-check screen that was really crashing.

The link-navigation suite uses only visible role and experience-mode controls. It verifies that
supplier, contract, sourcing, purchase-order and request links land on the intended record instead
of silently redirecting to Home. Requesters may inspect supplier and contract details read-only;
operational edits remain restricted to entitled roles.
Set `E2E_API_BASE=https://orchestration-ui.vercel.app` for deployed API tests and
`E2E_UI_BASE=https://orchestration-ui.vercel.app` for the interaction suite against a deployed build.

Per the repo's Definition of Done (see `CLAUDE.md`), every change ships with updated tests and docs.

### Role Switching (simulation)

Use the role switcher dropdown in the top-right corner to simulate each persona during demos and UAT. It is a presentation/testing mechanism, not authentication or authorization.

Switch between:

- **Service Owner** — simplified view focused on requests and actions
- **Procurement Manager** — full orchestration control tower
- **Vendor Manager** — validation queue and compliance focus
- **Operations Lead** — workflow health, bottlenecks, SLA tracking
- **Supplier (External)** — self-service portal with distinct layout
- **Admin** — routing rules, workflow designer, AI agents, system health

---

## Seed and demo data

The internal Neon store is pre-loaded with representative seed data for demos and UAT. Typed local
fixtures remain available for offline UI tests:

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

AI classification uses the governed Groq → Gemini server-side fallback with deterministic client routing when the classifier is unavailable. The AI agent configuration is held in the platform store and read by the Vercel handlers.

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

Upstream-shaped business objects (requests, orders, invoices, contracts, suppliers, tickets, risk
records, …) are read through a single, standardised connector interface in `src/lib/integrations`.
The default implementation reads the platform's **own Neon store** — the R1 system of record — so no
live connection is required. R2 can register a **live** connector for any object type with no change
at the call site. Every result carries a provenance envelope (`sourceSystem`, `mode`, `retrievedAt`,
freshness). See `src/lib/integrations/README.md` and the [R1 evidence index](docs/roadmap/R1_IMPLEMENTATION_EVIDENCE.md).

---

## Project Structure

```
api/                 # Vercel entrypoints; low-volume routes use api/[...route].ts
src/
├── config/          # Theme, navigation, roles
├── data/            # Typed seed/fallback fixtures used by offline tests
├── stores/          # Zustand state stores
├── hooks/           # Custom React hooks
├── lib/             # Utilities, formatters, decisioning and AI adapters
│   ├── db/          # Data-access modules + TanStack Query hooks
│   ├── integrations/# Standardised source-connector layer (own-store → live swap)
│   ├── procurement/ # Pure decisioning modules (classify, materiality, risk, intake determination + its
│   │                #   compliance record, governed checkout, …) + service description config (SERVICE_DESCRIPTION.md)
│   ├── routing/     # Routing-rule evaluator + diagnostics, and the one buying-channel resolver both the
│   │                #   buy-route screen and the determination call (plus its plain-English requester copy)
│   ├── server/api/  # Explicit low-volume API handlers behind the dispatcher
│   └── workflow/    # Workflow engine, transition primitive, gate model (see its README)
├── components/
│   ├── ui/          # shadcn/ui primitives
│   ├── layout/      # App shell, sidebar, topbar, portal layout
│   ├── shared/      # Reusable components (badges, cards, tables, charts)
│   └── charts/      # Recharts wrappers
└── features/        # Feature modules
    ├── dashboard/   # Role-based dashboards, the command bar, and the Simple requester home
    ├── requests/    # Intake — ONE four-step page for both densities (intake-steps.ts owns the order,
    │                #   gates and guidance; use-intake-determination.ts mounts the determination once;
    │                #   see its README for the density contract), request detail
    ├── catalogue/   # Item detail and governed catalogue checkout
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

Deployed as a Vite SPA with Vercel serverless functions. The `vercel.json` preserves `/api/*` before its SPA fallback:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Push to `main` triggers automatic deployment.

### Environment variables

Set these in **Vercel → Settings → Environment Variables** (all environments) before deploying.
Full descriptions live in `.env.example`.

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `VITE_PROCUREMENT_PROFILES_ENABLED` | Browser | No | Defaults to on; set `false` only for a deployment whose schema predates the profile table |
| `NEON_DATABASE_URL` | Serverless (`api/`) | **Yes** | Private Neon connection string; never expose with `VITE_` |
| `ADMIN_SEED_SECRET` | Serverless (`api/`) | Only for seeding | Shared secret for `api/admin/seed.ts` |
| `VITE_ASSISTANT_PROVIDER` | Browser | No | `groq` (default) or `mock` for a fully offline assistant |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | Serverless (`api/`) | For AI classification and assistant | Server-side only, used by `api/ai.ts`, `api/chat.ts`, and `api/chat-intake.ts` |
| `GROQ_MODEL` | Serverless (`api/`) | No | Groq model override for classifier routes; defaults to `openai/gpt-oss-20b` |

The browser holds **no** database credential: it posts to the allowlisted `/api/db` boundary, and
there is no provider switch to get wrong. `NEON_DATABASE_URL`/`DATABASE_URL` must be configured only
as a server-side Vercel variable; never copy it into a `VITE_` variable.

`/api/db` has **no authentication**. An unfiltered `DELETE`/`UPDATE` is refused, which bounds the
damage, but anyone who can reach the deployment can read and write the allowlisted tables. Role
switching is a UAT simulation, not an authorization boundary (ADR-0003). Treat this as the open item
it is before any real pilot.

Two things that reliably break a deploy:

- **`VITE_*` variables are baked in at build time, not read at runtime.** Adding or changing one has
  no effect until you trigger a *new build* — a redeploy from cache keeps the old values.
- **`NEON_DATABASE_URL` must be set for every environment the deployment runs in**, not just
  Production. Preview deployments get their own environment; a preview without it serves a UI whose
  every read fails. Server handlers construct the privileged client lazily
  (`getDbAdmin()` in `api/_db-admin.ts`) so a missing connection returns a controlled
  `503 { code: "service_unavailable" }` rather than crashing the function at module load — but the
  screen is still empty. The `/api/neon-health` route distinguishes a DNS failure from a schema one.

---

## License

This is a prototype for internal design workshops. Not intended for production use.
