# Project instructions — Procurement Orchestration Platform

Guidance for any agent working in this repo. These are the project's ground rules; follow them on
every task. They override general defaults where they differ.

## What this is
A standardised procurement orchestration platform: a **front door** (intake → classify → recommend →
route) plus an **internal AI assistant**. React SPA on a private Neon PostgreSQL store, building toward the R1 scope captured
in `docs/roadmap/R1_BACKLOG_FIT_GAP.md`. This repo is the **foundation for R1**, not a throwaway prototype.

---

## Ground rules (non-negotiable)

### 1. Standardised & white-label
Build a **reusable product**, not a client- or industry-specific build. Do **not** reference any
organisation name or sector (no client identifiers, no financial-services framing) in code, naming,
labels, knowledge-base content, or docs. Generalise client/sector terms — e.g. a *category taxonomy*
(not a client code set), a *third-party risk register*, a *regulatory / materiality flag*. Vendor
product names used as integration targets (Ariba, Coupa, ServiceNow, Sirion, SAP) are acceptable.

### 2. Own the data, defer the connections
There are **no live upstream connections** in this release. The platform holds the equivalent data in
its **own store** — a **private Neon PostgreSQL database**, the system of record — and reads every
upstream object through the standardised **source-connector layer** (`src/lib/integrations`), never by
calling a live system directly. A live connector can replace the own-store one for any object type with
**no change at the call site**. When adding a new upstream object, add an own-store connector behind
the ports; do not bypass them.

The browser never holds a database credential: it posts to the allowlisted `/api/db` boundary and
`src/lib/db-client.ts` is the one client. **Do not reintroduce a second data path.** Dev and
production ran different clients once, so nothing tested what production executed, and three defects
reached users that no local check could reproduce.

**Known gap:** the server-side handlers (`src/server/api/*`, `api/governed-checkout.ts`) read with raw
SQL rather than through the connector ports, because the port layer is browser-shaped
(TanStack hooks) and has no server-side factory. Closing that is real work, not a licence to add more
direct reads.

### 3. Scope boundary — own the internal record, defer upstream execution
The front door **classifies, recommends, routes and then creates the internal record**. It owns the
request → purchase requisition → internal purchase order chain in its own store, along with workflow,
sourcing, supplier, contract, risk and audit records.

It does **not** write to **upstream** systems — ERP, CLM, payment, supplier-network or risk-provider.
Those are R2, and the connector layer is the seam for them. For an upstream action the user goes
through a **deep-link**; the assistant **proposes** with confirm-before-act and never executes an
upstream write.

> This supersedes the earlier R1 rule that the determination screen was the endpoint. Governed
> catalogue and contract checkout (`api/governed-checkout.ts`, ADR-0002) creates internal records, and
> the boundary now sits between the platform's own store and everything outside it. A write to the own
> store is in scope; a write that leaves the platform is not.

Anything that creates a record must be **server-authoritative**: recompute the decision from stored
data, treat the client's version as advisory, and make the write idempotent. And never record a check
that did not run — a `pass` written for a screening nobody performed is worse than no record at all.

### 4. Definition of Done — docs and tests ship with the change
A change is not done until **all** of these hold (state explicitly if you deliberately skip one and why):

1. **Builds clean** — `npx tsc -b` passes (it covers `src`, `api/` and the vite config) and
   `npm run lint` is clean for touched files.
2. **Tested** — add/extend an integration test under `tests/integration/*.mjs`, register a `test:*`
   script in `package.json`, and run it green. **For changes that touch UI** (components, wizard
   steps, pages), also run the browser smoke `npm run test:ui` (Playwright) and extend it to cover the
   new surface — a green `tsc`/`build` proves compilation, not that the screen renders or works.
3. **Documented** — update every doc the change touches:
   - the module's own `README.md` (e.g. `src/lib/integrations/README.md`);
   - the root `README.md` — capabilities, **Project Structure**, and the **Testing** script list;
   - `docs/testing/TEST_PLAYBOOK.md` — the suite/scope for the area;
   - `docs/roadmap/R1_BACKLOG_FIT_GAP.md` — the capability matrix; update the affected row when a gap
     closes, and the story status in `docs/roadmap/R1_STORY_FIT_GAP.md` if the change closes a
     tracked story.

---

## Tech stack
- **Frontend:** React 19 + Vite 8, TypeScript 6 (strict; `noUnusedLocals`/`noUnusedParameters`),
  React Router 7, Tailwind 4, shadcn/ui, Zustand 5, TanStack Query 5. (Forms are
  plain controlled components — React Hook Form and Zod were listed here but
  never imported anywhere, and have been removed from the dependencies.)
- **Backend:** private **Neon** PostgreSQL — schema in `db/schema.sql` (applied to Neon by
  `db/migrations/apply-neon-schema.mjs`); Vercel serverless functions in `api/`, capped at
  **12** by the Hobby plan and guarded by `test:vercel-functions`. There is one database and no
  provider switch.
- **AI:** assistant via `api/chat.ts` using **Groq + Gemini** (the governed providers — free tier,
  already connected). **Model selection is governed (CLS-G0):** keep Groq + Gemini; do **not**
  add a paid provider (e.g. Claude) or any new model provider without explicit approval.

## Commands
```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # tsc -b && vite build
npm run lint           # eslint .
npx tsc -b             # typecheck only (fast DoD gate)
npm run test:<suite>   # integration tests — see package.json "test:*"
```
Env vars are documented in `.env.example` (the Neon connection + AI provider keys). Never commit secrets or log
tokens/PII; sensitive output (e.g. banking/payment fields) is masked by default and shown only to
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
- **Git:** conventional commits (`feat:`/`fix:`/`refactor:`/`test:`/`docs:`/`chore:`); `main` stays
  deployable; run the relevant `test:*` before committing. Commit/push only when asked.

## Source-of-truth docs
See `docs/README.md` for the full map (specs / roadmap / testing / archive). Key ones:
- `docs/roadmap/R1_BACKLOG_FIT_GAP.md` — capability roadmap and current position (what to build next),
  with the per-story detail and `POL-xx` policy defaults in `docs/roadmap/R1_STORY_FIT_GAP.md`.
- `docs/testing/TEST_PLAYBOOK.md` — full test scope (manual suites + automated `test:*`).
- `src/lib/integrations/README.md` — the connector layer and the live-swap seam.
- `docs/specs/functional-specification.md`, `docs/specs/design-document.md` — feature + UX spec.
