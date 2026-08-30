# Service description — configuration and reuse

The service description is the most carefully captured artefact the front door produces: a
question-by-question conversation, an LLM pass, and a quality score. This module makes **what is
asked, how it is generated, and where it is reused** configurable rather than hardcoded, and wires
the result into the steps that come after intake.

## The pieces

| File | What it is |
|---|---|
| `service-description-config.ts` | The types and the pure evaluators — `SlotCondition`, `ConfiguredSlot`, `ConfiguredSection`, `ServiceDescriptionTemplate`, `evaluateSlotCondition`, `slotApplies`, `composeNarrativeFromSections` |
| `service-description-defaults.ts` | The built-in template — the previously hardcoded slot set, sections, narrative composition, system prompt and model params, serialised faithfully |
| `service-description-seed.ts` | Downstream reuse — sourcing requirements, sourcing criteria, and the `sow.*` values a form pre-populates from |
| `demand-signals.ts` | The capture-time governance read that steers generation, and `inferDataSensitivity` |
| `src/lib/db/service-description-templates.ts` | Data access (+ `hooks/use-service-description-templates.ts`) |
| `api/_sd-template.ts` | The server-side read, with a 60s process-local memo |
| `src/features/admin/service-description-page.tsx` | `/admin/service-description` |

## Why a table, not a settings store

`PolicyConfig` lives in localStorage. `api/generate-sow.ts` and `api/chat-intake.ts` run serverless,
so they get `DEFAULT_POLICY_CONFIG` and **never see an admin's overrides** — two of the four
question-branch thresholds already fail exactly that way. Any config that must reach a generation
route therefore has to be in Postgres. Hence `service_description_templates`.

## Resolution order

    category row  →  `default` row  →  DEFAULT_TEMPLATE (code)

Never null: generation, seeding and the intake conversation must always have something to run. An
**empty array means "not configured"** and falls back per field, so a partial row overrides only what
an admin actually changed. A missing table, a malformed row and an unreachable database all yield
the built-in — an admin mistake cannot take intake down.

## Conditions are data, not closures

`appliesWhen` was a closure, which is why the slot set could not be stored. It is now
`{ field, operator, value }` — the **same vocabulary** `routing_rules` (`evaluate-routing-rules.ts`)
and `form_templates.trigger_conditions` already use, rather than a third one.

Thresholds keep referring to policy config **by name** so `/admin/thresholds` still moves them:

```ts
{ field: 'value', operator: '>=', value: 'policy:criticalServiceThreshold' }
```

`evaluateSlotCondition` resolves the `policy:` prefix against the active config at evaluation time.
The migration's safety net is the equivalence check in `tests/integration/service-description-config.mjs`:
every category × value × slot combination must agree with the built-in behaviour.

## One narrative composer

The compact narrative had **three** implementations that had silently drifted — the API joined six
or more fields with an opening sentence, the offline fallback joined four, and the docstring claimed
they were in step. There is now one `composeNarrativeFromSections`, driven by the template's
`narrativeSections` in order, used by all three paths. An unanswered section contributes nothing
rather than an empty clause.

Sections the requester is **never asked for** (`location` was one) are marked `inferred` in the
section spec, so the screen does not present model-invented content as captured.

## Generation reflects materiality and sourcing

The description is written at wizard step 3; materiality, inherent risk and
sourcing type are determined at steps 4–5. So generation used to see only
`category, title, value, supplier, timeline, capturedAnswers, commodityCode` —
none of the signals that decide what a description actually has to cover. It
wrote the same document for a €4k stationery order and a material,
high-sensitivity, competitively-sourced engagement, because it could not tell
them apart.

`computeDemandSignals` produces the *provisional* read from what IS known at
capture time, composing the existing decisioning modules rather than
reimplementing them. Two properties it holds to, because this is a governance
artefact and not a hint:

- **It invents nothing.** Every value carries the driver that produced it. A
  demand with nothing described *says* its sensitivity was defaulted rather than
  claiming a reading, and sourcing stays `unknown` rather than guessing `none`.
- **It is preliminary and says so.** `criticalService` and `privilegedAccess`
  are deliberately not fed to the cascades — both come from the stage-5
  mini-IRQ, which has not run, and guessing them would inflate materiality on
  demands that turn out not to qualify.

What a description must cover is config, not prose in a prompt.
`ConfiguredSection.requiredWhen` uses the same `{field, operator, value}`
vocabulary as routing rules and form triggers, with `materiality`, `riskTier`,
`dataSensitivity` and `sourcingType` newly addressable. An **unknown signal makes
a condition false**, so "we don't know yet" can never manufacture a requirement.

The defaults make mandatory only what a reviewer would refuse to sign without:
scope and measurable acceptance criteria for a material engagement, deliverables
for anything competitively sourced (they become the bid evaluation basis), and
resources and dependencies at high or critical data sensitivity.

`requiredSectionsFor` drives both the prompt's MUST COVER list and the
determination screen's gap report, so generation and review cannot disagree
about what "required" means. The determination **reports** gaps rather than
regenerating: a document that rewrites itself after the requester thought it was
finished is worse than one that says what is missing.

## Reuse downstream

- **Sourcing** — `seedRequirementsFromDescription` turns each nominated section into one labelled
  requirement (empty sections skipped: a requirement a supplier cannot respond to is worse than one
  fewer). `seedCriteriaFromTemplate` returns the configured criteria and **reports** when the weights
  do not total 100, rather than shipping an event the wizard will refuse to publish.
- **Risk and other forms** — `sowPrePopulateValues` keys the description by the `sow.<id>` tokens the
  Form Builder now offers under `prePopulateFrom`. A form triggered on the risk stage pre-fills from
  the description instead of re-asking. This reuses the whole existing mechanism: `trigger_stages`
  already targets a stage, `FormsSection` already renders per-stage forms, `DynamicForm` already
  pre-populates — it just had no SoW sources to offer, and nothing had ever passed it a context.
- **Both take `SectionValues`, and callers must narrow with `sectionValuesOf()`.** A stored record is
  not a map of strings: beside the nine text sections it carries a quality score (number), quality
  checks and required sections (arrays), and signals and capture flags (objects). Call sites used to
  cast the whole record — `as unknown as Record<string, string | undefined>` — which TypeScript
  accepts and the runtime does not: the walker hit `value?.trim()` on a number and threw
  *"trim is not a function"*, taking down the request detail whenever a workflow step with a
  pre-populated form was opened. `sectionValuesOf()` filters to string members at the boundary, and
  `test:intake-guidance` scans `src/` so the cast cannot come back.

## Tests

    npm run test:service-description-config   # equivalence, narrative composition, seeding
    npm run test:service-description-ui       # /admin/service-description renders (Playwright)
    npm run test:sow-narrative                # narrative is synthesised, never boilerplate
    npm run test:demand-conversation          # the conversation the slots drive
    npm run test:demand-signals               # the capture-time read + config-driven requirements

## Unified requester intake

All demand types use the same describe → clarify → review → complete journey. The broad
`goods`/`services` values remain internal policy metadata; the requester confirms a specific
commodity or service family instead. A long paste or PDF/DOCX can seed the structured description,
but extracted values are shown for confirmation before matching. `scope` and `exclusions` are
separate fields, as are `deliverables` and `acceptanceCriteria`; `businessJustification` is retained
only as a legacy compatibility column and is intentionally empty for new submissions.

`src/lib/procurement/intake-guidance-api.ts` and `src/server/api/intake-guidance.ts` (served at
`/api/intake-guidance`) provide optional,
short-lived contextual hints from anonymised completed requests or configured templates. Applying a
hint is explicit and provenance is retained; a provider or database failure falls back to the
deterministic question engine and never blocks submission. `workflow/engine.ts` records the first
actionable stage after completion, so a successful intake does not remain parked in `intake`.
