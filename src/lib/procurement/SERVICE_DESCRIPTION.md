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

## Tests

    npm run test:service-description-config   # equivalence, narrative composition, seeding
    npm run test:service-description-ui       # /admin/service-description renders (Playwright)
    npm run test:sow-narrative                # narrative is synthesised, never boilerplate
    npm run test:demand-conversation          # the conversation the slots drive
