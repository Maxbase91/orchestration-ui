# Request lifecycle

Request creation is one journey for every requester — the conversation page,
then the Channel page — plus governed catalogue and contract call-off
checkouts.

## New request: the conversation, then the Channel page

    the conversation (What you need · How it is bought · What it needs)
      → "Buying channel confirmed" → the Channel page → submit → confirmation

`new-request/new-request-page.tsx` switches between three views and holds the
one form state and the one determination. The conversation stays mounted behind
the Channel page, so "Back to the conversation" returns to it as it was left —
its transcript is state no form field could rebuild.

It replaced a four-step wizard (Describe → How you'll buy → Details → Your
buying channel) on 2026-09-26, with its stepper, its footer and a guidance panel
per step. It asks in the same order and keeps the same organising rule — every
question is asked before any conclusion is shown — and the Details step's gate
is now "Buying channel confirmed".

### The conversation page (`new-request/conversation/`)

One transcript and one reply box on the left; **Your request** on the right.

| Phase | What happens | Engine |
|---|---|---|
| 1 · What you need | The words — or Home's `?q=`, or an attached PDF/DOCX — are read back: "That sounds like *category · code*. Is that right?", with the other candidates, "None of these codes", or "describe it again" | `classify-demand.ts` (AI-001 when active, else the configured keywords) |
| 2 · How it is bought | "Checked the catalogue — …; checked contracts — …", then the way to buy: a catalogue item (ordered on the Catalogue page), a contract to call off, or a new request — on its own when nothing covers it. Coverage one detail would settle asks for that detail, in the matcher's own words (ADR-0004) | `use-route-checks.ts` (`decideIntakeRoute`, the server contract matcher, `resolveDemandChannel`) |
| 3 · What it needs — a call-off | Fills what it can from the words and the profile, then asks the rest one at a time; a choice between configured rows is answered with buttons, never parsed from prose | `call-off-agenda.ts` |
| 3 · What it needs — a new request | The service description (push back once and offer a draft; give up on a date or a budget after two tries); then the supplier; then the risk questions the supplier decides; then whatever submit would still refuse | `use-service-description-conversation.ts`, `supplier-suggestions.ts` (AI-005) |

The transcript is **history**: an answered turn — an offer card included — is
written to a log and never re-rendered from live state, so a later check or an
edit on the right cannot rewrite what the assistant already said. The buttons of
an answered turn stay on screen, disabled. The offers are headed in their
channel's own words (the claiming template's, set in the Workflow Designer).

**"Buying channel confirmed"** (`conversation-rules.ts`) is the one way on to the
Channel page. A new request is confirmed when the conversation is through — the
mandatory floor **and** every triggered risk question, not an empty agenda, so a
question the conversation gave up on cannot hold it open — the supplier question
is answered, a determination exists, and nothing submit would refuse is missing
(`intake-submission-gaps.ts` → `lib/procurement/submission-requirements.ts`: a
title, a need-by date that parses, a cost centre, and a reason for a supplier off
the category's preferred list). The server refuses a submit with the same list,
so the conversation names each gap and says where it is added — on the right. A
call-off is confirmed when nothing is left to ask. The budget is not on the list:
a requester may not know it yet, and the server accepts zero.

**The supplier** is asked after the description and before the risk questions,
because the supplier decides them — a high-risk supplier adds the
critical-service question. The category's preferred suppliers are named and, on
a sourcing channel, invited; a supplier named in the words is offered to
confirm; one outside the preferred list owes a reason, asked in the reply box,
and — when Decisioning thresholds say so — adds the category manager to the
approvals. With AI-005 active, its ranking (category fit × performance × risk)
is offered as buttons beside the directory search. "Go to market" is an explicit
answer, not an empty field.

**Your request** (`request-rows.ts`, `your-request-panel.tsx`) shows every value
with where it came from — from you · derived · drafted, check it · still to come
— and edits **inputs** in place (decided 2026-09-26): the title, the value, dates,
who and where, the supplier, the sections. What the platform decides — the
channel, the category's code, a contract's supplier, a catalogue price — has no
editor; it changes through the conversation. An edit is written where the
conversation reads it, so the next question uses it, and a call-off edit goes
through the same rules as a typed answer (the direct call-off limit, an end
before the start). **N of M known** counts what the route needs, and the channel
row is one of them, so it reaches M of M exactly when the channel is confirmed
(decided 2026-09-26). A catalogue match is complete as it stands.

Risk questions are `DemandSlot`s with `answerType: 'yes-no'`, appended at
runtime by `residual-question-slots.ts` from the determination's
`residualQuestions`, and answered only with Yes/No — the reply box is disabled
while one is pending, so a model cannot answer one from prose. They are never in
`ALL_SLOTS` or a stored template — `resolveSlots` REPLACES the built-in set when
a template row exists, so they would silently stop being asked. `false` is a real
answer, so `isSlotFilled` tests presence rather than truthiness, and an
unanswered question is recorded as `not-answered` rather than as "no".

Detail added in phase 1 goes into `demandDetail`, **never** into `title`:
appending renamed the request to a run-on ("buy business consulting — IT strategy
consulting to define a new org structure — …"), which is then what it is called
everywhere afterwards. A pasted brief or a document is titled by its first
sentence (`shortTitle`).

`new-request/use-intake-determination.ts` mounts the determination **once**, in
the page, so the conversation that asks the risk questions, the Channel page that
shows their consequences and submit that records them read the same object. The
determination itself is pure (`lib/procurement/intake-determination.ts`); it
takes no view or density argument, which keeps presentation out of the decision
as a structural property rather than a promise (`test:mode-equivalence`).

## One UI, progressive disclosure

There is **one** page and one view of it. A `density` prop (`'simple' | 'expert'`)
used to decide the header framing and whether the Review step showed the
workings at all — the routing rule that decided the channel, the inherent-risk
drivers, the per-dimension operational risk and the determination export.

That prop is gone (ADR-0008). All of it is now shown to everyone, **collapsed by
default** — under "How this was worked out" on the Channel page. Simple did not present the evidence differently; it withheld it, and
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
| `?q=<text>` | the Home box, the assistant (both providers), Start renewal | Arrives as the conversation's first message, already classified — never asked for again, and not re-sent by "Start over" |

`?catalogueItem=…` was the return trip from an item's page into a one-item
checkout inside this wizard. Catalogue orders moved to the Catalogue page's
basket (2026-09-25, ADR-0009), and with them the wizard's catalogue route, its
catalogue step and that link.

A third, `?step=2&category=…`, carried a second classification of the demand
past the describe step (now the conversation's first phase) — and `category` could be `catalogue`, a route, not a
category. Its last producer went when the Home box and the assistant took one
question route (2026-09-25), and it is no longer parsed: a demand arrives as its
words and is classified once, here.

`use-intake-deep-link.ts` reads `?q=` on the first render; `intake-deep-link.ts`
builds the links other screens send here (Start renewal). The page reads no URL
parameters itself.

## The Channel page: how it will be bought, then submit

`new-request/channel/` — the Intake Prototype's "channel, then submit" board,
which replaced Review & submit on 2026-09-26 for **every** Door 1 route,
including the contract call-off (whose form used to submit directly under a
button that read "Review request"). It is headed "Your buying channel", with
"Back to the conversation" beside it and in its footer.

| Part | Where it comes from |
|---|---|
| Headline and sentence | The channel template's requester wording (Workflow Designer) |
| Value · Stages that apply · Stage targets | The request; the plan; the stages' `slaDays` |
| Step by step | `lib/workflow/channel-plan.ts`: every stage of the template in graph order, each **You are here / Applies · why / If … / Skipped · why**, from the server's landing rule (`firstActionableStage`, or `checkoutEntryStage` for a call-off) and the engine's own branch function. "You: …" is the stage's `requesterAction` |
| Submit note | The stage the request enters, and who owns it |
| What you are submitting | The request, who and where, the supplier and who sourcing will invite (`sourcingInvites`, the event's own function) |
| Checks | `lib/procurement/channel-checks.ts`, from the determination (or the call-off's governed decision): why this channel in the matched rule's own words, disposition, contract coverage, risk, the approvers submit writes (`useApproversOnSubmit`), failed policy checks, missing sections |
| How this was worked out | The determination's workings, collapsed, and **Export** |

A call-off's decision is built by `call-off.ts`, the same builder submit
calls. Removed with Review: "Add reviewers / watchers" and "Notes for approvers"
(collected and never saved), the preview's own approval-chain pick (it ignored
the cost centre and the pinned chain), an intake copy of the IT Security
Assessment that discarded its answers (it is filled at the risk stage it is
configured for), and a "smart assessment" that re-derived contract coverage
with its own €25,000 literal.

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
