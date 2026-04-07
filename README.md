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

---

## Screens

### Core Experience
| Screen | Description |
|--------|-------------|
| Role-Based Dashboards | 5 tailored dashboards (Service Owner, Procurement Manager, Vendor Manager, Operations Lead, Admin) |
| New Request Wizard | 5-step intake form with AI category suggestion, supplier autocomplete, compliance checks, routing preview |
| Request Detail | Full lifecycle tracker with 7 tabs (Overview, Workflow, Comments, Approvals, Documents, Related, Audit) |
| Active Workflows | Kanban board (drag-and-drop), sortable table, Gantt timeline — with system integration badges |
| Workflow Monitor | Bottleneck dashboard, stuck requests, SLA tracker, heatmap, AI bottleneck analysis |

### Supplier Management
| Screen | Description |
|--------|-------------|
| Supplier Directory | Card grid and table views with risk ratings, compliance status, spend data |
| Supplier Profile | 7-tab 360 view (Overview, Contracts, Risk, Spend charts, Performance, Documents, Activity) |
| Supplier Portal | External self-service: dashboard, onboarding wizard, invoices, sourcing events, documents, messaging |
| Supplier Messages | Internal messaging threads with suppliers |

### Sourcing & Contracts
| Screen | Description |
|--------|-------------|
| Sourcing Events | Event list, detail with Q&A board, evaluation centre with scoring matrix |
| Contract Register | Lifecycle management with renewal alerts, obligation tracking, financial comparison |
| Purchase Orders | PO management with goods receipt, AI compliance review |
| Invoice Queue | Invoice management with AI data extraction, three-way match visualizer |

### Admin & Configuration
| Screen | Description |
|--------|-------------|
| Routing Rules Engine | 3-panel layout: rule tree, visual IF/THEN editor, test panel |
| Workflow Designer | React Flow canvas with 10 custom node types, drag-from-palette, node configuration, simulation |
| AI Agent Configuration | Agent library, type-specific config forms, test panel, performance dashboard |
| Approval Chains | Visual approval chain editor with threshold configuration |
| Policy Management | Procurement policy library with expandable full-text preview |

### Analytics & Platform
| Screen | Description |
|--------|-------------|
| Spend Overview | Bar charts, treemap, top suppliers, managed vs unmanaged, contract coverage |
| Compliance KPIs | Policy breaches, first-time-right rate, classification accuracy, SRA coverage |
| Pipeline & Cycle Time | Funnel visualization, cycle time distribution, throughput, ageing analysis |
| Report Builder | Drag-and-drop report creation with chart type selection |
| Notifications | Grouped feed with type filtering and notification preferences |
| AI Assistant | Floating chat overlay + full-page mode with keyword-triggered responses |

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

---

## Project Structure

```
src/
├── config/          # Theme, navigation, roles
├── data/            # Mock data (typed TypeScript files)
├── stores/          # Zustand state stores
├── hooks/           # Custom React hooks
├── lib/             # Utilities, formatters, mock AI engine
├── components/
│   ├── ui/          # shadcn/ui primitives
│   ├── layout/      # App shell, sidebar, topbar, portal layout
│   ├── shared/      # Reusable components (badges, cards, tables, charts)
│   └── charts/      # Recharts wrappers
└── features/        # Feature modules
    ├── dashboard/   # Role-based dashboards
    ├── requests/    # New request wizard, request detail
    ├── workflows/   # Kanban, table, timeline, monitor
    ├── suppliers/   # Directory, profile, portal
    ├── approvals/   # Approval queue, delegation
    ├── admin/       # Rules, workflow designer, AI agents
    ├── sourcing/    # Events, evaluation centre
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

---

## License

This is a prototype for internal design workshops. Not intended for production use.
