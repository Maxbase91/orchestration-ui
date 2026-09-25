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
11. [ ] Mockups implementation — plan (below), then build

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
