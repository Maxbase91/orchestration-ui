# Release 1 — story-level fit/gap and policy defaults

> For the delivery-ready view of the same ground — user stories with
> acceptance criteria, grouped by feature, with the rules and modules behind
> each — see [PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md).

**Status:** traceability record. The living summary is
[`R1_BACKLOG_FIT_GAP.md`](R1_BACKLOG_FIT_GAP.md); this is the story detail behind it.

> **Why this file exists.** `R1_BACKLOG_FIT_GAP.md` was rewritten from 424 lines to a 90-line
> capability matrix. The matrix is a better status report, but it dropped the per-story fit/gap
> (123 story ids) and the `POL-xx` decision table — and **111 references across the repo point at
> those ids**: commit messages, `TEST_PLAYBOOK.md` cases, and code comments. CLAUDE.md's Definition
> of Done still says to "flip the affected roadmap story/epic status when a gap closes", which was
> not possible with nothing left to flip.
>
> **Read the statuses as of the rewrite (30 August 2026), not as of today.** They were accurate when
> written and have not been re-audited since; several were closed by the work that followed. Treat a
> status here as a starting point to verify, and the capability matrix as the current position.
>
> The `POL-xx` table below is different: those are **policy decisions and seed-config
> specifications** — thresholds, matching rules, masking behaviour — not statuses. They had no other
> home in the repository and are restored verbatim.

---

## 4. Story-level fit/gap

### Cluster: Foundation & Platform

#### CFG — Configuration & Reference-Data Framework — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| CFG-01 | Routing & threshold rule engine | 🟢 | `evaluate-routing-rules.ts` real; **risk- and materiality-aware**. **All decisioning thresholds centralised** in `lib/procurement/policy-config.ts` and **admin-editable** via `/admin/thresholds` — the config-aware decisioning functions default to the active config, so admin edits **drive the live front door** (persisted; applied on boot). **The engine is now as capable as its editor.** The editor offered three fields (`contractId`, `riskLevel`, `region`) and three operators (`contains`, `is_empty`, `is_not_empty`) the evaluator did not implement; an unrecognised field or operator returned `false`, and because a rule requires `conditions.every(...)`, one unrecognised condition silently killed the whole rule. All ten fields and ten operators now evaluate, and an unusable rule produces a **diagnostic** rendered on `/admin/rules` instead of quietly never firing. Live proof it mattered: **RR-001** was active, first in evaluation order, described as routing software over €100k to procurement-led, and carried `match_count: 42` — all three conditions were false and it had never matched (repaired in `db/backfills/2026-08-28-rr001-repair.sql`; the live audit now reports 0 active rules with an unimplemented field or operator, and a rule fires for 49 of the demands in the store). The channel is also **shown four steps earlier**, on the pre-check, resolved by `lib/routing/demand-channel.ts` — the one function the determination calls too |
| CFG-02 | Approval-chain & threshold-band config | 🟢 | Editor + `approval_chains` table exist. The wizard now persists the selected value band's actual `approval_chains.id` (not a routing role label), matching the request-column foreign key; `test:approval-chain-persistence` proves the write and cleanup end-to-end |
| CFG-03 | Taxonomy & category reference management | 🟡 | **Canonical taxonomy seeded & live** in the `procurement_categories` store (wizard reads it, admin edits it) + **configurable icons**. Pure-data/icons split keeps the server seed clean. Org-specific code scheme still pending |
| CFG-04 | PSL & competitive sourcing rule management | 🟡 | Competitive-sourcing threshold + min-quotes + preferred-supplier performance bar centralised in `policy-config.ts` (tunable via `resolvePolicyConfig`); hard PSL reference list + admin editor still pending |
| CFG-05 | Catalogue source & link-out config | 🟡 | Catalogue seed only; no source-type/link-out config |
| CFG-06 | Risk-reuse & contract-reuse criteria config | 🔴 | Only a `reusable` boolean on seed rows |
| CFG-07 | KB content management w/o change request | 🟢 | `kb-admin-page.tsx` CRUD to the own store |
| CFG-08 | Config test & simulation panel | 🟢 | Routing-rules 3-panel tester + **Decisioning Thresholds admin page** (`/admin/thresholds`): edit every threshold, **Save applies to the live front door** (persisted, re-applied on boot), Reset to defaults, and a **live simulation** previews a sample demand's materiality / inherent risk / approval gate under the edited values before saving. **The rule tester now tests what runs**: it called its own evaluator — which implemented `contractId` and `is_empty` while production ignored them — so it could confirm a rule that never fired. It calls `evaluateRoutingRules` now, takes priority and commodity code as inputs, and marks unfireable rules in its coverage list (`test:routing-rule-integrity`) |
| CFG-09 | **Prompt & generated-output configuration** | 🟢 | `/admin/service-description` + `service_description_templates` — the first admin-editable prompt in the platform. Configures the generation prompt (guidance, system prompt, temperature, token budget, with a preview of the **assembled** prompt), the components asked at intake, the generated sections and narrative composition, and the downstream seeds (sourcing requirement sections + default evaluation criteria). Per category with a `default` fallback and a built-in fallback beneath that, so the table can be empty and nothing changes. Every other prompt in `api/*` is still a code constant |
| CFG-11 | **Conditional section requirements** | 🟢 | `ConfiguredSection.requiredWhen` on the service-description template: what a description MUST cover is decided by the demand's materiality, inherent risk, data sensitivity and sourcing, using the `{field, operator, value}` vocabulary already shared with routing rules and form triggers. Editable at `/admin/service-description`; an unknown signal makes a condition false, so an undetermined demand cannot manufacture a requirement |
| CFG-10 | **Catalogue eligibility per category** | 🟢 | `procurement_categories.catalogue_eligible` + a toggle on Admin → Categories, gating the intake funnel's catalogue stage. Defaults **false** for a new or unmapped category: a missed catalogue suggestion costs one click, a false one sends a consulting demand to business cards. Match thresholds sit in `policy-config.ts` beside the other decisioning thresholds and are editable at `/admin/thresholds` |
| CFG-D0/3/5 | Architecture decisions / ring-fencing / scale | 🔴 | Not formalised |
| CFG-G3 | KB governance & sign-off | 🟡 | KB editable; no sign-off workflow |
| CFG-W0 | Config service skeleton & rule schema | 🟡 | Routing schema exists; reference-data schema gaps |

#### SRC — Reference Data Shadow & Fast Store (GCP) — 🔴 Gap
All stories (SRC-01..05, DEC-2): no GCP/BigQuery shadow; data is seeded into the own store. **R1 re-scope:** build
these as the **own-DB shadow / fast store** (system of record) per §2.

#### CON — Real-Time Source Connectors (MCP) — 🟡 Partial (foundation built)
CON-01 (Ariba), CON-03 (ServiceNow), DEC-1 (MCP pattern): mock status records only. **R1 re-scope:**
express as **own-store read ports** behind the connector interface; live/MCP is a future swap.
**Done (WS-0 + WS-B breadth):** the standardised connector layer is in place —
`src/lib/integrations/{ports,registry}.ts`, `own-store/factory.ts`, `useSourceObject`/`useSourceList`
hooks, the documented live-swap seam (`src/lib/integrations/README.md`), and own-store connectors for
**eight objects** (supplier, contract, purchase-request, purchase-order, invoice, risk-assessment,
catalogue-item, **payment** — supplier banking/payment master, a vendor-data foundation behind the
ports); covered by `npm run test:connectors` (drift guard pins the object set).
**Consumers routed:** the front-door catalogue + contract checks (`step-buy-route.tsx`), the
supplier/contract reads in `step-compliance.tsx` (`useSourceData`), and the **assistant lookups**
(`src/lib/assistant/capabilities/lookup.ts` now reads suppliers/requests/contracts/POs/invoices/risk
through `requireConnector(...)` — so the chatbot and front door share one governed source).
**Remaining:** connectors for objects without an own-store read module yet (risk-screening,
category-taxonomy, form-submission); routing **risk reuse-matching** through the ports
(needs validity-window query support — WS-C) and the **server-side** assistant path (`api/chat.ts`
needs a server connector variant — WS-E).

#### UX — Design System & User Journeys — 🟢 Built
UX-01 component library 🟢; UX-02 journeys 🟢 (**dual-mode requester experience** — adaptive Simple intake and requester dashboard alongside the retained Expert deep links; pilot-gated per user/role); DEC-7 env/rollback 🟡.
**UX-04 one configurable home 🟢** — the four selectable home designs are **withdrawn and deleted** (`home-designs/`, the switcher, the `homeDesign` preference nothing read, and `test:home-designs`): four layouts of the same data meant four places for a widget to be missing, and users met an inconsistent navigation depending on which one they had picked. There is now one home, configured rather than swapped — each role opens on a default layout that covers its work (including purchase orders, invoice exceptions, supplier onboarding and requests by stage), and the widgets a user adds, removes or reorders **persist** across reloads (`stores/dashboard-store.ts`, `test:dashboard-widgets`, `test:dashboard-ui`).

#### PLT — Sourcing/Award/Contract handoff — 🟢 Built (scope boundary moved, deliberately)

Previously an R2 stub marked *out of R1 scope*. Sourcing execution now runs end to end **inside the
platform's own store**: an event is raised from a request, suppliers are invited from the directory,
they respond in the portal, the buyer scores the responses against the event's weighted criteria,
and the **award writes the winning supplier back onto the request** and closes the event. This is
not an upstream write — `sourcing_events`/`sourcing_responses` are the system of record — so ground
rule 2 is intact, but it does move the "determination screen is the endpoint" line in ground rule 3.

**Two consequences worth recording explicitly**, because they change behaviour beyond one screen:

1. **The sourcing stage now gates the workflow.** `workflow/engine.ts` suspends the instance on
   entering `sourcing` (symmetric with the existing approval gate) and the award resumes it with
   outcome `'awarded'`. Before this the engine walked straight through to contracting, so an event
   raised at that stage could never be concluded. A request's only exits from `sourcing` are an
   award or a cancellation — there is deliberately no "skip sourcing" action in R1.
   Note the award moves the request on by **two** paths: it resumes the workflow instance
   where one exists, and otherwise writes `contracting` directly. The fallback is the
   common case, not the edge case — only requests created since the engine began
   instantiating workflows have an instance, so without it an award would close the event,
   write the supplier, and still leave the request parked in `sourcing`.
2. **The award write-back is not transactional.** It spans `sourcing_responses`, `sourcing_events`
   and `requests` with no transaction, so it commits the irreversible flag first and keeps the tail
   replayable; a half-applied award is detected on the event page and repaired by **Re-apply award
   to request**. A serverless action beside `api/workflow-action` is the real fix and stays open.

**Reporting now matches reality.** "Active Sourcing" on the manager dashboard and the pipeline
analytics page counted *requests* with `status='sourcing'` while `sourcing_events` fed no metric at
all — so the tile reported demand waiting to be sourced and labelled it sourcing activity. Both now
count live events. The `/pipeline/sourcing` page likewise read a hardcoded `SE-*` array, the third
mock id universe for one concept; it reads the same events as the register.

**Backfill (run once, 2026-08-27, recorded in `db/backfills/`).** Six requests had entered the
sourcing stage before an event could be raised from one. Each now has a linked draft event seeded
from the request, with the incumbent supplier invited where named. Criteria and requirements were
deliberately left empty rather than invented — fabricating them would fabricate the basis of a future
award. The one pre-launch orphan event was **cancelled, not deleted**: it had no request, criteria or
invitations, and would otherwise have shown in the Evaluation Centre as open with nothing in it.

**Events now start from the demand, not from blank.** An event raised from a request seeds its
`requirements` from the service description's configured sections (labelled, empty sections skipped)
and its `criteria` from the template's defaults, instead of arriving empty while the dialog told the
buyer to "add requirements, criteria and suppliers before publishing". Which sections seed and what
the default criteria are is set in `/admin/service-description` (CFG-09). The evaluator still edits
everything and the weights must still total 100 — the seed is a starting point, not a decision.

**Still out of scope:** no contract or PO is auto-created on award (the existing PO action covers
the next step), and no outbound email — invitations are in-app plus a notification row. The Q&A
board on the event page remains a labelled mock.

### Cluster: Front Door

#### INT — Front Door, Intake & Landing — 🟢 Built (strongest area)
| Story | Summary | State | Note |
|---|---|---|---|
| INT-01 | Role-based landing page | 🟢 | 5 role dashboards |
| INT-02 | Light intake | 🟢 | **Free text is the only commodity entry — there is no category selection.** Commodity categories (Goods/Services/…) are derived metadata, not a user choice; the fulfilment path (catalogue / contract / full request) is derived by the funnel. The catalogue is the one explicit alternative entry (INT-10). **Requester context** (`requester-context-block.tsx`) is established up front for every path: the **requester's country is auto-derived from their profile** (read-only — structured `country`/`countryCode` to drive country workflows later) and the **beneficiary defaults to self** (never asked) with a name type-ahead to buy on behalf of another directory user. Both are carried onto the request and surfaced on the determination/overview |
| INT-03 | Full service description + quality gates | 🟡 | **Unified, auto-composed capture** — the chat builds one service description (request key facts + SOW elements in one panel, no separate Summary/SOW tabs and **no manual "Generate SOW" button**); the conversation asks until all components are captured, then the document is **composed automatically** (quality score shown). The conversation is now **dynamic / answer-driven** — a pure slot-filling engine (`src/lib/procurement/demand-conversation.ts`) computes the next question from prior answers, **carries everything forward** (never re-asks), and **branches on category + value** (high-value consulting also asks timeline / acceptance / pricing / dependencies; a low-value goods order is asked only the essentials). The same engine drives both the LLM endpoint and the offline fallback (`test:demand-conversation`). Inline-editable; graceful offline. The **critical-service qualification already feeds materiality** (via the criteria-triggered mini-IRQ delta → `determineMateriality`); parsing richer free-text "how it qualifies" from the SD is the remaining bit **The whole description is now admin-configurable** via `/admin/service-description` (`service_description_templates`, per category with a `default` fallback): the generation prompt and model params, the components asked (the slot set serialised, with `appliesWhen` as a `{field, operator, value}` condition instead of a closure), and what is generated (the detailed sections, asked vs inferred, and which compose the compact narrative). Read server-side by `api/generate-sow.ts`, so an edit takes effect without a redeploy — the reason it is a table and not a settings store (`PolicyConfig` is localStorage-only and never reaches a serverless route). **The conversation itself now runs off the template too** — `demand-conversation.ts` takes its slot set from the resolved config, so *what is asked* is admin-editable and not only *what is generated* (168 agendas verified identical to the built-in). **Generation is signal-aware**: `demand-signals.ts` computes the capture-time materiality / inherent-risk / data-sensitivity / sourcing read and passes it to the model, and `ConfiguredSection.requiredWhen` says which sections that read makes mandatory — a material, competitively-sourced engagement must cover scope, deliverables and measurable acceptance criteria; a small order need not. The determination reports missing required sections rather than regenerating. `quality_score` / `quality_checks` are finally persisted (they were computed, rendered and discarded, so the badge never appeared). **The conversation now finishes, and says so.** Progress is measured against the questions this demand is actually asked (`conversationProgress`) rather than a fixed 14, which capped a fully-answered conversation at 57–86% and listed items that were never going to be asked; the panel's section list comes from the resolved template, with `asked: false` sections shown as **inferred** rather than outstanding; **step 3 will not release until the mandatory floor is met** — `requiredSlotsFilled` was defined as the guarantee against an LLM short-circuiting the conversation and was never consulted at the gate, which needed only a title and a value; conditional questions carry a configurable **"Asked because…"** rationale; and the close states what was captured and where it is reused (`test:intake-guidance`). |
| INT-04 | Draft save & resume | 🟢 | Saves draft to the own store |
| INT-05 | Edit in-flight demand | 🟡 | Partial |
| INT-06 | Demand validation — permissibility/prohibited | 🟡 | Some policy checks hardcoded |
| INT-07 | Status tracking | 🟢 | Stage history tracked |
| INT-08 | Notifications & actions-required | 🟢 | Notification feed |
| INT-09 | Show existing info, structured & exportable | 🟡 | Feeds the determination endpoint; export to confirm |
| INT-B0/1/3/7, DEC-4 | BFF + audit | 🟡 | APIs exist; audit/observability partial |

#### CLS — Classify & Translate to the Category Taxonomy — 🟡 Partial/mock
| Story | Summary | State | Note |
|---|---|---|---|
| CLS-01 | AI classification + catalogue/contract sufficiency | 🟡 | Real LLM (Groq/Gemini); now validates against the **configured taxonomy** (not a separate hardcoded list). The deterministic fallback classifier is centralised in `lib/procurement/classify.ts` (single source of truth, benchmarked) — and now genuinely single: the assistant's private `guessCategory` keyword table has been removed, so the assistant and the wizard can no longer disagree about the same sentence. An LLM category outside the configured taxonomy falls back to that classifier rather than to a literal `goods`, which is catalogue-eligible and would have re-opened CHK-01's defect from the other side |
| CLS-02 | Category-code assignment & taxonomy translation | 🟡 | `lib/procurement/category-code.ts` — keyword → standardised code, **category-aware** with **per-category default codes** so every demand resolves; centralises the old commodity map. Organisation-specific code scheme pending |
| CLS-03 | Low-confidence handling & manual override | 🟢 | The AI classification is shown with extracted details before it's accepted; if it's wrong the user **re-describes** ("Try again") rather than picking from a commodity-category grid (which has been removed — categories are derived, not chosen) |
| CLS-G0 | AI governance & **model selection** | 🟢 | **Decided: keep Groq + Gemini** (governed providers, free tier, already connected); a paid provider (e.g. Claude) is **not** adopted and no new provider is added without explicit approval |
| CLS-G1 | Classification eval harness & baseline | 🟡 | `npm run test:classification-eval` — labelled benchmark over the deterministic classifier with a per-category breakdown and an **accuracy-baseline gate (≥85%)** so rule changes can't silently regress (currently 95.8%). LLM-tier eval still needs the governed endpoint Joined by an **intake routing eval** (`npm run test:intake-routing-eval`) that benchmarks where a demand should go — catalogue / contract / new demand — with its own accuracy floor. Classifying a demand correctly and routing it correctly are different failures; it was a routing miss, not a classification miss, that offered "business consulting" a box of business cards. |
| CLS-G6/7, AGT5/7 | Quality monitoring, model change mgmt, tuning, observability | 🔴 | Not present |
| CLS-B2 | Classification aggregation API | 🟢 | `/api/ai.ts` reads the admin-configured classifier and returns a controlled 503 when the server-side database connection is absent (`test:ai-api-config`). Production has the required connection, the supported configurable Groq default (`openai/gpt-oss-20b`), and an active classifier verified by `test:ai-agents` (16 passed, 0 failed). |

#### CHK — Demand Checks (Catalogue & Contract) — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| CHK-01 | Catalogue match — early exit to punchout | 🟢 | Match + early-exit read via the connector ports (`useSourceData`); the **first gated stage** of the staged funnel (INT-10), not an eager parallel check. Matching is now **category-gated and naming-word-based** (`lib/procurement/intake-routing.ts`): an item is only offered when the demand's category is `catalogue_eligible` **and** the match hits a word that names what is being bought, not merely one that describes it. Fixes a defect where "business consulting" was offered **Business Cards 500** — "business" hit the item name and carried the match while "consulting" matched nothing and cost nothing. A ruled-out catalogue stage is **skipped with its reason shown**, and the requester can still browse anyway. Punchout mocked |
| CHK-02 | Transactable contract — early exit to raise PR | 🟢 | Score-based match + early-exit via the connector ports; **stage 2 of the funnel — reached once the catalogue is ruled out**, so no contract is asserted prematurely (INT-10). A category the catalogue cannot serve now opens here directly instead of making the requester dismiss an empty catalogue card. Scoring is unchanged and still requires a primary signal (supplier, category, or ≥2 keyword hits) — its own weakness, a match on category alone, is recorded as a known gap in the routing eval rather than hidden |
| CHK-03 | PSL enforcement at check | 🟡 | **Preferred-supplier (PSL) soft check + boost** centralised in `lib/procurement/supplier-preference.ts` (explicit `preferred` flag seam, else heuristic); surfaced in the determination + recommender. Hard PSL reference list pending |
| CHK-04 | Configurable intake-form engine (ASP/partial) | 🟡 | Partial |
| CHK-05 | Catalogue matching rules & info to collect | 🟢 | Dedicated item detail plus governed checkout captures approved delivery, recipient, purpose, accounting exceptions, durable request lines, supplier/contract/risk links, and configurable whole-request auto-approval |
| CHK-06 | Contract matching rules & info to collect | 🟢 | Shared contract-call-off governance seam validates active contract, remaining capacity, supplier risk, profile defaults, and PR-before-PO lifecycle |
| CHK-07 | **Second** contract check vs full SD + framework/MSA | 🟡 | `lib/procurement/second-contract-check.ts` — classifies the supplier's contracts as **transactable / framework (host a SOW) / expiring** and recommends transact/author-SOW/renew/new; "Contract coverage" panel on the determination. `isFramework` flag is the live-data seam |

#### INT-10 — Staged-Intake Funnel (entry-point + progressive-disclosure redesign) — 🟢 Built

> **Why this is a distinct requirement.** The checks of CHK-01/02 and the determination steps all
> work, but the *intake shell* in front of them contradicted the R1 model (line 15: "light capture →
> try catalogue & contract first; full service description only when nothing fits"). The old wizard
> presented **eight category tiles as parallel entry points that all converged on the same path**, and
> a **catalogue + contract pre-check that fired eagerly on category selection** — surfacing a contract
> candidate before the user had described what they need. This block reframed intake as **one
> progressive funnel with two real entry points and stage-gated derivation**.
>
> **Built (WS-F).** `step-category.tsx` now leads with free text and has **no commodity-category
> selection at all** — Goods/Services/… are derived metadata, not a choice (the path is catalogue /
> contract / full request, decided by the routing decision), with the catalogue as the one explicit
> alternative entry.
>
> **Superseded (2026-09):** the sequential funnel in `step-pre-check.tsx` is now
> **`step-buy-route.tsx` — one screen showing all three routes at once**, recommendation first. The
> staging was an implementation detail that became a UI: the requester is answering a single
> question ("how do I get this?") whose three answers are comparable, and gating them created the
> failure the funnel was supposed to prevent — a wrong catalogue match hid the contract check behind
> a large green button pointing the other way. A ruled-out route now states its reason **in place**
> and stays clickable. Enrichment still carries forward into the request; the decision itself
> (`decideIntakeRoute`) is unchanged.
>
> **Also built: the journey explains itself and shows its consequence.** Every step carries a
> header panel — what it is for, what it needs from the requester, what happens after (now in
> `intake-steps.ts`, alongside the step's order and its gate) — and the stepper renders the per-step `description` that had been defined on
> every step since the wizard was written and drawn nowhere. Step 1 shows **one** classification
> block (category as the headline, commodity code beneath as the code derived from it, supplier and
> value labelled *extracted*) instead of the demand three times over plus a 600 ms banner nobody
> could read. And the **buying channel is shown on the pre-check** with its indicative timeline and
> the rule that decided it — the difference between a two-day catalogue order and a multi-week
> procurement-led exercise, previously first visible on step 5, four steps after it became knowable
> (nine of the ten live rules are fully determined by the end of step 2, and the pre-check settles
> the contract question that is the tenth input). Both screens call `resolveDemandChannel`, and
> `test:intake-routing` asserts they agree. Urgency is the one input that can still move the answer
> after that, so the toggle states inline what it does — derived from the live rule set, and silent
> when it would change nothing.

**Two entry points only** (replacing the tile grid):
1. **Free-text intake** — the default. The user describes the need in natural language; the system
   derives category/commodity code (CLS) rather than asking the user to pre-classify. There is
   **no commodity-category selection at all** — Goods/Services/… are derived metadata, not a choice;
   to correct a misread the user re-describes ("Try again"), there is no category grid (CLS-03).
2. **Browse catalogue directly** — for users who already know they want a catalogue item; jumps
   straight to the punchout/catalogue-order early exit.

**Progressive, stage-gated derivation** (each stage runs *only* when the prior one fails to resolve,
and only once it has enough signal):

| Story | Stage | Behaviour | Exit |
|---|---|---|---|
| INT-10a | 1 · Capture | User types the demand in free text. | — |
| INT-10b | 2 · Catalogue derivation | System attempts a catalogue match on the captured text — **only for categories the catalogue can fulfil** (`procurement_categories.catalogue_eligible`, admin-editable), and only on a naming-word hit clearing the threshold (POL-20). Otherwise the stage is skipped with its reason shown. | Catalogue match → **catalogue order** (early exit, lightest path). |
| INT-10c | 3 · Enrich-then-contract | No catalogue → prompt for *more* detail, then attempt a **transactable-contract** match (CHK-02). Not shown until step 3's added input exists. | Transactable contract → **transact / raise PR** (early exit). |
| INT-10d | 4 · Full service description | No contract → user completes the full SD (INT-03), the master capture. | — |
| INT-10e | 5 · Derive + final questions | System derives every downstream element from the SD (category-code, materiality, risk cascade, channel, contract/sourcing type) and asks **only the residual questions** that criteria demand (e.g. mini-IRQ delta when risk is unclear, "how it qualifies" when materiality is borderline). | → Determination screen (the R1 endpoint). |

**Defect fixed, then superseded:** the staged pre-check must not assert a match it has not earned.
That still holds — `decideIntakeRoute` gates every route on category eligibility and a naming-word
match — but it is now enforced in the **decision**, not by hiding a stage. `step-buy-route.tsx`
shows all three routes with their reasons, so "no premature assertions" means *no route is claimed
without evidence*, not *no route is visible yet*.

**Acceptance criteria.** (a) ✅ Free text is the only commodity entry — there is **no category grid**;
the fulfilment path is derived, not chosen, and the catalogue is the one explicit alternative entry.
(b) ✅ Catalogue is the first derivation and only lists matches above
the score threshold. (c) ✅ The contract stage is never reached or rendered until catalogue is ruled
out *and* enrichment input exists (asserted by the smoke). (d) ✅ Full SD appears only when neither
early exit fires. (e) ✅ Stage 5 asks **criteria-triggered residual questions** — `residual-questions.ts`
surfaces a delta question only when the derived signals leave it open and it would change the
determination (privileged access for IT/services/sensitive data; critical-service for material spend
/ elevated supplier risk / high sensitivity); a low-value, low-sensitivity demand is asked nothing.
(f) ✅ Each stage — and each residual question ("Asked because…") — shows why it's being asked.

**Related capabilities:** INT-02 (light intake — entry redesign), INT-03 (master SD as stage 4),
CLS-01/03 (derive category, low-conf override), CHK-01/02/05/06 (gated early exits + thresholds
POL-20/21), CHK-07 (second contract check already lives in stage 5), RSK-03 / DET-10
(criteria-triggered residual questions in stage 5).

**Open design decisions** (resolve before build):
- Stage-2/3 thresholds: reuse POL-20/21 defaults, or expose in the CFG simulation panel first?
- Catalogue-as-entry: does "browse catalogue" bypass the funnel entirely (pure order, no
  determination), or still produce a lightweight determination record for audit?
- Manual category override: keep as an always-available "not what I meant" affordance, or only
  surface it when classification confidence is low?

#### SUP — Supplier Identification & Selection — 🟡 Partial/mock
SUP-01 permissible supplier 🟡 (PSL soft-preference now in checks) · SUP-02 competitive sourcing & supplier-count 🟡 (**competitive-sourcing check** in `supplier-preference.ts` — threshold + exemptions for preferred route, exempt category, single-source justification) · SUP-03 screening display 🟢 (**`screening.ts` evaluator** surfaces the supplier's screening status on the determination — clear / pending / flagged / not-screened; a **flagged supplier blocks the demand** → refer-back via the disposition. Real screening provider still mocked) · SUP-04 supplier profile reachable from the request journey 🔴→🟢 (the 7-tab Supplier 360 profile at `/suppliers/:id` is built and rated done elsewhere in this doc, but nothing on the request-detail page ever linked to it — the supplier was plain text on Overview, an unlinked card on Compliance, an unlinked name on Related's "same supplier" lists. A request-detail viewer had no path to spend history, performance trend or certifications short of a manual directory search. Fixed: all three surfaces now link to `/suppliers/:id`).

> **Documented spec drift (FR04-02, `docs/specs/requirements/04-supplier-management.md`).** The Supplier
> 360 spec names the profile's 7th tab "Messages" (an internal thread on the supplier record itself).
> What shipped is "Activity" — a different, broader tab — with supplier messaging instead living as a
> separate top-level page (`/suppliers/messages`). Not fixed here: it's a naming/scope decision (keep
> "Activity" and update the spec, or actually build a Messages tab), not a wiring bug.

#### RSK — Risk & Mini-IRQ Pre-Assessment — 🟡 Partial (core decisioning now modelled)
| Story | Summary | State | Note |
|---|---|---|---|
| RSK-01 | Risk-segmentation cascade from SD | 🟡 | `lib/procurement/risk-segmentation.ts` — inherent-risk cascade (highest-attribute-wins over data sensitivity + supplier risk + value + access/critical-service); **drives routing** and surfaces on the determination screen |
| RSK-02 | Preliminary operational risk assessment | 🟢 | `lib/procurement/operational-risk-assessment.ts` — structured per-dimension screen (business continuity, data handling, concentration, regulatory exposure, access), **worst-dimension-wins** overall rating; complements the single-tier inherent-risk cascade. "Preliminary operational risk" panel on the risk step + in the export. Opaque acronym generalised to standardised dimensions |
| RSK-03 | Mini-IRQ in front door (delta only) | 🟢 | **Criteria-triggered** delta questionnaire (`residual-questions.ts`) on the risk step — each question (privileged access, critical service) shows only when the derived signals leave it open and states why ("Asked because…"); a low-value, low-sensitivity demand is asked nothing. Answers **refine the inherent-risk cascade + materiality live**. Fuller assessment still via the FORM-001 triage |
| RSK-04 | Reuse-matching against the third-party risk register | 🟡 | **Structured reuse model** (`lib/procurement/risk-reuse.ts`) — `evaluateReuse`/`selectReuseOutcome` decide reuse/amend/change/new by supplier, scope, data class, inherent tier & validity; drives the determination outcome |
| RSK-05 | Service-owner confirmation of reuse | 🔴 | The reuse **outcome** is computed and surfaced, but there is **no dedicated service-owner confirm-reuse step** (no explicit accept/reject UI for the proposed reuse). Gap |
| RSK-06 | Detailed assessment handoff (no front-door capture) | 🟡 | `lib/procurement/handoff.ts` — when reuse isn't possible the detailed assessment is a **routed step to the risk register** (deep-link, no front-door capture); shown in the determination's Next-steps panel |
| RSK-07 | Risk-required identification rules | 🟡 | Inherent-risk cascade (RSK-01) provides the tier; triage gate (`isTriageRequired`) decides when assessment runs |
| RSK-08 | Risk-reuse identification rules | 🟡 | The reuse model's per-dimension rules (supplier exact, scope/category, data-class no-higher, validity window, worst-dimension-wins) — `risk-reuse.ts` |
| RSK-09 | Risk outcome: reuse/amend/change/new | 🟡 | `determineRiskOutcome` — no reusable assessment → new; within assessed band → reuse; one tier above → amend; more → change. Surfaced on the determination screen |
| RSK-T6 | Risk-matching hardening | 🔴 | Not present |

#### DET — Buying-Channel Recommendation & Approvals — 🟡 Partial
| Story | Summary | State | Note |
|---|---|---|---|
| DET-01 | Sourcing strategy from SD | 🟡 | Via routing rules; not SD-driven |
| DET-02 | Threshold treatment & in/out-of-scope routing | 🟢 | Threshold rules exist |
| DET-03 | Review demand summary (business vs procurement-led) | 🟡 | Partial |
| DET-04 | **Determination screen** (the R1 endpoint) | 🟢 | Now the **Review & submit** step of a four-step intake, holding every conclusion and nothing to fill in: channel + indicative timeline, materiality, inherent risk, contract/sourcing type, approval-to-source, Next-steps handoff (system/status/deep-link), the routing/lifecycle preview and approvals, and the checks that ran. **Exportable** (`Export` → structured Markdown via `determination-export.ts`). The risk *questions* moved to Details — every question is asked before any conclusion is shown. The determination itself is a pure module (`lib/procurement/intake-determination.ts`), computed once per intake and shared by both densities |
| DET-05 | Approval-to-source: pre-sourcing validation gate | 🟢 | `lib/procurement/approval-to-source.ts` — standardised gate: **light** (demand validation + cost-centre) vs **full** (demand validation + intent-to-source + category approval), triggered by value ≥ threshold (POL-01), materiality, or high/critical inherent risk; transactable early exit ⇒ no gate. Surfaced as an "Approval to source" panel on the determination + in the export. Threshold seedable in the CFG sim panel |
| DET-07 | Sourcing scope determination rules | 🟡 | Partial |
| DET-08 | Contract type: MSA/SOW/amend/change/renew | 🟢 | `lib/procurement/determination.ts` `determineContractType` — none / renew / SOW / **amend** / **change** / new-MSA. Against an existing agreement the scope/headroom signals decide: material demand → change; extends scope or at capacity → amend; fits with headroom → SOW. Wired from materiality + the second contract check; surfaced on the determination |
| DET-09 | Sourcing type: new/renewal/benchmarking | 🟢 | `determineSourcingType` — none / renewal / benchmarking (incumbent) / new-event from channel + category + relationship; surfaced on the determination **and now persisted** (`requests.sourcing_type`), so `new-event` survives the wizard and drives the sourcing stage |
| DET-10 | **Materiality & criticality** (regulatory flag) | 🟡 | `lib/procurement/materiality.ts` — highest-attribute-wins from data sensitivity + supplier risk + value (+ explicit critical-service seam); **feeds routing** (`material` field) and **surfaces on the determination screen**. Explicit "how it qualifies" capture pending |
| DET-B4 | Recommendation composition API | 🟡 | Partial |

> **Release security gate — not yet implemented.** Current role switching is browser state, and
> `/api/db` has no authentication at all; neither is authorization. Before an R1 deployment, introduce
> an identity provider, map authenticated identities to the directory, derive roles server-side,
> enforce ownership/role predicates on every read and write at the `/api/db` boundary, and require
> authenticated API sessions. This is deliberately recorded as a full security workstream rather than a partial policy
> flip that would leave the existing client impersonation model broken.

#### RTE — Route & Handoff — 🟡 Partial
RTE-01 processing scope (PO required) 🟢 · RTE-02 finalise record 🟢 · RTE-03 handoff triggers 🟡 (**structured next-steps with system + status + deep-link** via `handoff.ts`) · RTE-04 supplier-data issue 🟢 (**and vendor onboarding is now a real conditional stage, not a preview label** — two gates: light onboarding, meaning the supplier record exists and screening has cleared, gates sourcing and risk completion; full onboarding gates contracting for the awarded supplier only. A supplier named at intake but absent from the directory can be created as a **prospective** record, which is what made the trigger expressible at all) (**`supplier-data.ts`** flags an incomplete supplier record — onboarding not completed / expired certifications — and `handoff.ts` adds a **"Resolve supplier master data" remediation step** routed to onboarding) · RTE-05 sourcing handoff 🟢 (**now a write**: an event is raised from the request carrying `request_id`, suppliers are invited from the directory, and they respond in the portal — all in the own store, see the scope note under PLT) · RTE-06 PR refer/change 🟢 (**demand disposition** in `lib/procurement/referral.ts` — proceed / request-change / refer-back, most-blocking-wins from completeness + policy + scope signals; headline banner on the determination + in the export) · **RTE-07 config-driven Routing step 🟢** (the Routing preview is now a **presentation of config**, no hardcoded literals: the **lifecycle** comes from the attached workflow template's stage nodes — `useWorkflowTemplate` — with **conditional Risk assessment / Vendor onboarding steps** overlaid from the determination signals via the pure `lib/workflow/workflow-steps.ts` `composeWorkflowSteps` (`test:workflow-steps`); **approvers** from the value-banded **approval chain** (`selectApprovalChainForValue` + `resolveApprover`); **timeline** from `procurement_categories.timelineDays`; **reviewers** from the user directory. Fixes the old fake "Intake review by system" step) · DEC-6 write-path/idempotency 🟡 (**one transition primitive** — `lib/workflow/transition.ts` — is now the only path that changes a request's stage; it closes the open `stage_history` row, opens exactly one new one, and sets owner + `sla_deadline` from the node's config. Idempotent on "already in this stage **and** already recorded as being in it", so a double-click or a replayed engine step cannot open a second row, while the stage a request is *created* in is still recorded. The award write-back remains non-transactional — see the sourcing scope note) · WFL-7 hardening 🟡 (**the engine runs to the next gate** instead of parking after two nodes; gated stages suspend and a named role's action resumes them; the resume path skips the node whose gate was just satisfied. The no-template fallback no longer creates an instance that can never move).

> **Documented future-config gaps (RTE-07).** The Routing step derives from existing admin config, but a
> few *selection rules* are not admin-editable yet — derived pragmatically now, recorded here as future
> admin work rather than invented UI: (a) **category → workflow-template** mapping (today `template.type ===
> category`, else the "standard" template); (b) **category/value → approval-chain** mapping (today by the
> chain's `threshold` band); (c) **buying-channel → stage list** (`lib/workflow/buying-channel-stages.ts`,
> hardcoded, no admin page); (d) a **CFO / top approval-tier threshold** (not in `policy-config.ts`); (e)
> **value-based timeline** adjustment (only `category.timelineDays` is configurable, not a value multiplier).

### Cluster: Chatbot

#### AST-Q — NL Data Query — 🟡 Partial
Real Groq tool-calling over the **internal own store** (request, supplier, contract, PO, invoice, risk) + filter
(AST-Q-02 🟢) + partial aggregation (AST-Q-03 🟡). The **client-side assistant lookups now read through the
connector ports** (`capabilities/lookup.ts` → `requireConnector`), so the chatbot and front door share one
governed source with the provenance envelope; degrades gracefully on a source outage. Verified end-to-end by
`test:interactions-ui` (assistant returns connector-backed supplier data).
Per-source object stories — AST-Q-07 PR/PO (Ariba) · 08 Contract (Sirion) · 09 Catalogue · 10 Supplier ·
11 Invoice — are **🟡 (read via the own-store ports today)**; AST-Q-06 CSD (ServiceNow) · 12 Guided Buying ·
13 Sourcing Request · 14 Supplier Request · 15 TPRA (Coupa) · 16 Coupa status remain 🔴 (need own-store
objects modelled). The **server-side** `api/chat.ts` tool path still reads the own store with raw SQL rather than through the connector ports (WS-E).
AST-Q-G4 field masking (POL-28) 🔴 · AST-Q-B5 gateway 🟡 · AST-Q-T2 orchestration 🟢.

#### AST-P — Grounded Policy Q&A — 🟡 Partial
AST-P-01 policy Q&A 🟡 → now **grounded retrieval**: `capabilities/knowledge.ts` (`rankKnowledge`) ranks the
KB, **quotes the best match with its source citation**, cites strongly-relevant related policies, and on a
**weak match returns the closest topics instead of asserting a possibly-wrong policy** (no confident
hallucination). Verified by `npm run test:knowledge` + the interaction E2E (grounded threshold answer).
No 8-domain structure yet · AST-P-02 walk-through 🟡 · AST-P-03 replace TIM 🔴 · AST-P-G2 guardrail library 🔴 ·
AST-P-T1 KB ingestion/**embedding (vector RAG)** 🔴 (lexical retrieval today; swap `rankKnowledge` for a vector index).

#### AST-A — Agentic Actions — 🟡 Partial
Propose→confirm-before-act + audit logging exist (AST-A-G5 🟢-ish; actions logged not executed).
AST-A-04 PR/PO actions 🟡 · AST-A-05 invoice actions 🟡 · AST-A-06 payment/banking hand-off (POL-29) 🔴 ·
AST-A-B6 action orchestration API 🟡.

#### AST-S — Support Assistance — 🟡 Partial
AST-S-01 raise ticket 🟢 · AST-S-02 schedule appointment 🔴 · AST-S-03 route to training 🔴.

**Ticket data layer landed (P0–P1):** both intake paths (Contact Support form, assistant handover)
now persist to one store through `db/tickets` behind the `support-ticket` connector, with ownership,
threaded responses (internal vs requester-visible), a full status lifecycle and sequence-issued ids.
**Queue landed (P2):** `/help/inbox`, agent-role-guarded, with standing views (unassigned / mine /
open / all), priority + category filters, search, and a read-only detail drawer showing the
correspondence thread with internal notes marked.
**Working actions landed (P3):** assign / forward (reassign + handover note), reply vs internal note,
the full status lifecycle with a required resolution note, and **polymorphic references** — a ticket
links to requests, POs, suppliers, contracts and invoices via `ticket_links`, so the owner sees the
context and any of those objects can show its support history. Every action writes an audit entry and
notifies; internal notes notify nobody.
**SLA landed (P4):** `due_at` computed on raise from `sla_targets` (stage `ticket`, channel =
priority; hours rather than days), breach + at-risk classification, a **Breaching** standing view,
row badges and headline metrics. `waiting-on-user` pauses the clock, so a ticket cannot breach while
the requester is the blocker. Requesters can attach their own references, scoped to the object types
their role can already see. Assistant-raised tickets carry the **verbatim conversation**, not just the
model's summary.
**AST-S-01 raise ticket 🟢 → the ticket lifecycle is now complete end to end.** Remaining in AST-S:
AST-S-02 schedule appointment 🔴 · AST-S-03 route to training 🔴.

#### AST-X — Conversation Experience — 🟡 Partial
AST-X-01 multi-conversation UI 🟡 (Web+overlay; **no Teams**) · AST-X-02 history & retention 🟢 ·
AST-X-03 eight-language 🔴 · AST-X-04 deep-link to source 🟢.

---

---

## 6. Open Items → engineering hooks

The Release-1 policy defaults (POL-xx) carry **recommended-default decisions** we can seed now and refine in the CFG
simulation panel before go-live:

| OI | Drives | Recommended default to seed |
|---|---|---|
| POL-01 | Routing/approval table | Catalogue/contract first; 10–250k + low/med risk → LIGHT (demand validation + cost centre); ≥250k or high/critical → FULL (demand validation + intent-to-source + category); default FULL |
| POL-20 | Catalogue match | Goods keyword ≥0.7 on 8-digit commodity; services at class; prefer level-2 punchout |
| POL-21 | Contract match | UNSPSC class (6-digit); scope overlap ≥0.6; expiry buffer 30–60d; framework headroom ≤ ceiling−committed |
| POL-22 | Materiality | Critical/important service → material → regulatory flag + heightened chain (Legal sign-off) |
| POL-18 | Risk tiering | Highest-attribute-wins (highly-confidential data / privileged access / critical service → CRITICAL) |
| POL-24 | Risk reuse | Reuse if supplier exact, scope in band, data class no higher, within refresh cycle; else delta only |
| POL-28 | Chatbot masking | Mask bank account / payment method by default; entitled roles only; bot never widens source perms |
| POL-29 | Payment actions | R1 captures request + hands off to payments team with a ticket; bot initiates no payment change |

---
