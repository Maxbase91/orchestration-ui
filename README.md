# Procurement Orchestration Platform

One front door for every procurement need, and the internal system of record behind it: a
requester says what they need, the platform works out what it is, checks the catalogue and existing
contracts first, decides how it will be bought, asks only what that route still needs, and runs the
request through approval, sourcing, ordering, receipt and invoice. A React single-page app on a
private Neon PostgreSQL database, with Vercel serverless functions.

**Live demo:** [orchestration-ui.vercel.app](https://orchestration-ui.vercel.app)

---

## Documentation

Each document owns one kind of fact; the others link to it rather than repeat it
([the full map](docs/README.md)).

| Read | For |
|---|---|
| [docs/PRD.md](docs/PRD.md) | What the platform is for, who uses it, its principles, and what Release 1 includes and leaves out |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it is built — the system, the one data path, the decision engines, configuration, AI, security, testing |
| [AGENTS.md](AGENTS.md) | The rules for working in this repo, and the Definition of Done |
| [Functional specification](docs/specs/functional-specification.md) and [requirements](docs/specs/requirements/) | What each screen does, in business terms, and the numbered requirements behind it |
| [The admin map](docs/specs/admin-map.md) | Every Admin item — what it is for, where it is stored, what reads it |
| [Test playbook](docs/testing/TEST_PLAYBOOK.md) | Every automated suite and what it covers, and the manual regression suites |
| [Roadmap](docs/roadmap/R1_BACKLOG_FIT_GAP.md) and [product backlog](docs/roadmap/PRODUCT_BACKLOG.md) | Where Release 1 stands, and the stories still to deliver |
| [Decisions](docs/adr/) | Why the non-obvious boundaries are where they are |

---

## Getting started

```bash
npm install           # dependencies
npm run dev           # dev server on http://localhost:5173
npm run build         # typecheck and production build
npm run lint          # lint — clean, and expected to stay that way
npm run preview       # serve the production build
```

The app reads its data through `/api/db`, a Vercel function, so a plain `npm run dev` shows the
screens without data. Run against a deployment, or use the browser suites' stub (see Testing).
Copy `.env.example` to `.env.local` for the live suites and the seed script.

`npm run lint` runs the React Compiler rules, which catch more than style: impure render, refs read
during render, state mirrored from server data by an effect, and manual memoization the compiler
cannot preserve (which silently disables optimization for the whole component). The compiler stops
analysing a file after a bailout, so fixing one finding often reveals others in the same file — a
falling count is progress, not regression.

## Testing

```bash
npm run test:all      # every non-browser suite — pass, skip and fail counted separately
npm run test:ui       # the New request browser smoke (Playwright — run `npx playwright install chromium` once)
npm run test:<suite>  # one suite
```

What every suite covers, how the browser suites run offline against a stub, and how to run them
against a deployment: [the test playbook](docs/testing/TEST_PLAYBOOK.md#the-automated-suites).

## Using the demo

Use the role switcher in the top-right corner to act as each persona. It is a presentation and
acceptance-testing mechanism, **not** authentication or authorization.

- **Service Owner** — requests and the actions waiting on them
- **Procurement Manager** — the full orchestration control tower
- **Vendor Manager** — validation queue and supplier compliance
- **Operations Lead** — workflow health, bottlenecks, SLA tracking
- **Supplier (External)** — the self-service portal, with its own layout
- **Admin** — the configuration

The database is pre-loaded with representative seed data. Seeding goes through **one**
authenticated route, `POST /api/admin/seed` with an `x-admin-secret` header (`ADMIN_SEED_SECRET`
below); typed local fixtures remain for the offline browser suites.

## Data maintenance

One-time data changes are idempotent scripts in `db/backfills/`, never tests:

```bash
npm run backfill:compliance       # one-time data migration, NOT a test — fills the front-door
                                   # determination fields on application-owned `requests` rows that predate
                                   # them, using the same decisioning logic live intake runs.
                                   # Only ever fills nulls; safe to re-run.
npm run backfill:intake-compliance # restores the 39 intake_compliance_records rows the cutover's
                                   # copy list omitted. Every statement is ON CONFLICT DO NOTHING.
npm run purge:ui-e2e              # remove retained UI-E2E-* lifecycle records (dry run; --apply to delete)
npm run backfill:neon-catalogue-governance # idempotent repair when the migrated data predates the
                                           # explicit catalogue contract/risk columns.
npm run backfill:c10-debris       # removes configuration nothing reads: the nine `sla_targets`
                                   # stage rows (the template owns stage SLAs, and they disagreed
                                   # with it in six of nine), `routing_rules.match_count` (seeded,
                                   # incremented by nothing), and the 114 requests with no
                                   # `workflow_template_id` — each assigned the template that claims
                                   # its channel, then re-dated from that template's node.
                                   # Idempotent; add --dry-run to report only.
npm run backfill:conversation-titles # names each stored assistant conversation after its first question
                                   # (they all read "New conversation"). Idempotent; --dry-run.
npm run backfill:knowledge-base-topics # gives every knowledge-base entry a topic and order (fill-only)
                                   # and adds the Help page's six rewritten articles (KB-032…037).
npm run backfill:service-description-and-forms # stores the built-in service description as the
                                   # `default` row (fill-only), and deletes the three forms that
                                   # never rendered (FORM-001/007/008) with their seeded submissions,
                                   # unless an admin has switched one on. Idempotent; --dry-run.
```

The schema is `db/schema.sql`, applied to Neon by `db/migrations/apply-neon-schema.mjs` (see its
README).

---

## Deployment

A push to `main` deploys to Vercel: the single-page app, and the serverless functions in `api/`
(capped at 12 by the Hobby plan — [ARCHITECTURE.md §2](docs/ARCHITECTURE.md#2-runtime-and-deployment)).
`vercel.json` routes the low-volume endpoints through `/api/db` before its SPA fallback.

### Environment variables

Set these in **Vercel → Settings → Environment Variables** (all environments) before deploying.
Full descriptions live in `.env.example`.

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `VITE_PROCUREMENT_PROFILES_ENABLED` | Browser | No | Defaults to on; set `false` only for a deployment whose schema predates the profile table |
| `NEON_DATABASE_URL` | Serverless (`api/`) | **Yes** | Private Neon connection string; never expose with `VITE_` |
| `ADMIN_SEED_SECRET` | Serverless (`api/`) | Only for seeding | Shared secret for `api/admin/seed.ts` |
| `VITE_ASSISTANT_PROVIDER` | Browser | No | `groq` (default) or `mock` for a fully offline assistant |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | Serverless (`api/`) | For AI classification and assistant | Server-side only. Five routes use them, all through `api/_llm.ts`: `api/chat.ts`, `api/ai.ts`, `api/chat-intake.ts`, `api/generate-sow.ts` and the rerank in `api/_domains/contract-match.ts` |
| `GROQ_MODEL` | Serverless (`api/`) | No | Overrides the **single-shot** Groq model (default `openai/gpt-oss-20b`) used by every route except the assistant. The assistant's tool-calling model (`openai/gpt-oss-120b`) is pinned in code and has no override — see AGENTS.md rule 5 (CLS-G0) |

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
