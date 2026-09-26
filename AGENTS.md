# Agent instructions — Procurement Orchestration Platform

The rules for any agent, or person, working in this repository. Follow them on every task; they
override general defaults where they differ. This is the one rulebook: other agents read this file
directly, and Claude Code loads it through the import in `CLAUDE.md`.

**Read first:** [docs/PRD.md](docs/PRD.md) — what the platform is and what Release 1 includes —
and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it is built. Which document owns which kind
of fact: [docs/README.md](docs/README.md).

This repo is the **foundation for Release 1**, not a throwaway prototype.

---

## Ground rules (non-negotiable)

### 1. Standardised & white-label
Build a **reusable product**, not a client- or industry-specific build. Do **not** reference any
organisation name or sector (no client identifiers, no financial-services framing) in code, naming,
labels, knowledge-base content, or docs. Generalise client/sector terms — e.g. a *category taxonomy*
(not a client code set), a *third-party risk register*, a *regulatory / materiality flag*. Vendor
product names used as integration targets (Ariba, Coupa, ServiceNow, Sirion, SAP) are acceptable.

### 2. Own the data, defer the connections — one data path
There are **no live upstream connections** in this release. The platform holds the equivalent data in
its **own store** — the private Neon PostgreSQL database, the system of record — and reads every
upstream object through the **source-connector layer** (`src/lib/integrations`), never by calling a
live system directly. A live connector can replace the own-store one for any object type with **no
change at the call site**. When adding a new upstream object, add an own-store connector behind the
ports; do not bypass them.

The browser never holds a database credential: it posts to the allowlisted `/api/db` boundary and
`src/lib/db-client.ts` is the one client. **Do not reintroduce a second data path.** Dev and
production ran different clients once, so nothing tested what production executed, and three defects
reached users that no local check could reproduce.

The server handlers (`api/_domains/*`, `api/governed-checkout.ts`) read with SQL rather than through
the ports — a known gap ([ARCHITECTURE.md §4.4](docs/ARCHITECTURE.md#44-the-source-connector-layer)).
Closing it is real work, not a licence to add more direct reads.

### 3. Own the internal record, defer upstream execution — and record honestly
The front door **classifies, recommends, routes and then creates the internal record**. It owns the
request → purchase requisition → internal purchase order chain in its own store, along with workflow,
sourcing, supplier, contract, risk and audit records.

It does **not** write to **upstream** systems — ERP, CLM, payment, supplier-network or risk-provider.
Those are Release 2, and the connector layer is the seam for them. For an upstream action the user
goes through a **deep-link**; the assistant **proposes** with confirm-before-act and never executes an
upstream write. A write to the own store is in scope; a write that leaves the platform is not
([ADR-0002](docs/adr/0002-governed-catalogue-checkout.md)).

Anything that creates a record must be **server-authoritative**: recompute the decision from stored
data, treat the client's version as advisory, and make the write idempotent. And never record a check
that did not run — a `pass` written for a screening nobody performed is worse than no record at all.

### 4. Configuration, not code
Every number a decision compares against is a **governed threshold** (Admin → Decisioning
thresholds). Routing rules, approval-chain bands, workflow branches, forms and knowledge-base
articles **name** it as `policy:<key>`; they never restate it, and neither does code. Each
configuration surface has **one job**, and no surface restates a fact another owns
([ARCHITECTURE.md §6](docs/ARCHITECTURE.md#6-configuration), [the admin map](docs/specs/admin-map.md)).

Do not hardcode what an administrator would expect to change, and do not keep configuration that
nothing reads. A built-in default is a floor for an unreadable table, never the configuration.

### 5. AI models are a governed product decision (CLS-G0)
Groq and Gemini are the only providers, and every model call goes through **one** helper,
`api/_llm.ts`. The model ids pinned there — `GROQ_TOOL_MODEL` for the assistant, which needs
tool-calling; `DEFAULT_GROQ_MODEL` for the single-shot callers; `GEMINI_MODEL` as the fallback — are a
product decision, not an implementation detail. Do not add a provider (Claude, OpenAI, a cloud model
gateway, …), and do not change a model id — *including swapping one Groq model for another* — without
explicit approval. Only `GROQ_API_KEY` and `GEMINI_API_KEY` are provisioned; anything else needs a
commercial decision first. Standing instruction: run the **latest free** model on each provider;
`npm run test:models` prints what each currently serves.

Only the single-shot model has an environment override (`GROQ_MODEL`), deliberately, so a deployment
cannot change the assistant's model without a code review. There were two copies of the model helper
until 2026-09-12, silently on different models; keep it at one.

**When a model is retired** — Groq does this on a rolling schedule — the retired id returns **404**
from the chat-completions endpoint, which reads like an outage rather than a config problem. Check the
model id before debugging the network. The fix is one line in `api/_llm.ts` plus the matching
assertion in `tests/integration/ai-api-configuration.mjs`, and it is still a CLS-G0 change: raise
it, do not swap the id quietly. `GROQ_MODEL` is the deploy-time escape hatch for the single-shot model
while approval is pending.

### 6. Definition of Done — docs and tests ship with the change
A change is not done until **all** of these hold (state explicitly if you deliberately skip one and why):

1. **Builds clean** — `npx tsc -b` passes (it covers `src`, `api/` and the vite config) and
   `npm run lint` is clean for touched files.
2. **Tested** — add/extend an integration test under `tests/integration/*.mjs`, register a `test:*`
   script in `package.json`, and run it green. **For changes that touch UI** (components, pages),
   also run the browser smoke `npm run test:ui` (Playwright) and extend it to cover the new surface —
   a green `tsc`/`build` proves compilation, not that the screen renders or works. A new guard is
   trusted once it has failed: reintroduce the defect it catches and watch it go red.
3. **Documented** — update the home of every fact the change touches (each document's job is in
   [docs/README.md](docs/README.md)):
   - the module's own `README.md` (e.g. `src/lib/integrations/README.md`);
   - `docs/ARCHITECTURE.md` — when the architecture changes: a module or decision engine, a function
     or route, the data path, a configuration surface, an external dependency, a known gap;
   - `docs/PRD.md` — when the scope or a principle changes;
   - `docs/specs/functional-specification.md` and the matching `docs/specs/requirements/NN-*.md` —
     when what a user sees or can do changes; `docs/specs/admin-map.md` for an Admin item;
   - `docs/testing/TEST_PLAYBOOK.md` — the area's suites and scope, and **every new `test:*` script
     in its catalogue** (`test:workflow-scripts` fails otherwise);
   - `docs/roadmap/R1_BACKLOG_FIT_GAP.md` — the capability matrix row when a gap closes, and the story
     status in `docs/roadmap/R1_STORY_FIT_GAP.md` if the change closes a tracked story;
   - the root `README.md` — only when setting up, the commands, environment variables or deployment
     change.
4. **Commented** — see Conventions.

---

## Commands
```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # tsc -b && vite build
npm run lint           # eslint .
npx tsc -b             # typecheck only (fast gate)
npm run test:<suite>   # one suite — the catalogue is in docs/testing/TEST_PLAYBOOK.md
npm run test:all       # every non-browser suite
npm run test:ui        # the New request browser smoke
```
Setting up, environment variables and deployment: [README.md](README.md). Never commit secrets or
log tokens/PII; sensitive output (e.g. banking/payment fields) is masked by default and shown only to
entitled roles.

## Conventions
- **Data access:** `src/lib/db/<entity>.ts` (functions) + `src/lib/db/hooks/use-<entity>.ts`
  (TanStack Query). Domain types in `src/data/types.ts`.
- **Upstream reads:** through `src/lib/integrations` ports only (see its README + the live-swap seam).
- **Code:** TypeScript strict, **no `any`** unless justified; **named exports** over default;
  co-locate component, types, and tests.
- **Comments (required, part of Definition of Done):** every non-trivial file (≈30+ code lines)
  starts with a short **header comment** saying what the module is and where it fits (1–3 lines);
  every piece of **non-obvious logic** (business rules, thresholds, workarounds, ordering
  constraints, gotchas) gets a **why-comment**. Comments explain *why*, not *what* — do **not**
  narrate obvious code, and never leave a TODO without explaining it. A change that adds or edits
  an uncommented non-trivial file is not done until the comments are in.
- **Errors:** internals never reach users — no stack traces or database messages. Log the detail
  server-side and return `{ "error": "message", "code": "error_type" }`; a screen says what failed,
  and the console carries why.
- **Database:** migrations are backward compatible — add columns nullable or with defaults, deploy,
  backfill, then add constraints; never rename or drop in a single step. A data change is an
  idempotent script in `db/backfills/`.
- **Git:** conventional commits (`feat:`/`fix:`/`refactor:`/`test:`/`docs:`/`chore:`); `main` stays
  deployable; run the relevant `test:*` before committing. Commit/push only when asked.
