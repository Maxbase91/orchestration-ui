# Project instructions — Procurement Orchestration Platform

Guidance for any agent working in this repo. These are the project's ground rules; follow them on
every task. They override general defaults where they differ.

## What this is
A standardised procurement orchestration platform: a **front door** (intake → classify → recommend →
route) plus an **internal AI assistant**. React SPA + Supabase, building toward the R1 scope captured
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
its **own store** (the system of record) and reads every upstream object through the standardised
**source-connector layer** (`src/lib/integrations`) — never by calling a live system directly. A live
connector can replace the own-store one for any object type with **no change at the call site**. When
adding a new upstream object, add an own-store connector behind the ports; do not bypass them.

### 3. R1 scope boundary — read & route, do not execute
The front door **classifies, recommends and routes**. In R1 it does **not** write to upstream systems:
the user acts through **deep-links**, and the **determination screen is the endpoint**. The assistant
**proposes** actions with confirm-before-act; it does not execute upstream writes. Do not build live
writes/execution unless a task explicitly moves that boundary.

### 4. Definition of Done — docs and tests ship with the change
A change is not done until **all** of these hold (state explicitly if you deliberately skip one and why):

1. **Builds clean** — `npx tsc -b` passes (and `npm run lint` is clean for touched files).
2. **Tested** — add/extend an integration test under `tests/integration/*.mjs`, register a `test:*`
   script in `package.json`, and run it green. **For changes that touch UI** (components, wizard
   steps, pages), also run the browser smoke `npm run test:ui` (Playwright) and extend it to cover the
   new surface — a green `tsc`/`build` proves compilation, not that the screen renders or works.
3. **Documented** — update every doc the change touches:
   - the module's own `README.md` (e.g. `src/lib/integrations/README.md`);
   - the root `README.md` — capabilities, **Project Structure**, and the **Testing** script list;
   - `docs/testing/TEST_PLAYBOOK.md` — the suite/scope for the area;
   - `docs/roadmap/R1_BACKLOG_FIT_GAP.md` — flip the affected roadmap story/epic status when a gap closes.

---

## Tech stack
- **Frontend:** React 19 + Vite 8, TypeScript 6 (strict; `noUnusedLocals`/`noUnusedParameters`),
  React Router 7, Tailwind 4, shadcn/ui, Zustand 5, TanStack Query 5, React Hook Form 7 + Zod 4.
- **Backend:** Supabase (Postgres) — schema in `supabase/schema.sql`; Vercel serverless functions in `api/`.
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
Env vars are documented in `.env.example` (Supabase + AI provider keys). Never commit secrets or log
tokens/PII; sensitive output (e.g. banking/payment fields) is masked by default and shown only to
entitled roles.

## Conventions
- **Data access:** `src/lib/db/<entity>.ts` (functions) + `src/lib/db/hooks/use-<entity>.ts`
  (TanStack Query). Domain types in `src/data/types.ts`.
- **Upstream reads:** through `src/lib/integrations` ports only (see its README + the live-swap seam).
- **Code:** TypeScript strict, **no `any`** unless justified; **named exports** over default;
  co-locate component, types, and tests; comments explain *why*, not *what*.
- **Git:** conventional commits (`feat:`/`fix:`/`refactor:`/`test:`/`docs:`/`chore:`); `main` stays
  deployable; run the relevant `test:*` before committing. Commit/push only when asked.

## Source-of-truth docs
See `docs/README.md` for the full map (specs / roadmap / testing / archive). Key ones:
- `docs/roadmap/R1_BACKLOG_FIT_GAP.md` — Release-1 capability roadmap + fit/gap (what to build next).
- `docs/testing/TEST_PLAYBOOK.md` — full test scope (manual suites + automated `test:*`).
- `src/lib/integrations/README.md` — the connector layer and the live-swap seam.
- `docs/specs/functional-specification.md`, `docs/specs/design-document.md` — feature + UX spec.
