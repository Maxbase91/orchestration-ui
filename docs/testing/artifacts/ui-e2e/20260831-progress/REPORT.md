# UI validation progress — 2026-08-31

This is an incremental, UI-only validation record against `https://orchestration-ui.vercel.app`.
All write journeys used the visible role switcher and the `UI-E2E-20260831-` prefix. No direct
application API or database mutation was used by the browser journeys.

## Completed in this part

### Sourcing

- Created and published a prefixed sourcing event.
- Selected Accenture through the buyer UI.
- Opened the supplier portal invitation as the supplier persona.
- Submitted price, lead time, and proposal text.
- Opened the buyer evaluation centre.
- Confirmed the award dialog and completed the award.
- No browser page errors were observed.

Evidence: `../UI-E2E-20260831-SOURCING-1788170593315/manifest.json`.

Important limitation: this event was a standing event and had no originating request, so the
award could not continue into contracting or PO creation. The request-linked event inspected at
`REQ-2024-0006` was a draft with no visible Publish action, which blocks the linked lifecycle.

### Vendor onboarding

- The vendor-manager pipeline rendered and showed supplier stages.
- A prior contract call-off passed through Risk → Onboarding → Approval using visible role
  switches.
- The supplier portal onboarding screen rendered.

Limitation: the supplier onboarding portal is a static six-step status display with no editable
forms or supplier submission actions. The risk-decision action in the request workflow advanced
without a visible decision form.

### Full new-demand intake

- Simple requester entry rendered without a Goods/Services choice.
- Commodity/service-family classification rendered a specific candidate and probability.
- The original demand text carried into route evaluation.
- The full-request escape did not redirect to catalogue.
- Adaptive intake captured objective, scope, exclusions, deliverables, timing, acceptance,
  resources, pricing, and dependencies through the visible conversation.
- Review rendered the structured description and route guidance.

Evidence: `../UI-E2E-20260831-FULL-INTAKE-1788170725936/manifest.json`.

Failure: submission stayed on Review with a generic error, while `REQ-2025-8026` was created in
Intake. The captured answer intended as a date was placed into the date field as prose, and the
request detail showed no usable Needed-by date. This is a partial-write and date-extraction defect.

Document upload was not completed because the deployed `/api/intake-upload` path is unavailable
under the current Vercel function boundary.

### Assistant wording/runtime check

The requester-facing answer to “What is my most recent purchase order?” was user-friendly and did
not expose `filter_objects`, `functions.*`, or “No purchase orders were found”. However, the browser
recorded three `500 https://orchestration-ui.vercel.app/api/db` responses while updating
`assistant_conversations`.

## Integration checks

Passed: `test:sourcing`, `test:onboarding-stage`, `test:unified-intake`,
`test:service-description-config`, `test:intake-guidance`, and `test:neon-live`.

Unavailable: `test:intake` still constructs a Supabase client from missing/invalid local Supabase
variables and fails before exercising its assertions. It must be migrated to the Neon boundary or
explicitly marked unavailable.

### Form and role-action audit

The deployed screens were revisited through the visible role switcher at desktop width and at
320px for the invoice queue. No uncaught browser errors were observed in this pass.

- Admin policy list renders, but this route does not expose an editable policy form or a visible
  Save action. Policy persistence is covered by integration tests, not by this UI route.
- Vendor-manager onboarding renders the supplier pipeline; the single input is a search/filter
  control and there is no supplier-stage submission form on that screen.
- Supplier onboarding is a static six-step status display with zero inputs and no actionable
  supplier-owned submission controls.
- Operations invoice queue exposes Review, Match, and Variance actions. The same action surface
  rendered at 320px without an observed overflow error, but a full variance/refer-back/payment
  journey was not completed in this pass.

This confirms that the invoice queue has visible operational actions, while onboarding and policy
administration remain incomplete from a user-form perspective.

### Responsive and keyboard probe

Requester Home, New Request, and catalogue item detail were opened at 320px and 375px. All six
checks rendered, reported no horizontal overflow, and exposed keyboard-focusable controls. The
experience switcher opened with accessible Simple/Expert menu items and no console or page errors.
This is a positive UI result, but it does not replace the missing lifecycle and form coverage above.

### Automated smoke regression observed

The current `npm run test:ui` smoke suite passed its unified-intake, item-detail, routing, and
accessibility assertions, but failed at `shared checkout enables submit after required details`.
The smoke fixture could reach the shared checkout and find its Review order control, yet the
control remained disabled after recipient, purpose, and cost-centre values were entered. This
needs a focused reproduction (including profile/default hydration) before calling the checkout
form fully regression-safe.

## Stabilisation implementation update — 31 August 2026

The first remediation tranche is implemented locally:

- Full-demand submission now uses atomic `/api/intake-submit`; stage, workflow,
  compliance and structured-description writes share one Neon transaction.
- Server validation rejects prose dates and missing route/accounting/beneficiary
  values with safe structured errors. The request row now retains the intake
  determination fields used by downstream risk and approval routing.
- Request-linked sourcing drafts expose Edit/Publish controls with invitee,
  requirement and 100%-criteria gates.
- Empty catalogue draft dates hydrate to a concrete date, restoring the Review
  order readiness state. Receipt and invoice identity updates are persisted.
- Neon dispatcher JSONB updates use explicit casts, addressing the prior
  assistant-conversation update failure; latest-PO wording remains requester
  scoped and tool/source markers are filtered.

Local verification passed: build, lint, dispatcher/import guards, atomic-intake
source checks, sourcing, onboarding, unified-intake, guidance, catalogue-order,
governed-checkout, policy, workflow, Vercel-function-budget, and the complete
Playwright wizard smoke (including checkout submission). The smoke suite's
previous disabled-button failure is fixed.

Still outstanding after deployment: Neon live transaction checks were blocked
in this environment by DNS resolution for the configured Neon host, and the
full deployed role-based lifecycle (linked sourcing through payment, onboarding
forms, invoice variance and PDF/DOCX upload) needs a fresh run against the new
revision. Existing artifacts remain unchanged.

The latest local role/screenshot sweep is retained at
`../ui-e2e-20260831115655/INDEX.md`. Its route checkpoints rendered, but its
local server has no Vercel functions, so API-backed requests returned expected
404s; use the deployed alias for a meaningful runtime-error verdict.

## Deployed rerun — 31 August 2026

After the stabilization commits were pushed and deployed (Vercel deployment
`dpl_HSrpDzqgvwyD9s7k4xWtQDeNxj9B`), the role-based browser sweep was rerun
against `https://orchestration-ui.vercel.app`.

- 63 checkpoints across requester, procurement, vendor, operations, admin, and supplier routes;
- Simple and Expert catalogue checkout readiness checks;
- responsive checks at 320px and 375px;
- 0 white screens, 0 uncaught page errors, 0 console/runtime failures;
- 0 local-serverless-unavailable findings (deployed APIs were reachable).

Evidence: `../ui-e2e-20260831141047/INDEX.md` and `../ui-e2e-20260831141047/manifest.json`.

This is a route and readiness sweep; it does not claim that every write-heavy
handoff (sourcing award, onboarding decision, invoice variance, and simulated
payment) was completed in this rerun. Those remain explicit follow-up scenarios
for the full UAT run.

## Write-enabled catalogue lifecycle — 31 August 2026

A prefixed catalogue request was submitted through the visible requester UI and
completed through the role handoffs:

`requester submit → procurement approval → procurement PO creation → operations full receipt → supplier invoice submission → operations review/match → procurement invoice approval → admin schedule → admin release`.

The request and invoice both persisted after reload. The final invoice state was
`Paid` and the PO receipt was confirmed. Screenshots are retained under
`../UI-E2E-20260831-CATALOGUE-WRITE/`.

This run also found and repaired the catalogue approval-stage mapping and added
role-gated simulated payment actions to the Admin tracker. The UI still exposes
approval controls to the requester persona on request detail, which remains a
permission-surface follow-up because role switching is simulation-only.

## Proposed remediation plan

### P0 — release blockers

1. Introduce a server-authoritative, transactional full-intake submit endpoint (or extend the
   existing domain dispatcher) so request, service description, compliance record, stage history,
   and workflow instance commit or roll back together. Return structured errors to the UI.
2. Make date slots type-safe: parse explicit dates from answers, reject prose for date fields,
   and re-ask with an inline validation message. Persist the parsed ISO date and verify it on the
   request detail screen.
3. Restore document extraction through the existing dispatcher/function-budget boundary and add
   PDF/DOCX success and failure coverage.

### P1 — lifecycle blockers

4. Add Publish/Edit actions to request-linked draft sourcing events, or route the user into the
   existing publish wizard while preserving `requestId`, seeded requirements, and criteria.
5. Implement persisted vendor-onboarding forms and explicit risk-decision fields; stage actions
   must show the required form before advancing.
6. Add a linked sourcing E2E fixture that starts from a sourcing-stage request and completes
   invitation → response → evaluation → award → contracting → PO.

### P1 — data/runtime correctness

7. Synchronize the receipt queue status after partial/full receipt.
8. Resolve supplier identity from the PO/invoice context instead of the fixed supplier portal
   persona when submitting an invoice.
9. Fix the `assistant_conversations` update 500s and fail visibly if conversation persistence is
   unavailable, while keeping the answer usable.

### P2 — quality and coverage

10. Remove duplicated narrative/date presentation on request detail and add regression coverage.
11. Migrate or replace the legacy Supabase-bound `test:intake` suite.
12. Run the remaining Expert-mode full intake, admin policy save, invoice variance, reassignment,
    escalation, refer-back, mobile 320/375px, and keyboard checks after the P0/P1 fixes.

## Role-aware navigation repair — 31 August 2026

The deployed check reproduced the reported requester failure: supplier links were
present, but `/suppliers/:id` was protected by a directory-only role guard and
redirected to `/`. The same guard mismatch affected contract links and the
Expiring Contracts widget. Detail routes are now requester-readable in a
read-only presentation, while coverage, renewal, obligation, and purchasing
mutations remain role-gated.

Static and browser checks are registered as `test:link-route-integrity` and
`test:link-navigation`. The deployed browser run should be executed after the
next Vercel deployment; its screenshots and manifest belong beside this report.
The pre-deployment baseline is recorded at
`../link-navigation-20260831151803930/manifest.json`: it reproduced the
supplier redirect to Home and confirmed the old requester contract guard. The
expiring-contract row was absent from the persisted requester layout, so that
case remains a post-deployment verification rather than a product pass.
