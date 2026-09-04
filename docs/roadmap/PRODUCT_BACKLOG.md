# Product backlog — the intake front door

A delivery-ready backlog: **epics → features → user stories**, each story with
acceptance criteria, and each feature with the technical rules and modules that
implement it.

## How to read this

| Column | Meaning |
|---|---|
| **Story** | `As a <persona>, I want <capability>, so that <outcome>.` Sized to one slice of behaviour. |
| **Acceptance criteria** | Observable, testable statements. Where a suite already pins one, it is named. |
| **Rules** | The decision rules the story is subject to. Values come from `src/lib/procurement/policy-config.ts` unless stated. |
| **Status** | 🟢 built and tested · 🟡 partial · 🔴 not built |

**Personas** are defined in [../specs/personas.md](../specs/personas.md). This
backlog uses three: **Requester** (raises demand), **Buyer** (procurement
operator), **Reviewer/Approver** (governs).

**Ground rules that constrain every story below** — from
[CLAUDE.md](../../CLAUDE.md):

1. **Standardised and white-label.** No organisation or sector naming anywhere in
   code, copy, or data.
2. **Own the record, defer upstream execution.** The front door classifies,
   recommends, routes, and creates the *internal* record. It never writes to ERP,
   CLM, payment, supplier-network or risk-provider systems; those are deep-links
   and R2 connectors.
3. **Server-authoritative writes.** Anything that creates a record recomputes the
   decision from stored data, treats the client's version as advisory, and is
   idempotent.
4. **Never record a check that did not run.** A `pass` written for a screening
   nobody performed is worse than no record at all.

**A note on the two experience densities.** Simple and Expert are one page and
one engine. `density` selects the header framing and how much *evidence* is
shown — never a step, a gate, a decision, or what is written, and never a
blocker. Every story below applies to both unless it explicitly says otherwise.

---

## EPIC 1 — Get a demand into the system without knowing procurement

**Problem.** A requester knows what they need, not how the organisation buys it.
Every question the front door asks them to answer *about procurement* rather than
*about their need* is a defect.

### Feature 1.1 — One box on the home screen

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 1.1.1 | As a **Requester**, I want to type what I need in plain language on the home screen, so that I do not have to know which form to open. | Free-text entry is the primary action on Home in both densities. Pressing enter routes without any further choice. | 🟢 |
| 1.1.2 | As a **Requester**, I want a buying request to go straight into intake, so that I am not dropped into a chat that cannot submit anything. | A demand navigates to `/requests/new?q=<text>`; only lookups and open questions reach the AI assistant. A demand is recognised by **what it names**, not by a verb list — "business consulting", "cleaning services for the Berlin office" and "IT strategy consulting with Accenture" are demands. An explicit opener ("find …", "show me …") is still a lookup. Pinned by `test:assistant-intents`. | 🟢 |
| 1.1.3 | As a **Requester**, I want my wording carried into intake, so that I never retype it. | The text arrives as the describe-step prefill and classification runs on it without another keystroke. Pinned by `test:unified-intake`. | 🟢 |
| 1.1.4 | As a **Requester**, when what I typed is an off-the-shelf item, I want to be told what was recognised and given a direct link to order it. | The bar names the item (name · price · lead time) with a link to its governed checkout. It **never navigates on the requester's behalf**. Pinned by `test:assistant-intents`. | 🟢 |
| 1.1.5 | As a **Requester**, I want to reject a wrong catalogue match in one click. | "Not what you need? Describe it in full" is always present beside the match and carries the original wording into intake. | 🟢 |
| 1.1.6 | As a **Requester**, I want to attach a brief instead of typing. | PDF/DOCX upload extracts text server-side (`/api/intake-upload`) and seeds the description for confirmation. | 🟢 |

**Rules**
- The catalogue is offered only when `decideIntakeRoute` returns `catalogue`, which needs **all three** gates: the category is catalogue-eligible (`procurement_categories.catalogue_eligible`), the match hits a word that *names* the thing (not only a modifier like "business" or "premium"), and the score clears `catalogueMatchThreshold` (0.5, i.e. one description-level hit).
- The LLM's `intent` is authoritative **except** that a `catalogue` intent cannot route to an empty or ineligible catalogue; the override is recorded on `llmOverruled` and shown, not hidden.

**Technical** — `src/features/dashboard/components/smart-command-bar.tsx`, `src/lib/procurement/intake-routing.ts` (pure, benchmarked by `test:intake-routing` + `test:intake-routing-eval`), `api/ai.ts` (AI-001 Category Classifier).

### Feature 1.2 — Commodity assessment without a category picker

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 1.2.1 | As a **Requester**, I want the system to work out the category, so that I never choose between "Goods" and "Contingent Labour". | There is **no category grid**. The broad category is internal routing metadata (ADR-0005). Pinned by `test:ui`. | 🟢 |
| 1.2.2 | As a **Requester**, I want to see and correct the commodity/service family it inferred. | Up to 3 candidates with a confidence and the reason each matched, plus "None of these". | 🟢 |
| 1.2.3 | As a **Buyer**, I want classification accuracy tracked against a labelled set, so that a prompt change cannot silently regress it. | `test:classification-eval` reports accuracy against a baseline (CLS-G1). | 🟢 |
| 1.2.4 | As a **Requester**, I want classification to work when the AI is unavailable. | A deterministic keyword classifier answers, and the screen says which produced the answer ("AI Classification" vs "Keyword match"). | 🟢 |

**Rules**
- A **route is not a category.** A classifier answering `catalogue` is converted to an *intent*; the route is decided by the buy-route step. Guarded by `ROUTE_LIKE_CATEGORY` on both the step-1 path and the `?category=` deep link — without it, a paper-and-toner demand puts the whole wizard on the fast track before the funnel runs.

**Technical** — `src/features/requests/new-request/step-category.tsx`, `src/lib/procurement/classify.ts`, `src/lib/procurement/commodity-candidates.ts`.

---

## EPIC 2 — Show the requester how this will be bought, and why

**Problem.** The buying channel is the most consequential thing the front door
decides — a two-day catalogue order versus a multi-week sourcing exercise. It was
stated in procurement's vocabulary, four steps after it became knowable.

### Feature 2.1 — One screen, three routes

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 2.1.1 | As a **Requester**, I want to see every way to buy this at once, so that I can compare rather than be walked through a funnel. | Catalogue, contract call-off and full request all render together, recommendation first and badged. Pinned by `test:ui`. | 🟢 |
| 2.1.2 | As a **Requester**, I want each option in language I understand with a rough timeline. | Each option shows a plain headline and detail (`buyingChannelPlain`) plus the category SLA in days. | 🟢 |
| 2.1.3 | As a **Requester**, I want a route that is not available to tell me why, in place. | A ruled-out route states its reason on the option itself and stays clickable. Silence is as unhelpful as a wrong suggestion. | 🟢 |
| 2.1.4 | As a **Requester**, I want to add detail when nothing matched, so that a better match can be found. | One enrichment box (not one per stage). Using a detail **clears the box** and confirms it landed; the text sharpens the match and seeds the service description, and is counted **once** — it used to be appended to the title while the box kept its contents, so the demand read the detail twice and the request was renamed to the run-on. | 🟢 |
| 2.1.7 | As a **Requester**, I want to be asked the specific question that would settle the match. | When the matcher has a clarifying question (ADR-0004) that question is what the detail box asks, rather than a generic "add more detail". | 🟢 |
| 2.1.8 | As a **Requester**, I don't want a list of contracts I cannot act on. | Candidates appear only once the matcher confirms coverage or the requester supplies detail. Four contracts behind disabled "Confirm details first" buttons is furniture, not a choice. | 🟢 |
| 2.1.5 | As a **Buyer**, I want to audit why a route was chosen. | "Why this?" (Expert only) shows the matched words, item scores, contract fit %, utilisation and the routing rule id that decided the channel. | 🟢 |
| 2.1.6 | As a **Requester**, when the catalogue and contract register cannot be reached, I want to be told nothing was checked. | The screen says neither was checked and nothing was ruled in or out, and offers the full-request route. Never a spinner, never "no match" for a check that never ran. | 🟢 |

**Rules**
- **One derivation.** The channel comes from `resolveDemandChannel`; the buy-route screen and the Review step call the same function with the same inputs, so they cannot disagree.
- Routing inputs are the **superset**: category, value, supplier, matched contract, urgency, inherent-risk tier, materiality **and** P-card eligibility. Supplying a subset on one path was how the two densities produced different channels for one demand.
- **P-card eligibility** (`pCardEnabled`, max €5,000, categories `goods`/`services`, never `software`/`consulting`/`contingent-labour`/renewals/onboarding, never when urgent, material, or high/critical risk) is an *input to routing*, not a separate opinion.
- Contract call-off needs a **primary signal** — supplier match, category match, or ≥2 keyword hits — plus remaining capacity ≥5%.

**Technical** — `src/features/requests/new-request/step-buy-route.tsx` (presenter only), `src/lib/routing/demand-channel.ts`, `src/lib/routing/evaluate-routing-rules.ts`, `src/lib/routing/p-card.ts`, `api/contract-match.ts` (ADR-0004).

---

## EPIC 3 — Capture a service description worth reusing

**Problem.** The description is reused by the risk assessment, the sourcing pack
and the contract request. It has to be good, and the requester has to understand
why they are being asked.

### Feature 3.1 — An open conversation, then only the gaps

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 3.1.1 | As a **Requester**, I want to describe my need in my own words first. | The conversation opens with a single open invitation, never the first agenda question, in both the LLM and offline paths. Pinned by `test:intake-guidance`. | 🟢 |
| 3.1.2 | As a **Requester**, I want the first answer to fill in everything it can, so that I am asked as little as possible. | A single paragraph extracts multiple slots in one turn; the agenda is then only what is genuinely missing. | 🟢 |
| 3.1.3 | As a **Requester**, I want every question to say why it is being asked. | Each question carries a reason naming the downstream consumer. Every asked slot has one; asserted by `test:intake-guidance`. | 🟢 |
| 3.1.4 | As a **Requester**, I want the questions to adapt to what I am buying and how much it costs. | Conditional slots are criteria-triggered and state their rationale ("Asked because…"). Pinned by `test:residual-questions`. | 🟢 |
| 3.1.11 | As a **Requester**, I want the conversation to be usable at all. | The input is never left disabled. Under StrictMode the opening effect runs, is cleaned up and runs again; the re-run is a no-op, so the first run's cleanup flag must not gate the typing flag — it did, and the input stayed disabled forever. | 🟢 |
| 3.1.12 | As a **Requester**, I want a question I cannot answer to move on. | The need-by date is parsed, so an unreadable answer is rejected before it is written and the same question used to come back forever. It is now asked twice, then left open — and the turn that says so asks the **next** question, not the abandoned one. | 🟢 |
| 3.1.5 | As a **Requester**, I want to say "I don't know" without being trapped. | A thin answer is challenged **once**, with an offered draft; the second answer is accepted and flagged `weak`, never blocked. The challenge-once rule is pinned by `test:intake-guidance`; the judge itself by `test:answer-quality`. | 🟢 |
| 3.1.6 | As a **Requester**, I want to see how close I am to a usable description. | Progress is stated against the goal — "Enough for the risk assessment and sourcing: 6 of 8" — over the questions *this* demand is actually asked. | 🟢 |
| 3.1.7 | As a **Reviewer**, I want to know which parts nobody really wrote. | Every section carries provenance: `answered`, `document-extracted`, `assistant-drafted`, `reviewer-edited`, `weak`. | 🟢 |
| 3.1.8 | As a **Buyer**, I want to configure the questions without a deploy. | Slots (question, example, required, condition) are admin config per category with a `default` row; the built-in set is the fallback. `/admin/service-description`. | 🟢 |
| 3.1.9 | As a **Requester**, I want the conversation to keep working when the AI is down. | The same engine drives an offline fallback: same slots, same order, same completeness rule; no narrative is invented. | 🟢 |
| 3.1.10 | As a **Requester**, I want the chat to look like the rest of the product. | Both panes are built from the product's `Card` primitives, and the conversation carries the documented AI visual language (blue-tinted surface, `border-l-2 border-blue-400`, sparkle, "AI-guided intake" label — design-document §7.3). The layout stays two-up: a conversation beside what it is producing is the right shape for the task. | 🟢 |

**Rules**
- The **engine**, not the model, decides which slot is asked and when the conversation is complete. The LLM only rephrases the chosen question in context, extracts structured data, and judges the answer. A model reply that is not one short question is rejected and the canned wording used.
- The completeness floor is `requiredSlotsFilled` — deliberately the mandatory floor, not "every slot the template marks required", so an LLM cannot short-circuit the conversation.
- Sections marked `asked: false` (e.g. `location`) are inferred at generation, never asked.

**Technical** — `src/features/requests/new-request/step-chat-intake.tsx`, `src/lib/procurement/demand-conversation.ts`, `api/chat-intake.ts`, `api/generate-sow.ts`, `src/lib/db/service-description-templates.ts`.

---

## EPIC 4 — Ask everything before concluding anything

**Problem.** Seven steps interleaved questions and conclusions. The risk screen
was eight cards of which exactly one was a question, with nothing marking which
was which.

### Feature 4.1 — Four steps, one config

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 4.1.1 | As a **Requester**, I want a short, legible path. | Four steps — Describe → How you'll buy → Details → Review & submit — plus a confirmation outcome. Pinned by `test:intake-guidance`. | 🟢 |
| 4.1.2 | As a **Requester**, I want every question in one place. | Details holds the service description, the residual risk questions, the IT security form (software) and supplier selection. Nothing after it asks for anything. | 🟢 |
| 4.1.3 | As a **Requester**, I want a disabled Next to tell me what is missing. | Chat path names the outstanding slots; form paths name the missing fields ("To review this request, add a title, an estimated value"). | 🟢 |
| 4.1.4 | As a **Requester**, I want each step to say what it is for and what follows. | A header panel per step: purpose, what you provide, what happens next — held in the same config as the step's order and gate. | 🟢 |
| 4.1.5 | As a **Buyer**, I want the catalogue fast track to skip governance it does not need. | The catalogue route has no Review step: pre-approved, pre-priced items reach no determination, and none is manufactured to make the step counts match. | 🟢 |
| 4.1.6 | As a **Developer**, I want step order to live in one place. | `intake-steps.ts` owns order, per-route applicability, gates and guidance. Renumbering used to mean editing five hand-synced places. | 🟢 |
| 4.1.7 | As a **Developer**, I want deep links parsed where they can be tested. | `intake-deep-link.ts` is pure: the `?q=`, `?step=2&category=…` and `?catalogueItem=…` links parse without React, and the page no longer reads `searchParams` at all. Pinned by `test:unified-intake` and `test:assistant-intents`. | 🟢 |

### Feature 4.2 — Risk, asked as questions

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 4.2.1 | As a **Requester**, I only want to be asked what could not be inferred. | The mini-IRQ asks 0–2 switches (privileged access, critical service), each with its "asked because" reason, and says so when there is nothing to ask. | 🟢 |
| 4.2.2 | As a **Requester**, I want the risk questions beside the demand they refer to. | They render on Details, not four screens later. | 🟢 |
| 4.2.3 | As a **Service owner**, I want to confirm or reject a proposed reuse of an existing risk assessment. | 🔴 The reuse decision is computed and shown; there is no explicit accept/reject control (RSK-05). | 🔴 |

**Rules**
- The critical-service question is asked at/above `criticalServiceThreshold` (€100,000). Residual questions are *deltas only*: asked when the description cannot answer them **and** the answer would change the determination.
- Inherent risk is a highest-attribute-wins cascade over data sensitivity, supplier risk rating, value (`riskMediumValue` €50,000, `riskHighValue` €250,000), privileged access and critical service.
- Data sensitivity is inferred conservatively: an unknown sensitive term reads **high**, not low.

**Technical** — `src/features/requests/new-request/intake-steps.ts`, `step-compliance.tsx` (`section: 'inputs' | 'conclusions'`), `src/lib/procurement/residual-questions.ts`, `risk-segmentation.ts`, `demand-signals.ts`.

---

## EPIC 5 — Show what was concluded, in language that means something

### Feature 5.1 — The Review step

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 5.1.1 | As a **Requester**, I want to understand the full process before I submit. | The channel leads in outcome language with its timeline, and "What happens next:" names the whole downstream chain. Pinned by `test:ui`. | 🟢 |
| 5.1.2 | As a **Requester**, I want each group to say what it means for me. | Four groups **in that order** — How you'll buy · Risk · Routing & approvals · Checks we ran — each with a one-line meaning. The channel leads, because it is what has to be understood before submitting. | 🟢 |
| 5.1.9 | As a **Reviewer**, I want the screen not to contradict itself. | Contract coverage requires a **selected supplier**: without one the check matched any contract in the category, so one screen claimed coverage, denied it, and disabled the approval-to-source gate. The inherent-risk tier is stated once. | 🟢 |
| 5.1.10 | As a **Requester**, I want the confirmation to tell me what actually happens. | It lists the determination's own handoff steps — no named reviewer, no fixed SLA, and no promise of email, because nothing sends email and no notification fires on a stage transition. | 🟢 |
| 5.1.3 | As a **Requester**, I want the risk outcome as a consequence, not a tier. | "A risk assessment is required — nothing for you to do now" / "No new risk assessment needed — an existing assessment covers it", rather than "Inherent risk: medium · Internal data". | 🟢 |
| 5.1.4 | As a **Requester**, I want to know who approves this and in what order. | The value-banded chain, by role, with the lifecycle the template implies and the conditional stages this demand triggers. | 🟢 |
| 5.1.5 | As a **Buyer**, I want the workings without cluttering the requester's screen. | Expert density adds the routing rule id, inherent-risk drivers, per-dimension operational risk, the Smart Assessment projection and the Markdown export. | 🟢 |
| 5.1.6 | As a **Requester**, I want to be told when something blocks my request, whichever view I am in. | A blocking screening result renders in both densities. Hiding a blocker is not a density decision. | 🟢 |
| 5.1.7 | As a **Buyer**, I want the determination exportable. | `Export` produces structured Markdown (`determination-export.ts`); pinned by `test:determination-export` and `test:ui`. | 🟢 |
| 5.1.8 | As a **Reviewer**, I want to see which required description sections are still missing. | Gaps are reported against the same required-section list generation was given — never silently regenerated behind the requester. | 🟢 |

**Rules**
- **Approval to source**: no gate when a transactable contract is an early exit; otherwise **light** (demand validation + cost centre) or **full** (+ intent-to-source + category approval) at/above `approvalFullThreshold` (€250,000), or when material, or high/critical inherent risk.
- **Materiality**: material on value at/above `materialityValueThreshold` (€1,000,000), or by data sensitivity, supplier risk rating, or a critical-service answer.
- **Competitive sourcing** applies at/above `competitiveSourcingThreshold` (€25,000) with `minCompetitiveQuotes` (3), unless the supplier is preferred (performance ≥ `preferredMinPerformance` 75).
- **Approval chain** is a foreign key to a configured chain selected by value band — never the routing rule's role vocabulary, which is not an id.
- **Second contract check** treats a contract as transactable below `contractUtilisationHeadroom` (95%) utilisation and flags one expiring within `contractExpiryBufferDays` (60).

**Technical** — `src/lib/procurement/intake-determination.ts` (pure, `now` injected, no density parameter), `use-intake-determination.ts` (mounted once per intake), `approval-to-source.ts`, `materiality.ts`, `second-contract-check.ts`, `handoff.ts`, `referral.ts`, `screening.ts`, `workflow-steps.ts`.

---

## EPIC 6 — One engine, two densities

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 6.1.1 | As a **Requester**, I want the same governance outcome regardless of which view I use. | One determination and a byte-identical compliance record for the same demand. Pinned by `test:mode-equivalence`. | 🟢 |
| 6.1.2 | As a **Developer**, I want density to be structurally incapable of changing a decision. | The decision layer takes no `density`/`mode` parameter and contains no `'simple'`/`'expert'` literal; asserted by reading the module. | 🟢 |
| 6.1.3 | As a **Developer**, I want no second intake page that can drift. | `simple-new-request-page.tsx` does not exist; density may not branch a step or the submit. | 🟢 |
| 6.1.4 | As a **Requester**, I want switching view to take effect immediately. | The optimistic selection is a shared module store, so the switcher and the page cannot disagree. | 🟢 |
| ~~6.1.5~~ | ~~As a **Requester**, I want my view preference remembered.~~ | **Withdrawn (ADR-0008).** There is one UI, so there is no view to remember. What the switch changed was copy and whether the workings were shown at all; simplification now comes from the role's default dashboard layout. | — |

**Rules** — Density is a **UI density decision, not an authorization boundary**
(ADR-0001). Route guards and entitlements are unchanged by it.

**Technical** — `src/hooks/use-experience-mode.ts`, `src/lib/experience-mode.ts`, `src/components/layout/experience-mode-switcher.tsx`.

---

## EPIC 7 — Records that can be believed

**Problem.** A compliance record is evidence. Both intake paths were writing
claims they had not earned.

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 7.1.1 | As a **Reviewer**, I want to know whether a check ran, not just its result. | `duplicateCheck.performed` is `false` while no duplicate search exists; the SRA can read `not-run` distinctly from `not-applicable`. Pinned by `test:intake-evidence`. | 🟢 |
| 7.1.2 | As a **Reviewer**, I want the SRA outcome derived from the supplier record. | `valid`→pass, `expiring`→warning, `expired`/`not-assessed`→**fail**, no supplier→not-applicable. It used to be derived by string-matching a rendered label, so a never-assessed supplier recorded a pass. | 🟢 |
| 7.1.3 | As a **Reviewer**, I want a disabled policy validator to say so. | An inactive AI-002 produces one failed check naming the agent — never an empty list, which reads as "all clear". | 🟢 |
| 7.1.4 | As a **Developer**, I want the determination to be deterministic. | `now` is an input; the same demand twice is the same answer, and the channel, risk tier and policy checks do not move with the calendar. Pinned by `test:intake-determination`. | 🟢 |
| 7.1.5 | As a **Requester**, I want submission to be atomic. | `/api/intake-submit` commits request, service description, compliance record, stage history and workflow instance together, with an idempotency key. | 🟢 |
| 7.1.6 | As a **Developer**, I want a duplicate-demand search to actually exist. | 🔴 Nothing searches for duplicates. Until it does, the record says so. | 🔴 |
| 7.1.7 | As a **Developer**, I want request ids that cannot collide. | 🔴 `REQ-2025-${1000..9999}` is regenerated per attempt and both idempotency keys derive from it, so a retry gets a new key and the space can collide. | 🔴 |

| 7.1.8 | As a **Requester**, I want the assistant never to tell me something was done when it was not. | Asking to buy something offers a **pre-filled** request and says nothing is created until you submit. Three defences, because a prompt rule is a request and not a mechanism: the `start_demand` result states `created/submitted/routed: false`; the system prompt forbids completion claims; and a deterministic guard replaces the sentence if the model produces one anyway. Pinned by `test:assistant-honesty`. | 🟢 |
| 7.1.9 | As a **Requester**, I want an assistant action to say where it actually went. | The six action types that reach no upstream system say the action is noted for the session, that nothing has been sent, and where to raise it. They used to answer "Task created and routed to the relevant team. Reference: ACT-1234" — an in-memory push to an array with no consumer. | 🟢 |

**Rules**
- The assistant **proposes**; it never executes an upstream write (ground rule 2). `create_ticket` is the only tool that creates a real record, and it is the only one permitted to say so.
- A false completion claim is the most damaging output available to this product: unlike an error it is invisible, it is believed, and the requester stops chasing work nobody has picked up.

**Technical** — `src/lib/procurement/intake-compliance-record.ts`, `submit-intake.ts`, `api/intake-submit.ts`, `src/data/request-compliance.ts`, `api/chat.ts` (`claimsWorkAlreadyDone`, `demandOfferedMessage`), `src/lib/assistant/capabilities/action.ts`.

---

## EPIC 9 — The home dashboard, and the profile behind it

**Problem.** The dashboard had eighteen widgets and none for purchase orders,
invoices or supplier onboarding — so a PO waiting on a receipt, an invoice
nobody could match, and a supplier blocking a contract were all invisible until
someone opened the module. And the profile those requests draw their defaults
from had nowhere to be seen or corrected.

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 9.1.1 | As a **Buyer**, I want the POs still waiting on something on my home screen. | Open POs, overdue first; draft and closed excluded because neither waits on anybody. | 🟢 |
| 9.1.2 | As a **Buyer**, I want the invoices that need a decision, not all of them. | Disputed, unmatched, variance or overdue only — one stated reason per row. | 🟢 |
| 9.1.3 | As a **Vendor manager**, I want to see which suppliers are blocking work. | Onboarding or screening incomplete, each row naming which gate it is. Distinct from the risk-alert widget, which ranks suppliers already in use. | 🟢 |
| 9.1.4 | As a **Requester**, I want to see where the request book sits. | A count per active stage with a click through to that filtered list; terminal states excluded. | 🟢 |
| 9.1.5 | As a **Developer**, I want the catalogue and the renderer to agree. | Every widget id is in both the registry and the component map, and every icon is in the picker's map — otherwise a tile is invisible, unreachable, or silently generic. Pinned by `test:dashboard-widgets`. | 🟢 |
| 9.2.1 | As any user, I want to see who I am signed in as and where I am. | The header shows name, role and **location**, and the menu carries the email and a link to Profile & settings. | 🟢 |
| 9.2.2 | As a **Requester**, I want to set the defaults my requests are pre-filled from. | `/settings` → Profile shows the directory identity and an editable procurement profile — cost centre, currency, budget owner, legal entity, default delivery location. | 🟢 |
| 9.2.3 | As a **Requester**, I want approved delivery locations to be trustworthy. | Read-only and administrator-maintained: a governed checkout rejects a location the profile does not approve, so it is governance data rather than a preference. | 🟢 |

**Technical** — `src/features/dashboard/widget-registry.tsx`, `widgets/` (`widget-open-pos`, `widget-invoice-exceptions`, `widget-supplier-onboarding`, `widget-requests-by-stage`), `components/add-widget-dialog.tsx`, `src/components/layout/role-switcher.tsx`, `src/features/settings/components/procurement-profile-card.tsx`.

---

## EPIC 8 — Governed fulfilment (catalogue and contract)

| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| 8.1.1 | As a **Requester**, I want to order a catalogue item in a few fields. | The item detail page is the single governed checkout entry point; quantity, need-by, delivery location, recipient, purpose and cost centre. | 🟢 |
| 8.1.2 | As a **Requester**, I want accounting defaults filled from my profile, not asked for. | Cost centre, delivery location and beneficiary come from `procurement_profiles`. All three are **shown pre-filled and changed from a picker**, never typed: the options are the active rows of `cost_centres` and `delivery_locations`, which is exactly what the governed checkout accepts. Before, one checkout offered five **invented** cost centres, the other free text, and the delivery location was validated against a list on the profile that nothing ever populated. | 🟢 |
| 8.1.3 | As a **Buyer**, I want an ambiguous contract refused, not guessed. | Two active contracts for one item produce an error ("procurement must select one"), never a silent pick. Pinned by `test:mode-equivalence`. | 🟢 |
| 8.1.4 | As a **Buyer**, I want only real risk assessments used. | Only `completed` assessments count, and an unexpired one is preferred. | 🟢 |
| 8.1.5 | As a **Requester**, I want a call-off to make clear it is not the whole contract. | The Details step states that the contract ceiling is not the value of this individual call-off. | 🟢 |
| 8.1.6 | As a **Buyer**, I want delivery locations validated. | `shipToLocationId` must be one the profile approves; a value outside the list is rejected by `evaluateGovernedCheckout`. | 🟢 |

**Technical** — `src/lib/procurement/governed-checkout.ts`, `submit-governed-checkout.ts`, `api/governed-checkout.ts` (ADR-0002), `src/features/catalogue/catalogue-order-checkout.tsx`, `new-request/contract-call-off-checkout.tsx`.

---

## Open backlog — not built

| # | Story | Why it matters | Size |
|---|---|---|---|
| OB-1 | Duplicate-demand search at intake | The compliance record currently has to say no search ran. A real search closes a governance gap rather than documenting it. | M |
| OB-2 | Service-owner confirmation of risk-assessment reuse (RSK-05) | A reuse decision is proposed and recorded without the owner ever accepting it. | S |
| OB-3 | Collision-safe request ids and stable idempotency keys | A retry currently gets a new key, defeating replay protection. | S |
| OB-5 | Server-side reads through the connector ports | `src/server/api/*` and `api/governed-checkout.ts` read with raw SQL because the port layer is browser-shaped (TanStack hooks) with no server factory. | L |
| OB-6 | Editable in-flight requests | Once submitted, a requester cannot revise scope without a refer-back. | M |
| OB-7 | Attachment blob storage | Uploads are extracted to text; the original file is not retained. | M |
| OB-9 | A duplicate-search, or drop the field | Tracked as OB-1; noted here because `duplicateCheck` is the last compliance field with no producer. | M |
| OB-10 | Notifications on stage transitions | Nothing creates a notification when a request moves stage, so a requester has no signal at all — the confirmation now says so rather than promising email. | M |
| ~~OB-11~~ | ~~A cost-centre reference source~~ | **Closed.** `cost_centres` and `delivery_locations` are administered tables (Admin → Cost Centres / Delivery Locations), seeded with the codes existing records already carry. `evaluateGovernedCheckout` rejects an id that is absent or inactive, resolved from the **server's own read** — it previously validated the delivery location against a list the browser supplied. | — |
| OB-8 | Assistant actions reach the teams that act on them | Six action types (risk reassessment, contract renewal, PO change, payment escalation, approver substitution, reassignment) currently go nowhere. The assistant now says so instead of claiming a task was routed, but the capability itself is unbuilt — and `getActivityLog` has no consumer, so the local record is not visible either. | M |

---

## Traceability

| This backlog | Source of truth |
|---|---|
| Capability status | [R1_BACKLOG_FIT_GAP.md](R1_BACKLOG_FIT_GAP.md) |
| Per-story detail and `POL-xx` policy defaults | [R1_STORY_FIT_GAP.md](R1_STORY_FIT_GAP.md) |
| Evidence (code, schema, tests, ADRs) | [R1_IMPLEMENTATION_EVIDENCE.md](R1_IMPLEMENTATION_EVIDENCE.md) |
| Test scope per area | [../testing/TEST_PLAYBOOK.md](../testing/TEST_PLAYBOOK.md) |
| Functional and UX detail | [../specs/functional-specification.md](../specs/functional-specification.md), [../specs/design-document.md](../specs/design-document.md) |
| Intake architecture and the density contract | [../../src/features/requests/README.md](../../src/features/requests/README.md) |
| Decision records | [ADR-0001 dual-mode](../adr/0001-dual-mode-requester-experience.md) *(superseded)*, [ADR-0008 one standardised UI](../adr/0008-one-standardised-requester-ui.md), [ADR-0002 governed checkout](../adr/0002-governed-catalogue-checkout.md), [ADR-0004 contract scope matching](../adr/0004-contract-scope-matching.md), [ADR-0005 unified intake](../adr/0005-unified-ai-guided-intake.md) |

> Thresholds quoted here are the **defaults** in `src/lib/procurement/policy-config.ts`.
> Admin overrides change behaviour without a deploy; the code is the source of truth.
