# Admin review: nothing hardcoded or unused, then the mockups

Asked by the product owner (2026-09-25): go through every Admin item and keep
nothing hardcoded or unused; update the Help knowledge base page; make the AI
assistant use the same question routing as Home; then move to implementing the
mockups. Noted for later: conversation titles all read "New conversation".

Decisions taken (2026-09-25):
- AI-006 "PR Compliance Reviewer" is removed with its 14 stored reports — its
  checks were invented passes (sanctions, contract coverage, SRA, benchmark).
- A Budget Owner step whose cost centre has no owner goes to procurement
  managers; nobody may approve a step on their own request.
- Which system role acts as "Finance", "Legal", "CFO"… becomes configuration
  (a Roles table on the Approval Chains page), not a table in code.
- RR-012 (high/critical-risk supplier → compliance escalation) is switched on;
  the three inactive forms are deleted with their seeded submissions.

## Findings per Admin item (what reads it; what goes)
| Item | Real consumer | Removed / changed |
|---|---|---|
| Database | 9 of 10 tabs persist | Workflows tab (read-only duplicate of the designer); "Reset session edits" (nothing left to reset) |
| Categories | classification, catalogue eligibility, commodity codes, managers (approvals), preferred suppliers | icon (never shown); timeline days (a second, disagreeing "how long" — the workflow stage targets are the real one); description now feeds the AI classifier; the classifier's keyword fallback moves into category config |
| Cost centres | charged-to, Budget Owner approver | owners empty on all 44 → flagged; ownerless → procurement managers |
| Delivery locations | checkout deliver-to | address and country (empty everywhere, read by nothing) |
| SLA targets | — (read-only copy of template SLAs) | becomes the editor for the only SLA data it owns: support-ticket response times |
| Routing rules | buying channel | RR-001, RR-006, RR-011 (can never change an outcome); `region` and `priority` fields (never supplied / duplicate of urgent); categories from configuration; RR-012 on |
| Decisioning thresholds | all 22 read by a live decision | page says what each one drives |
| Service description | intake questions, generation, sourcing seeds | the live table was empty (everything ran on code defaults) → seeded, the page edits stored rows |
| Form builder | 5 active stage forms, real submissions | 3 inactive forms deleted |
| Approval chains | approvers by value band | invented "referenced by" lists; descriptions restating the band; role → system-role table moves to configuration |
| Workflow designer | lifecycle, stages, SLAs, owners | (requester sentence retires with the mockups) |
| AI agents | 001 classifier, 002 validator, 004 anomalies, 005 recommender, 007 status | 003 (only relabels a disabled button), 006 (invented checks); fake accuracy, decision counts, random performance charts, canned test results; invented descriptions rewritten; 004's thresholds from configuration |
| KB management | assistant + Home answers | Help page content moves in (topics) |
| AI analytics, System health, Users | real data | — |
| Audit log | real audit rows | 34 invented entries; IP column (always "-") |

## Commits
1. [x] Audit log and Database tab clean-up
2. [x] AI agents: remove AI-003/AI-006 (+ 14 reports), fake metrics and tests; honest descriptions; AI-004 thresholds from configuration
3. [x] Routing rules: redundant rules out, RR-012 on, vocabulary = what the runtime supplies, categories from configuration
4. [x] Approval: configurable roles, ownerless budget → procurement managers, no self-approval, chain page clean-up
5. [x] Categories: icon/timeline out, stage-target durations, classifier from configuration
6. [x] Delivery locations, SLA targets → ticket SLAs, thresholds "used by" (+ catalogue auto-approval boundary aligned)
7. [x] Service description seeded; unused forms deleted (+ inheriting categories show the stored default)
8. [x] Help knowledge base from the knowledge base table (+ breadcrumbs from the navigation)
9. [x] AI assistant on the Home route (+ conversation titles; Home box off /api/ai; legacy step=2 link retired)
10. [x] Docs: the Admin map (what each item is for, what reads it)
11. [ ] Mockups implementation — plan (below), then build — Phase 1 (Door 2) and Phase 2 (Home) done

## Verification
tsc, lint, test:all, browser suites, live backfills idempotent and read back,
production interaction suite after deploy.

---

# Mockups implementation — the Intake Prototype canvas

Source: the "Intake Prototype" design canvas (4 artboards, 1440×900, desktop).
Every value on these screens comes from configuration the admin review just
cleaned up; nothing new is hardcoded.

## What the mockups change
| Artboard | Today | Mockup |
|---|---|---|
| Home — two doors | One box; demand navigates at once; status/policy answered inline; catalogue browsed inside the box | The box (Door 1) beside a "Know exactly what you want?" card (Door 2). Every outcome is one "Understood as …" card — something to buy, a catalogue item, a policy question, a status question — with its source and one next action |
| Door 1 — the conversation | Four-step wizard: Describe → How you'll buy → Details → Review & submit | One page, three phases (What you need · How it is bought · What it needs). Left: the conversation (category + commodity code confirmed, catalogue and contracts checked, "one detail decides it", call-off offer / catalogue match / new request, service-description questions, preferred suppliers, one risk question, "Buying channel confirmed"). Right: **Your request** — every value grouped (Channel · Who and where · What · Supplier · Service description), each with where it came from (from you / derived / drafted — check it / still to come), editable in place, "N of M known", the executive summary once complete |
| Door 1 — channel, then submit | Review & submit step | The channel page: headline (template), value, stages that apply, stage targets; **step by step from the template** — stage, purpose, owner, target days, and per request *Applies · condition / If … / Skipped · reason / You are here*, plus what **you** do at a stage; Submit with what happens next. Right: what you are submitting — summary, supplier + preferred suppliers, checks |
| Door 2 — the catalogue | Browsed inside the Home box; item detail page; one line per checkout | A Catalogue page: catalogues (from the items), item cards, a basket with total, deliver to / charged to, the approval note from the threshold, Place order |

## Phases (each shippable, smallest first)
1. **Door 2 — Catalogue page** (`/catalogue`): catalogues derived from items; basket; governed checkout per order (see Q1); Home box links to it instead of browsing inside itself.
2. **Home — two doors**: the Understood-as card for all four outcomes (Q2); the catalogue door card; attention band + my requests stay.
3. **Channel page**: replaces Review & submit. Stages from the channel's template with applicability evaluated from the request's determination (typed branch conditions — edge-conditions.ts); the requester's action per stage as a node field (Q3); checks from the determination; Submit (existing atomic intake submit).
4. **The conversation page**: replaces Describe / How you'll buy / Details — one conversation, the live request panel with provenance, inline edits the assistant uses from then on; "one detail decides it".
Per phase: tsc, lint, test:all, the browser suites (rewritten where they walk the old wizard), docs; screenshots against the artboard.

## Decisions (2026-09-25)
- Q1 Basket: **one order per supplier, approval judged on the basket total** (so splitting cannot dodge the auto-approval threshold). Server-authoritative: the checkout endpoint takes the whole basket, groups it, and decides approval on the total itself.
- Q2 Home: **a demand shows the Understood-as card first**, like every other outcome.
- Q3 **"What you do at this stage" is a new field on each workflow stage**, edited in the Workflow Designer, shown on the channel page and the request's Workflow tab.
- Q4 **Replace phase by phase** — each phase retires the wizard steps it replaces; one intake flow at any time.

## Phase 3 — the Channel page (plan, 2026-09-26)
Replaces **Review & submit** for every Door 1 channel — procurement-led,
business-led **and the contract call-off**, whose submit moves off its Details
form (that form's button already said "Review request" and submitted instead).

**What the page shows, and where each value comes from**
| On the page | Source |
|---|---|
| Headline + sentence | the channel template's requester wording (Workflow Designer) |
| Value · Stages that apply · Stage targets | the request; the plan below; the template's `slaDays` |
| Step by step | every stage node of the channel's template, in graph order |
| Applies / If … / Skipped · reason / You are here | **the engine's own branch function** (`getNextNodeIds`) walked from the stage the **server** will land the request on (`firstActionableStage` for intake, the checkout's entry rule for a call-off); a signal not yet known (no supplier chosen → onboarding) is walked both ways, so "If the supplier is new" comes from the graph, not from copy |
| "You: …" | new stage field `requesterAction` (Workflow Designer), seeded only where the requester really acts (Intake; business-led Contracting). Not Receipt: goods receipts are recorded by procurement/operations roles only — flagged, not changed |
| Submit note | the entry stage and its owner role |
| What you are submitting | the request; the executive summary (Read all sections); who/where; supplier; **who sourcing will invite** — `sourcingInvitees()`, the function the sourcing event uses (named + shortlist + every preferred supplier) |
| Checks | the determination (full request) or the governed decision (call-off): why this channel (the matched routing rule's own description), disposition, contract coverage, risk, approvers (the **same derivation submit writes** — chain by value, cost centre, override step), failed policy checks, missing SD sections |
| The workings (collapsed) + Export | materiality, inherent/operational risk, approval to source, contract & sourcing type, every policy check, next steps — DET-04/05/08, RSK-02, RTE-06 stay surfaced |

**Removed:** Routing preview's "Add reviewers / watchers" and "Notes for approvers"
(collected, never saved); the Review conclusions stack; the preview's own chain
pick (it ignored the cost centre and the determination's chain, so it could name
people submit would not).

**Commits**
1. [x] `channel-plan.ts` (pure) + `test:channel-plan` — every template × signal combination agrees with the server's landing rule and the engine's walk
2. [x] `requesterAction` stage field: types, designer, seed + live backfill, Workflow tab column, seed parity
3. [x] The Channel page (full request + call-off), wizard wiring, retired Review pieces, browser suites, docs

## Phase 4 — the conversation page (plan, 2026-09-26)
Replaces **Describe, How you'll buy and Details** with one page (Intake artboard):
the conversation on the left in three phases — *1 · What you need · 2 · How it is
bought · 3 · What it needs* — and **Your request** on the right. It ends on
"Buying channel confirmed" → the Channel page (phase 3), where it is submitted.
Nothing new decides anything: each turn is the engine that decides it today.

| Turn | Engine it reuses |
|---|---|
| Your words (or Home's `?q=`) as the first message; "That sounds like *category · code*. Is that right?" (candidates when unsure) | AI-001 / configured keywords (step-category) |
| "Checked the catalogue — …; checked contracts — …" in one turn | `decideIntakeRoute` + the server contract matcher (step-buy-route) |
| **One detail decides it** — the matcher's own clarifying question (ADR-0004) | `serverMatch.questions` |
| Catalogue → "in the catalogue — no request needed", *Order it →* (Door 2 basket) · Contract → *Call it off* / *Not this — raise a new request* · else → "Then this is a new request" + the rule's reason | as today |
| Call-off: fills what it can from your words and profile, asks the rest | the call-off draft fields (contract-call-off-checkout) |
| New request: the service-description questions, then the preferred-supplier question (buttons), then the risk questions (Yes/No) | demand-conversation engine, sourcingInvites, residual questions |
| **Buying channel confirmed** → *See how it will be bought →* | the determination |

**Your request**: Channel · Who and where · What · Supplier · Service description
(required N of M); each row a provenance dot (*from you / derived / drafted — check
it / still to come*), one line, edited in place — the conversation reads the edit
from then on; "N of M known"; the executive summary once written.

**Retires**: step-category, step-buy-route, the Details step (requester-context
block, details-supplier, the call-off form), the stepper and the wizard footer.

**Decisions (2026-09-26)**
- Q5 **Inputs only** are edited in place — title, value, dates, who and where,
  supplier, service description. What the platform decides (channel, category
  code, catalogue price, contract supplier) changes through the conversation —
  re-confirm the category, "Not this — raise a new request" — so routing stays
  governed.
- Q6 **"N of M known" counts what the route needs**: a new request's key facts
  plus its required service-description sections; a call-off's details. It
  reaches M of M exactly when "Buying channel confirmed" appears.

**Build order**
1. [x] 4a — the service-description engine becomes a hook, unchanged (`c6f8ba0`)
2. [x] 4b — pure modules, tested on their own: `classify-demand.ts` (from step-category), `use-route-checks.ts` (from step-buy-route), `call-off-agenda.ts` (the call-off's questions, prefilled from the words and the profile), `request-rows.ts` (Your request's rows, provenance, inline-editability per Q5, "N of M known" per Q6)
3. [x] 4c — the page: transcript + reply box + turn cards, Your request panel; new-request-page switches to it; step-category, step-buy-route, the Details step pieces, the stepper and footer are deleted; browser suites rewritten; docs (README, requests README, FR-01, the design document and functional spec, TEST_PLAYBOOK, R1 docs, PRODUCT_BACKLOG)
   - Kept, not lost with the retired steps: AI-005's supplier ranking (now `lib/procurement/supplier-suggestions.ts`, offered in the supplier turn); the urgency note derived from the live rules (at the Urgent toggle — it replaces a hardcoded claim); the catalogue offer's matched words; which layer classified (FR01-13); the description's quality badge (FR01-46)
   - Removed as dead once the Details screen went: the hook's invitation opening and `api/chat-intake`'s opening-turn prompt (no client sends an empty conversation), `details-sections.ts` and `test:details-progression` (its checks moved to `test:intake-conversation`), the already-orphaned `compliance-check-result.tsx`
   - Fixed on the way: giving up on the last open question (a date that never parsed) asked for it again offline and said nothing on the model path — it now closes the description; the completion message is short and said once
4. [x] 4d — the production interaction suite (8 flows, including a submit through the conversation) and the walkthrough's five front-door scenarios pass against the deployed app; screenshots checked against the artboard
   - Found in production and fixed (`8aa16e2`): a contract past its end date was offered as coverage — both matchers trusted the status column, and 12 of the 30 live contracts are past their end date while still marked active or expiring (flagged: nothing recomputes the status)

## Open — "required sections" means two things (found 2026-09-26)
The conversation's panel counts the questions that must be answered before the
channel is confirmed (`requiredSlots`: the floor, the template's `required`,
slot `requiredWhen`); the Channel page counts the sections generation says this
demand's description must cover (`sowRequiredSections`, from
`ConfiguredSection.requiredWhen`, which the determination checks). Both are
labelled "required", so one demand read "required 4 of 4" then "1 of 1 required
sections". Recommendation: make the conversation ask what generation will
require — a section required by the signals makes its slot required — so both
screens count one set and "Buying channel confirmed" also means the description
covers what the determination checks. It changes what a material demand is
asked, so it wants a decision first.

## Next — documentation boundaries (raised 2026-09-26)
There is no PRD and no ARCHITECTURE.md; AGENTS.md points to CLAUDE.md. What a
PRD and an architecture doc would hold is spread across the functional spec,
requirements 00–14, PRODUCT_BACKLOG, the personas, CLAUDE.md, the README, the
ADRs and the module READMEs — and one intake change had to be written into nine
of them. Define one home per fact and make the rest link:
- **PRD** — what and why: problem, personas, R1 scope in/out, principles, success measures; links to requirements/ for FR detail (the functional spec's role, which it no longer fills reliably)
- **ARCHITECTURE.md** — how: system context (SPA → /api/db → Neon, the 12-function cap, the LLM helper), the module map, the connector seam, the decision engines, where configuration lives; links to the ADRs
- **AGENTS.md / CLAUDE.md** — how to work here: ground rules, Definition of Done, conventions; links to the two above rather than restating them
- **README** — getting started, commands, deployment, the doc map
