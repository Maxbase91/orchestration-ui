# Workflow — the orchestration layer

How a request moves: one transition primitive, an engine that runs to the next gate, and a
config plane that is actually read at runtime.

| File | What it is |
|---|---|
| `transition.ts` | **The single way a request changes stage.** Both callers use it |
| `node-config.ts` | The gate model + `nodeToStatus` — shared by the engine and the UI so they cannot drift |
| `engine.ts` | `initWorkflow` → `advanceInstance` → `executeNode`; edge conditions; compliance report |
| `open-items.ts` | One rule for "who owns this and what is open", replacing four inline derivations |
| `risk-stage.ts` | The conditional risk stage — reuse an existing assessment, else raise a draft |
| `onboarding-stage.ts` | Vendor onboarding: the light gate (sourcing + risk completion) and the full gate (contracting) |
| `approver-resolution.ts` | Chain role → directory rep |
| `channel-stages.ts` | Which stages a channel has — **derived from the workflow templates**, which claim their channels. Replaced `buying-channel-stages.ts`, a code map that disagreed with the templates for every channel |
| `stage-labels.ts` | What a stage is called. Was ten copies with five different answers for `po` |
| `stage-sla.ts` | A stage's SLA in working days, from the template node that owns it. Returns **null**, never a default — replaced `src/lib/db/sla-targets.ts`, whose `resolveSla` answered 5 for any stage nobody had configured |
| `business-days.ts` | `slaDeadlineFor` / `addBusinessDays` — the one place a deadline is computed, dependency-free so `api/` can use it |
| `channel-plan.ts` | The stages a request will go through, worked out **before** it is submitted — the Channel page's Step by step. Runs the two rules that actually move a request: the server's landing (`firstActionableStage` for intake, `checkoutEntryStage` for a call-off, each with its declared `*_ENTRY_CONDITIONS`) and the engine's own `getNextNodeIds` from there. A signal not yet known (no supplier chosen → onboarding) is walked both ways, so a conditional stage carries the branch's own condition. Stages come in graph order, not authoring or breadth-first order; each is *here* / *applies* / *conditional* / *skipped* with the reason (a branch that did not hold, the entry rule's condition, or "only after" a skipped stage). `applicabilityTag` words it; value comparisons resolve through the governed thresholds |
| `edge-conditions.ts` | What decides which way a node branches: a typed condition in the routing vocabulary, or a workflow signal (`outcome`, `riskRequired`, `onboardingRequired`, `contractAmendmentRequired`) evaluated here — the routing evaluator does not know the signals, and handing them to it made every one false, so a rejected approval took "Approved". Also `getNextNodeIds` and `diagnoseTemplate`, which flags any node the engine cannot branch from unambiguously: two unconditioned exits, a `parallel` split (the engine follows one branch), or an approval with no "Rejected" exit |
| `workflow-steps.ts` | The template-derived lifecycle preview shown at intake |

## Why `transition.ts` exists

There were **two** mechanisms that changed a request's stage and did not know about each other:

- `api/workflow-action.ts` did it properly — close the open `stage_history` row, open a new one,
  reset `days_in_stage`, carry the owner.
- The engine called `updateRequest({ status })` directly and wrote **no stage history at all**.

Both steppers derive "complete" and "per-stage owner" **exclusively** from `stage_history`. So a
request created through the wizard rendered with no owner, no date and nothing completed — it had
genuinely never been recorded as entering anything. `transitionStage` is that logic extracted, and
it is now the only path. It is idempotent on stage, so a repeat call is a no-op rather than a
duplicate row.

Do **not** use `appendStageHistoryEvent` for a transition: it stamps `completed_at = now`
deliberately, for non-transitional events. That is exactly why it cannot be the transition path.

## The engine runs to the next gate

`advanceInstance` used to execute at most two nodes and hard-return. On submit it ran
`start` → `Intake`, parked the pointer on `Validation`, and stopped **without executing it** — the
instance was left `running` with nothing scheduled to run it, and no UI offered a forward action.
Every one of the eight live instances was in that state.

It now loops until a node returns `suspend` or `complete`, bounded by `MAX_STEPS_PER_ADVANCE`.

**Resume semantics.** The node you are suspended *on* has already executed — that is why you are
suspended. Re-running it re-fires its own gate, forever. So `advanceInstance(…, resuming)` skips
execution of the first step and advances *from* it. This is the subtle one; the regression test for
it is in `tests/integration/orchestration.mjs`.

## The gate model

```ts
DEFAULT_AUTO_STAGES  = { 'intake' }              // everything else waits for a human by default
ALWAYS_SUSPEND_STAGES = { 'approval', 'sourcing' } // structural, not configurable
isGatedStage(node, status)  // node.gate === 'manual' | 'auto' overrides the default
```

The default is deliberately restrictive. An earlier cut auto-advanced past PO, receipt, invoice and
payment — stages that unambiguously need someone to do something.

## No template, no instance

`initFallbackWorkflow` used to create an instance with `template_id = 'fallback:<channel>'`, which
`getWorkflowTemplate` can never resolve. That was worse than creating nothing: `advanceWorkflow`
returns early on an unresolvable template, and the Complete-stage action only takes its own
no-instance path when there is genuinely **no** instance — so the button found the fallback row,
called `advanceWorkflow`, nothing happened, and it still reported success. The request could not be
moved at all.

Now there is no instance. The channel's stage list is the whole fallback, walked by
`nextStageAfter` + `transitionStage` — the path 93 of 101 live requests already take.

## Vendor onboarding is two gates, not one stage

Onboarding sat where risk sat before R4 — a synthetic step in the intake preview
with no status, no stage in any channel and no node in any template — and it
could not even be triggered, because the intake picker only offered the existing
directory and "a new supplier was selected" was inexpressible.

The same vendor is asked for different things depending on what is about to
happen to them, so one gate would be wrong in both directions:

| Gate | What it needs | What it blocks |
|---|---|---|
| **Light** | The supplier record exists and screening has cleared | **Sourcing** — you cannot invite a supplier that does not exist. **Completing the risk assessment** — it hangs off a supplier record |
| **Full** | `onboarding_status = 'completed'` | **Contracting**, for the awarded supplier only |

Demanding full onboarding before sourcing blocks every competitive event on
paperwork for vendors who may not win; demanding only light onboarding before
contracting signs a contract with a vendor nobody can pay.

`applyAwardToRequest` routes a winner who is not fully onboarded to `onboarding`
rather than `contracting`. That is where the gate must hold — it is the write
path that moves a request past sourcing.

**The node is the visible stage; the gates are the guarantee.** WF-001 models
onboarding behind a conditional edge, but the gates hold on every path including
ones that edge does not cover. `needsOnboarding` fails *open* on a read error so
an unreachable supplier table cannot park every request on a stage nobody asked
for; the gates themselves fail *closed*.

`prospective` is not `onboarding_status <> 'completed'`. An established supplier
can be mid-data-refresh; a prospective one has never been transacted with. The
old trigger (`!supplierId || !supplierData.complete`) conflated them, which is
why it fired on nearly every request and meant nothing.

## Config that is now read at runtime

A node carries `role`, `slaDays`, `purpose` and `gate`. The designer collected several of these and
then **stripped them on save**, persisting only `id/type/label/x/y`; a round-trip also collapsed the
node type. Now they persist, and the engine uses them: `owner_id` from the role, `sla_deadline` from
`slaDays` — the first thing that ever populated `sla_deadline`, which is what makes the existing SLA
countdown and the bottleneck views tell the truth.

An **unknown role resolves to nobody** and leaves the stage unassigned, rather than silently
resolving to one particular user. An unassigned stage you can see beats a wrong owner you cannot.

`sla_deadline` is now written **every time a stage opens, including as NULL** — at creation
(`api/_domains/intake-submit.ts`, `api/governed-checkout.ts`) and on every stage change
(`api/workflow-action.ts`, `transition.ts`). Both change paths previously wrote it only when the new
node happened to carry an `slaDays`, so a request moving into a stage without one kept the
**previous** stage's deadline: out of a 1-day Intake into a 20-day Sourcing, red the next morning,
and in the Stuck and bottleneck views for the remaining nineteen days. There is exactly one source —
the node for the stage being entered — and exactly one arithmetic (`business-days.ts`).

Approval chains resolve explicit chain → value band → `'chain-1'`. The intake wizard persists the
selected `approval_chains.id` — never a routing rule's human-readable role label — because the
request column is a foreign key. `npm run test:approval-chain-persistence` verifies the chosen key
round-trips through the real database. Previously the engine selected a
`requests.approval_chain` column that **did not exist**: PostgREST errored, the error was discarded,
and every request in the system got the Standard chain regardless of value.

## Risk is a conditional stage

Inserted when intake triage requires it and no reusable assessment matched — which is what the
wizard's amber banner had been promising all along while nothing created a `risk_assessments`
record. `ensureRiskAssessment` reuses via `findMatchingRiskAssessments` (adding the request to
`linkedRequestIds`) before creating a draft, and returns null when there is no supplier or contract
to assess. The lifecycle preview filters the risk step by the same signal, so it no longer promises
a stage that will not appear.

## Tests

    npm run test:orchestration     # gates, transitions, resume semantics, owner/SLA, chain banding
    npm run test:onboarding-stage  # the two onboarding gates and the award routing
    npm run test:workflow-steps  # the template-derived lifecycle preview
    npm run test:approval-chain-persistence # selected chain foreign-key persistence
    npm run test:e2e             # request → approval, end to end (needs NEON_DATABASE_URL)

## Which template runs which channel

Each channel is claimed by exactly one template (`channels`), and every writer
resolves the template by the channel — the intake writer, the governed checkout
and the backfills. Never by a literal id: the checkout wrote `'WF-001'` for every
contract call-off, so call-offs ran the procurement-led lifecycle.
Nor by category, and never from the browser: intake derived a template from the
category (the standard procurement template for nearly everything) and submit
preferred it, so a business-led request would have run the procurement-led
lifecycle. Submit takes `templateForChannel` only; the Review preview uses the same
rule, and the call-off's instance is created by the checkout alone.

| Channel | Template |
|---|---|
| procurement-led | WF-001 Standard Procurement — Intake → Validation → (risk) → (onboarding, for a named new supplier) → Approval → Sourcing → Contracting → PO → Receipt → Invoice → Payment |
| catalogue | WF-002 Catalogue Purchase |
| business-led | WF-006 Business-Led Buying — always a risk review; onboarding only for a new supplier; Contracting (Legal) after approval, before the PO |
| framework-call-off | WF-008 Contract Call-Off — no sourcing, no onboarding; Contracting only when the checkout found the contract needs amending, risk only when the supplier's assessment cannot be reused |

Direct PO (WF-005) and P-card (WF-007) were retired on 2026-09-25: no path from the intake reached either honestly.

The side processes WF-003 (supplier onboarding) and WF-004 (contract renewal) were retired on the same day: nothing ever started one. Onboarding is the Vendor Onboarding stage inside a request whose supplier is new; a renewal is a demand like any other, and the contract check recognises it when the covering contract is expiring.

The template also carries what the **requester reads** about its channel — a
headline and one sentence (`requesterHeadline` / `requesterDescription`, edited in
Admin → Workflows beside the channels). `channelCopy(templates, channel, label)`
returns them, falling back to the channel label when a template has none. They
used to be a table in the routing code, so a rebuilt lifecycle kept its old promise
on the intake screens. Filled live from the seed by `npm run backfill:channel-wording`
(fill-only — an admin's wording is never overwritten).
