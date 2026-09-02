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
| `buying-channel-stages.ts` | Which stages a channel actually has |
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
