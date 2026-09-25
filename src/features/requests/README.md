# Request lifecycle

Request creation supports one unified Simple/Expert journey plus governed
catalogue and contract call-off checkouts.

## The intake engine

Four steps, one engine, two densities:

    Describe → How you'll buy → Details → Review & submit  (→ confirmation)

`new-request/intake-steps.ts` is the single source of truth for step order, which
steps apply to which route, each step's gate and each step's guidance copy. It
replaced five places that had to be kept in sync by hand — two step arrays, a
`canProceed` switch, a hardcoded submit trigger and step cap, and a separate
guidance map keyed by step number.

The organising rule is that **every question is asked before any conclusion is
shown**. Details holds everything the requester supplies — the service
description conversation, the residual risk questions, the IT security form, the
supplier choice. Review holds everything the platform concluded — buying channel
and timeline, the risk read, approvals and routing, and the checks that ran —
and nothing to fill in. Anything that would change a conclusion belongs on
Details.

`new-request/use-intake-determination.ts` mounts the determination **once**, in
the page, so the step that asks the risk questions and the step that shows their
consequences read the same object rather than each deriving its own. The
determination itself is pure and lives in `lib/procurement/intake-determination.ts`;
it takes no view or density argument, which keeps presentation out of the
decision as a structural property rather than a promise
(`test:mode-equivalence`).

## The Details step asks one thing at a time

The step renders in sequence: the requester summary (derived from the profile,
so it is complete on arrival), then the service-description conversation —
whose tail is the criteria-driven risk questions — then supplier selection.
Everything used to be on screen at once, before the requester had answered
anything.

`details-sections.ts` owns the rule, and it is deliberately trivial: **section
N+1 is revealed exactly when section N is complete, and the last section's
completion IS `canProceed('details')`**. `intake-steps.ts` calls the same
predicate, so a screen that shows a section and a gate that ignores it cannot
drift apart (`test:details-progression`).

The gate is the mandatory floor (`REQUIRED_SLOT_IDS`) **and** every triggered
risk question answered — not an empty agenda. The agenda also carries optional
slots, and the conversation drops one the requester could not answer, so gating
on it made a declined optional question block the step while the chat said
"that's everything I need".

Risk questions are `DemandSlot`s with `answerType: 'yes-no'`, appended at
runtime by `residual-question-slots.ts` from the determination's
`residualQuestions`. They are never in `ALL_SLOTS` or a stored template —
`resolveSlots` REPLACES the built-in set when a template row exists, so they
would silently stop being asked. `false` is a real answer, so `isSlotFilled`
tests presence rather than truthiness, and an unanswered question is recorded
as `not-answered` rather than as "no".

The gate also requires what **submit** will require: a title, a need-by date
that parses, and a cost centre (`lib/procurement/submission-requirements.ts`).
The server refuses a submit with the same list, so Details asks for them rather
than the final click being the first anyone hears of it. The footer names each
and where it is entered — Key facts for the title and date, Charged to for
the cost centre. Every full request is a conversation; the plain form for the
renewal and onboarding categories was retired with them (2026-09-25). The budget is not on the
list: a requester may not know it yet, and the server accepts zero. A need-by
date the conversation skipped after two unreadable answers is editable in Key
facts; it used to be read-only there, so such a request could never be
submitted (`test:submission-requirements`).

A supplier outside the category's preferred list owes a reason, asked beside the
supplier on this step and on the same list: the server recomputes the override
and refuses without it, and — when Decisioning thresholds say so — the category
manager is added to the approvals.

## One UI, progressive disclosure

There is **one** page and one view of it. A `density` prop (`'simple' | 'expert'`)
used to decide the header framing and whether the Review step showed the
workings at all — the routing rule that decided the channel, the inherent-risk
drivers, the per-dimension operational risk, the Smart Assessment projection,
the determination export, and the buy-route "Why this?" disclosure.

That prop is gone (ADR-0008). All of it is now shown to everyone, **collapsed by
default**. Simple did not present the evidence differently; it withheld it, and
a requester who cannot see why their demand was routed a particular way cannot
challenge it. Progressive disclosure was always the right mechanism — the mode
toggle was not needed to get it, and it cost the requester a decision about how
to see the product before they could use it.

What has not changed: presentation never picks a step, a gate, a decision, or
what is written, and anything that **blocks** the request is never hidden behind
a disclosure.

Two intake pages existed until this change. They shared step components and
decision helpers and still drifted twice into different governance outcomes for
the same demand — once resolving contracts by supplier *name*, once recording
checks that had never run. `test:mode-equivalence` now asserts there is no
second page to drift.

## Deep links

One URL opens the intake with context attached:

| Link | From | Trap |
|---|---|---|
| `?q=<text>` | the Home box, the assistant (both providers), Start renewal | Must seed the describe step and never ask for the text again |

`?catalogueItem=…` was the return trip from an item's page into a one-item
checkout inside this wizard. Catalogue orders moved to the Catalogue page's
basket (2026-09-25, ADR-0009), and with them the wizard's catalogue route, its
catalogue step and that link.

A third, `?step=2&category=…`, carried a second classification of the demand
past the describe step — and `category` could be `catalogue`, a route, not a
category. Its last producer went when the Home box and the assistant took one
question route (2026-09-25), and it is no longer parsed: a demand arrives as its
words and is classified once, here.

`use-intake-deep-link.ts` reads `?q=` on the first render; `intake-deep-link.ts`
builds the links other screens send here (Start renewal). The page reads no URL
parameters itself.

## Detail added at the buy-route step

Enrichment goes into `demandDetail`, **never** appended to `title`. Appending
renamed the request to a run-on ("buy business consulting — IT strategy
consulting to define a new org structure — …"), which is then what it is called
everywhere afterwards. The matching text is `title + demandDetail + the draft
being typed`, so a detail is counted exactly once: the draft is cleared the
moment it is lifted.

Contract candidates are listed only when they can be acted on — the matcher
confirmed coverage, or the requester has supplied detail. Until then the option
states that coverage may exist and asks the matcher's **own** clarifying
question (ADR-0004).

## Review: conclusions, in the requester's language

The Review step is grouped, and each group says what it *means*:

| Group | What it answers |
|---|---|
| How you'll buy | The route, in outcome language, with its indicative timeline and the **whole downstream process** stated before the submit button |
| Risk | Whether the risk read adds anything to this request — "a risk assessment is required", "an existing assessment covers it" — rather than a tier and its drivers |
| Routing & approvals | Who must agree, and what happens once they do |
| Checks we ran | What was actually checked. A check that did not run says so rather than showing as clear |

The conversation step uses the product's `Card` primitives and the documented
AI visual language (blue-tinted surface, left accent, sparkle, generated-by
label — `docs/specs/design-document.md` §7.3), rather than the bespoke bordered
panes and header badge it had.

The plain wording for a channel ("Procurement runs a sourcing exercise") is set
on the workflow template that claims the channel — Workflow Designer → requester
wording — and read with `useChannelCopy()` / `channelCopy()`. It is deliberately a
**second register** alongside `buyingChannelLabel`: reviewers, exports and the
stored compliance record keep the precise label; only requester-facing screens
use the plain one. A template with no wording set shows the label. Contract call-offs use the same
server-authoritative request → PR → conditional internal PO seam as catalogue
orders. Full demand intake creates a structured service description and enters
the first actionable workflow stage.

Requester fields are collected before submission; stage-owned forms and actions
are shown only to the role that must act next.

Full-demand submission is dispatcher-routed through `/api/intake-submit` and
commits the request, service description, intake compliance, stage history and
workflow instance atomically. Date answers are parsed to ISO dates before the
server accepts them; prose in a date slot is rejected and re-asked. The legacy
`businessJustification` compatibility field is left empty for new structured
intake records so the confirmed description is not duplicated.

Request detail links are stable record links: supplier, contract, sourcing event,
purchase order and related request references retain their IDs. Requesters can
inspect supplier and contract records in read-only mode; controls that change
governance or purchasing data remain role-owned.
