# Architecture — Procurement Orchestration Platform

**What this document is:** how the platform is built — the system and its
boundaries, where each kind of code lives, the one data path, the decision
engines, the configuration they read, how AI is used, the security posture, and
how it is tested. Read [the PRD](PRD.md) first for what it is for. The rules for
changing it are in [AGENTS.md](../AGENTS.md); the reasons for its non-obvious
boundaries are the [ADRs](adr/). A module's own README goes deeper than this
document and is the home of anything specific to that module.

---

## 1. The system

```
  Browser — React SPA (Vite)                            Language models
    │  src/lib/db-client.ts: POST /api/db               Groq, then Gemini
    │  (allowlisted relations, no credential)                  ▲
    │  other /api/* routes                                     │ api/_llm.ts
    ▼                                                          │
  Vercel serverless functions — api/ (≤ 12) ───────────────────┘
    │  SQL over NEON_DATABASE_URL (server-side only)
    ▼
  Neon PostgreSQL — db/schema.sql — the system of record

  Upstream systems (ERP, contract management, payment, supplier network,
  risk providers): none connected in Release 1. Their records are internal
  handovers; the source-connector layer (§4.4) is the seam Release 2 fills.
```

There is one database and one way to reach it. The browser never holds a
database credential, and there is no second client or dialect: development and
production once ran different clients, so nothing tested what production
executed ([ADR-0003](adr/0003-private-neon-database-migration.md),
`test:neon-migration`).

## 2. Runtime and deployment

**Stack.** React 19, Vite 8 and TypeScript 6 (strict, with `noUnusedLocals` and
`noUnusedParameters`); React Router 7; Tailwind 4 with shadcn/ui components;
Zustand 5 for client state and TanStack Query 5 for server state; React Flow
(`@xyflow/react`) for the workflow designer and Recharts for charts. Forms are
plain controlled components. The store is a private Neon PostgreSQL database
(`@neondatabase/serverless`); tests are Node scripts run with `tsx` and
Playwright for the browser suites.

A Vite single-page app with Vercel serverless functions, deployed on every push
to `main`. The Hobby plan allows **12 functions**, and the API is shaped around
that cap (`test:vercel-functions`):

| Function | What it does |
|---|---|
| `api/db.ts` | The data boundary: reads and writes allowlisted relations; refuses an unfiltered `DELETE` or `UPDATE`. Also dispatches the low-volume handlers in `api/_domains/` through `?domain=` |
| `api/governed-checkout.ts` | Catalogue baskets and contract call-offs: recomputes the decision from stored data and commits request → requisition → lines → conditional internal PO atomically ([ADR-0002](adr/0002-governed-catalogue-checkout.md), [ADR-0009](adr/0009-catalogue-basket.md)) |
| `api/workflow-action.ts` | Stage actions on a request, through the one transition primitive |
| `api/execute-action.ts` | The assistant's confirmed internal actions — each writes a real record, or says it cannot |
| `api/chat.ts` | The assistant (the only tool-calling model caller) |
| `api/ai.ts` | Classification of a demand (AI-001) |
| `api/chat-intake.ts` | Phrasing and extraction for the service-description conversation |
| `api/generate-sow.ts` | Writing the service description from the captured answers |
| `api/admin/seed.ts` | Seeding, behind a shared secret |

`api/_domains/` holds the handlers served through `api/db.ts`, each with a
public path rewritten in `vercel.json`: `intake-submit` (the atomic new-request
write, [ADR-0007](adr/0007-atomic-intake-and-lifecycle-stabilisation.md)),
`contract-match` ([ADR-0004](adr/0004-contract-scope-matching.md)),
`contract-scope`, `contract-vocabulary`, `commodity-match`, `intake-upload`,
`policy-config`, `status-answers` and `neon-health`. Modules prefixed with `_`
are shared code, not routes, and do not count against the cap
(`test:api-domain-routing`, `test:api-imports`).

Server handlers build their database client lazily (`getDbAdmin()` in
`api/_db-admin.ts`), so a missing connection string answers a controlled
`503 { code: "service_unavailable" }` instead of crashing at module load, and
`/api/neon-health` tells a DNS failure from a schema one. Environment variables
are listed in the [README](../README.md#environment-variables).

## 3. Code map

```
api/                 Vercel entrypoints (§2); `_`-prefixed modules are shared code
├── _domains/        Handlers dispatched by api/db.ts?domain=, public paths rewritten in vercel.json
├── _llm.ts          The one model helper — Groq, then Gemini (§7)
└── _policy.ts       The governed thresholds, loaded server-side (§6)
db/
├── schema.sql       The schema, applied by db/migrations/apply-neon-schema.mjs
├── migrations/      Schema application (see its README)
└── backfills/       One-time, idempotent data changes (`backfill:*` scripts; most take --dry-run)
src/
├── config/          Theme, navigation, roles
├── data/            Domain types (types.ts) + the seed fixtures api/admin/seed.ts writes (see its README)
├── stores/          Zustand stores (the role switcher's simulated session, …)
├── lib/
│   ├── db/          Data access — one module per relation, TanStack Query hooks, mappers; the only
│   │                importer of db-client; *-core.ts shared with the server (see its README)
│   ├── integrations/  The source-connector layer — ports, registry, own-store connectors (see its README)
│   ├── procurement/ The pure decision modules (§5) and the service-description config (SERVICE_DESCRIPTION.md)
│   ├── routing/     The routing-rule evaluator and the one buying-channel resolver
│   ├── workflow/    The workflow engine, the transition primitive, channel stages and plans (see its README)
│   └── assistant/   The question route shared by Home and the assistant, status answers, providers
├── components/      shadcn/ui primitives, layout, shared components, chart wrappers
└── features/        One folder per area: dashboard (Home), requests (new-request/ — the
                     conversation and the Channel page — and request detail), catalogue, workflows,
                     pipeline, approvals, tasks, sourcing, suppliers, contracts, purchasing,
                     analytics, admin, ai-assistant, help, notifications, settings
tests/
├── integration/     Node suites, one `test:*` script each (§9)
├── ui/              Playwright suites; db-stub.mjs answers /api/db in the browser
└── lib/             Shared helpers for the live suites
```

Module READMEs: [requests](../src/features/requests/README.md),
[catalogue](../src/features/catalogue/README.md),
[contracts](../src/features/contracts/README.md),
[purchasing](../src/features/purchasing/README.md),
[suppliers](../src/features/suppliers/README.md),
[lib/db](../src/lib/db/README.md), [lib/integrations](../src/lib/integrations/README.md),
[lib/workflow](../src/lib/workflow/README.md), [data](../src/data/README.md),
[db/migrations](../db/migrations/README.md).

## 4. Data

### 4.1 One data path

Browser code reads and writes through `src/lib/db-client.ts`, which posts to
`/api/db`. The boundary serves only the relations on its allowlist, and refuses
an unfiltered `DELETE` or `UPDATE`. The policy row is the exception: it has its
own endpoint, `/api/policy-config`, which validates what is saved.

### 4.2 Schema and change

`db/schema.sql` is the schema, applied to Neon by
`db/migrations/apply-neon-schema.mjs`; `test:schema-drift` compares it with the
live `information_schema`. Changes follow the database rule in
[AGENTS.md](../AGENTS.md) (Conventions): backward compatible, so a deployed older
build keeps working, and a data change is an idempotent script in
`db/backfills/`, usually with `--dry-run`.

### 4.3 The data-access layer

One module per relation (`src/lib/db/<entity>.ts`) with its TanStack Query hooks
(`src/lib/db/hooks/use-<entity>.ts`); domain types in `src/data/types.ts`.
Values the database can work out are **derived when read**, not stored and
forgotten: views such as `suppliers_with_derived` and `contracts_with_derived`
compute `*_live` columns, and the mappers prefer them. Logic the server needs as
well lives in a `*-core.ts` module both sides import.

### 4.4 The source-connector layer

Every upstream-shaped object — supplier, contract, purchase request and order,
invoice, risk assessment, catalogue item, payment — is read through ports in
`src/lib/integrations`, answered today by own-store connectors over the
platform's database. A live connector can replace one for any object type with
no change at the call site, and every result carries its provenance (source
system, mode, when retrieved). **Known gap:** the server handlers
(`api/_domains/*`, `api/governed-checkout.ts`) read with SQL rather than
through the ports, because the port layer is browser-shaped (TanStack hooks)
and has no server-side factory.

## 5. The decision engines

Decisions are pure functions over stored data and configuration, so the screen
that previews a decision and the server that records it run the same code, and
a test can pin each one.

| Decision | Where | Read by |
|---|---|---|
| What the demand is — category, commodity code | `procurement/classify.ts`, `category-code.ts`, `commodity-candidates.ts`; `features/requests/new-request/conversation/classify-demand.ts` (AI-001 when active, the configured keywords otherwise) | The conversation, the Home box |
| Whether the catalogue or a contract covers it | `procurement/intake-routing.ts` (`decideIntakeRoute`), `procurement/contract-matching.ts` served by `/api/contract-match` ([ADR-0004](adr/0004-contract-scope-matching.md)) | The conversation, the Home box |
| The buying channel | `routing/evaluate-routing-rules.ts`, `routing/demand-channel.ts` (`resolveDemandChannel`) | The conversation, the determination, the submit gate — one evaluator |
| The intake determination — materiality, risk, approval to source, contract and sourcing type, policy checks, the compliance record | `procurement/intake-determination.ts` (deterministic: `now` is an input), `intake-compliance-record.ts` | The Channel page, `/api/intake-submit` |
| What the conversation asks, and when it is through | `procurement/demand-conversation.ts`; `conversation/conversation-rules.ts`, `request-rows.ts` | The conversation page |
| Who approves | `procurement/approval-derivation.ts`, `lib/db/approvals-core.ts` | The Channel page, submit, the approval stage |
| Whether a catalogue or call-off order may be placed | `procurement/governed-checkout.ts`, `catalogue-basket.ts` | The Catalogue page, the Channel page, `api/governed-checkout.ts` |
| How a request moves | `workflow/transition.ts`, `engine.ts`, `edge-conditions.ts`, `channel-stages.ts`, `channel-plan.ts`, `stage-sla.ts` ([its README](../src/lib/workflow/README.md)) | Every stage change; the Channel page's plan |
| What a free-text question is | `assistant/question-route.ts` | The Home box and the assistant — one route |

Anything that creates a record recomputes its decision on the server from
stored data, treats the client's version as advisory, and is idempotent.

## 6. Configuration

Every administrator-owned setting has **one job**, and no setting restates a
fact another owns. The numbers are the root: routing rules, approval-chain
bands, workflow branches, forms and knowledge-base articles name a threshold as
`policy:<key>` rather than typing it, and it is resolved where the configuration
is read — the server loads the governed values itself (`api/_policy.ts`), never
the shipped defaults.

| Configuration | Owns | Stored in |
|---|---|---|
| Decisioning thresholds | Every number a decision compares against | `procurement_policy_configs` |
| Routing rules | Which buying channel a demand takes | `routing_rules` |
| Approval chains | Who approves, over which value band; which role acts as Finance, Legal… | `approval_chains`, `functional_roles` |
| Workflow templates | Each channel's lifecycle — stages, order, owner role, SLA, gate, branches — and the requester's wording for it | `workflow_templates` |
| Forms | The evidence a stage collects, and whether leaving it waits on it | `form_templates` |
| Service description | What intake asks, what is generated, and what a sourcing event starts with | `service_description_templates` |
| Categories | The taxonomy — classifier keywords, commodity codes, catalogue eligibility, managers, preferred suppliers | `procurement_categories` and its satellite tables |
| AI agents | The switches on what is automated | `ai_agents` |
| Knowledge base | Policy and how-to articles, figures as references | `knowledge_base` |
| Reference data | Cost centres (with their owners) and delivery locations | `cost_centres`, `delivery_locations` |

What each item is for, and what in the platform reads it, is [the admin
map](specs/admin-map.md). Built-in copies of the service description, the
knowledge base and the category seed remain in code only as the floor for an
unreadable table, never as the configuration.

## 7. AI

Five places call a language model, all through **one** helper, `api/_llm.ts`,
which tries Groq and falls back to Gemini: the assistant (`api/chat.ts`, the
only tool-calling caller), classification (`api/ai.ts`), the conversation's
phrasing and extraction (`api/chat-intake.ts`), service-description writing
(`api/generate-sow.ts`) and the contract-match rerank. The model ids are pinned
there and checked against what the providers serve (`test:models`); changing
one is a governed decision ([AGENTS.md](../AGENTS.md) rule 5).

The division of labour is fixed: **the model reads and phrases; the engine
decides.** The conversation engine chooses which question is next and when the
description is complete, and a model reply that is not one short question is
replaced with the canned wording. Every model-backed step has a deterministic
path — the configured keywords classify, the engine phrases, the rules route —
used whenever the agent is switched off or the provider is down. The AI agents
in `ai_agents` are the switches: AI-001 (classification), AI-002 (the policy
checks), AI-004 (spend anomaly rules), AI-005 (supplier suggestions) and AI-007
(status answers, with its attribute and role configuration).

## 8. Security posture

- **There is no authentication** ([ADR-0003](adr/0003-private-neon-database-migration.md)).
  Anyone who can reach the deployment can read and write the allowlisted
  relations through `/api/db`; an unfiltered `DELETE` or `UPDATE` is refused,
  which bounds the damage. The role switcher is a simulation for demonstrations
  and acceptance tests. This is the open item before any real pilot.
- **Secrets stay on the server.** The database URL and model keys are
  server-side variables; a `VITE_` variable is baked into the browser bundle.
- **Sensitive fields** (banking and payment details) are masked by default and
  shown only to entitled roles.
- **The assistant confirms before it acts**, describes the write it has queued,
  and reads only the caller's records (`test:assistant-boundary`). It never
  writes upstream.

## 9. Testing

| Layer | What runs | Where |
|---|---|---|
| Integration | Node suites run with `tsx`, one `test:*` script each; `npm run test:all` runs every non-browser suite | `tests/integration/`, `tests/run-all.mjs` |
| Live | Suites that assert governed writes against Neon; in CI `REQUIRE_LIVE=1` makes an unreachable database a failure, not a skip | `tests/integration/` via `tests/lib/live.mjs` |
| Browser, offline | Playwright suites that answer `/api/db` in the browser from fixtures — no credentials, no network. Each should claim its own dev-server port with `--strictPort` and check it found this app (§10) | `tests/ui/`, `tests/ui/db-stub.mjs` |
| Browser, deployed | The interaction suite and the walkthrough against a deployment (`E2E_UI_BASE`) | `tests/ui/` |
| CI | Typecheck, lint, build and `test:all`; the offline browser suites | `.github/workflows/ci.yml` |

A guard is trusted only after it has failed: each is checked by reintroducing
the defect it catches. The catalogue of suites, and what each covers, is the
[test playbook](testing/TEST_PLAYBOOK.md).

## 10. Known architectural gaps

- **Authentication and authorization** are deferred (§8).
- **Server handlers bypass the connector ports** (§4.4).
- **Workflow transitions, the sourcing award write-back and approval
  completion** are not yet all transactional and server-owned (R1 hardening,
  [the roadmap](roadmap/R1_BACKLOG_FIT_GAP.md#r1-hardening)). `api/workflow-action.ts`
  checks that the target stage exists, not that this request may go there, so
  a Kanban drag can move a request past its gates, forms and approvals.
- **Intake submit does not decide again.** `intake-submit` checks the buying
  channel against the channel vocabulary, recomputes the preferred-supplier
  override and the submission gaps, and derives the first stage from the stored
  workflows — but it stores the channel and the compliance record the browser
  computed. [AGENTS.md](../AGENTS.md) rule 3 asks the server to recompute from
  stored data, as the governed checkout does; closing it means running the
  routing and the determination under `api/` against the stored policy
  configuration (`api/_policy.ts`).
- **The audit log is not append-only.** `audit_entries` is reachable through
  `/api/db`, where a row can be updated or deleted by id, and nothing in the
  database refuses it.
- **Notifications have no recipient.** The `notifications` table has no user
  column, so every person sees one shared feed and *Mark all read* marks it read
  for everyone.
- **Time zones:** 33 `timestamp` columns across 20 tables are stored without a
  time zone, so every instant shifts by the reading client's UTC offset.
- **The live suites write to the shared database** — fixtures are cleaned up,
  but a run that dies midway leaves rows behind; a dedicated test branch would
  close that.
- **Nine browser suites still assume port 5173** without claiming it, so a
  second dev server there is tested instead of this app; six already claim
  their own.
