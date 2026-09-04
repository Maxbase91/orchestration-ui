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

Three URLs open the intake with context attached, and each has cost a defect:

| Link | From | Trap |
|---|---|---|
| `?q=<text>` | the home box | Must seed the describe step and never ask for the text again |
| `?step=2&category=…` | the command bar (legacy) | `category` can be `catalogue`, which is a **route, not a category** — accepting it verbatim puts the whole wizard on the fast track before the funnel runs |
| `?catalogueItem=…` | the item detail page | The confirmed fulfilment context must survive; `deliveryLocation` must **not** be defaulted, because it becomes `shipToLocationId` and the governed checkout rejects a value the profile does not approve |

Parsing is pure and lives in `new-request/intake-deep-link.ts`, so those rules
are asserted by calling them. `use-intake-deep-link.ts` is only the seam: when
to apply, which query to wait for, and clearing the params so a refresh does not
replay the link. The page reads no URL parameters itself.

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

The plain wording for a channel is `buyingChannelPlain` in
`lib/routing/evaluate-routing-rules.ts`, deliberately a **second register**
alongside `buyingChannelLabel`: reviewers, exports and the stored compliance
record keep the precise label; only requester-facing screens use the plain one. Contract call-offs use the same
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
