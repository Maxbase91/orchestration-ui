# UI redesign plan

Workstream B, step 3. **For approval — nothing here is implemented.** The audit
(`docs/ui-audit.md`) is the input; this is what to do about it and in what
order.

Source of truth for the visual direction is the approved **Front Door
Redesign** artifact (`claude.ai/artifact/Dp9e9zMnQyFzCrktass1me`), read at
version `1789060439-eb03`. Its token values are quoted exactly below, with two
corrections that are the substance of the foundation decisions.

**Decision already taken:** the POC palette becomes the theme. The constraint
*"no new colour values outside the existing theme variables"* binds components
— they name tokens, never palette utilities — not the theme itself.

---

## Two things that need your decision before Phase 0

### D1 · The POC's muted text fails AA on its own background

`--ink-3: #6C768F` is the muted-text token — it carries every label, every
reason line, every caption in the POC. Measured:

| Ground | Ratio | AA body (4.5:1) |
|---|---|---|
| `--card` `#FFFFFF` | 4.54 | pass, barely |
| `--paper` `#F4F6FB` | **4.20** | **fail** |
| `--sunk` `#EEF1F7` | **4.01** | **fail** |

The POC uses it on all three. Adopting it verbatim would ship a milder version
of the exact defect the audit raised as finding 1 — and freeze it into a token,
where it is harder to notice than a component class.

**Recommendation: `--ink-3: #646E87`.** Eight points darker, the minimum that
clears 4.5:1 on all three grounds (4.71 on paper, 4.50 on sunk), and visually
indistinguishable from the original. `--idle` shares the value and moves with
it.

> **Corrected during Phase 0.** This section said the light value was "the only
> change", because I had checked the tokens against `--card` and `--paper` by
> hand. The guard checks all 54 pairs, and the **dark** `--ink-3: #77819B` fails
> the same way on `--card-2` (4.38) and `--idle-soft` (4.43). It is `#7B859F`,
> the minimum that clears every ground. I found one by hand and missed the
> other; computing it is the reason `test:design-tokens` exists.

```
       #6C768F  (POC)        #646E87  (proposed)
paper    4.20  fail            4.71  pass
sunk     4.01  fail            4.50  pass
card     4.54  pass            5.09  pass
```

### D2 · The POC loads Arimo; the plan said Inter

The artifact's font link is `Arimo` + `IBM Plex Mono`. The approved plan's
foundation table says *"Inter + IBM Plex Mono — Inter is built for UI at 11–13px
with real tabular figures"*. These are different decisions and only one can
ship.

- **Arimo** is metric-compatible with Arial. It is a competent grotesque, and it
  is what the POC was designed and reviewed in.
- **Inter** is designed for UI at small sizes, with a taller x-height and true
  tabular figures. This product is 784 uses of `text-xs` and 65 files of
  numbers.

**Recommendation: Inter**, because audit finding 5 (numbers do not align)
depends on real tabular figures and this is a dense operational tool, not a
document. The risk is that the POC's spacing was tuned against Arimo's metrics;
Inter's larger x-height reads slightly bigger at the same px. Phase 0 ships one
screen in both and we compare before the other 277 components move.

If you would rather keep the POC exactly as reviewed, say so and it is Arimo —
the rest of this plan is unchanged either way.

---

## Foundation — Phase 0

Everything after this inherits it, so it lands first and alone.

### Tokens

The POC's set, verbatim, into `src/styles/globals.css`, with D1 applied:

```css
:root{
  --paper:#F4F6FB; --card:#FFFFFF; --card-2:#F9FAFD; --sunk:#EEF1F7;
  --ink:#0C1220; --ink-2:#3F4964; --ink-3:#646E87;   /* D1: was #6C768F */
  --line:#DFE4EF; --line-2:#EDF0F6;
  --accent:#4A41C7; --accent-2:#6E63E8; --accent-ink:#FFFFFF;
  --accent-soft:#EEEDFC; --accent-line:#CFCBF4;
  --ok:#0F7048;   --ok-soft:#E4F3EB;   --ok-line:#B4DAC6;
  --warn:#8F5410; --warn-soft:#FBEFDD; --warn-line:#E9CFA5;
  --stop:#A32C24; --stop-soft:#FBEBE9; --stop-line:#EFC3BD;
  --idle:#646E87; --idle-soft:#EFF2F8;               /* D1 */
  --shadow: …; --shadow-lift: …; --glass: …;
}
```

Plus the dark block, twice, exactly as the POC has it: once under
`@media (prefers-color-scheme:dark)` guarded by `:root:not([data-theme="light"])`,
once under `:root[data-theme="dark"]`. That is the three-state mechanism —
system default, explicit light, explicit dark — and the guard is what makes an
explicit light choice beat a dark OS.

One deliberate keep: the POC's `--band-bg` is a multi-stop gradient. The plan's
"no gradient cards" rule stands for cards; the band is the one signature object
and its gradient is load-bearing, so it is the single exception and is named as
one.

### Type scale

The POC has **13 distinct sizes** including `13.5px` and `12.5px`; the app has
**11** including `9px`, `12.5px` and `13.5px`. Both are mockup artefacts. One
scale of six, and the mapping is shown before any component changes:

| Utility | px / line-height | Replaces (app) | Role |
|---|---|---|---|
| `text-eyebrow` | 11 / 1.45 | `text-[9px]`, `text-[10px]`, `text-[11px]` | uppercase labels, table micro-headers |
| `text-caption` | 12.5 / 1.5 | `text-xs`, `text-[12px]`, `text-[12.5px]` | captions, reason lines, metadata |
| `text-body` | 13.5 / 1.55 | `text-sm`, `text-[13px]`, `text-[13.5px]` | body, table cells, form values |
| `text-prose` | 15 / 1.6 | `text-base` | narrative prose, chat |
| `text-heading` | 19 / 1.3 | `text-lg`, `text-xl` | card and section headings |
| `text-display` | 28 / 1.15 | `text-2xl` | the band's route statement and money figure |

> **Named by role, not by size — changed during Phase 0.** This table first
> called them `--text-2xs/xs/sm/base/lg`. In Tailwind 4 those names *are*
> Tailwind's own, so defining `--text-sm: 13.5px` would have silently resized
> all **772** existing `text-sm` uses across every screen the moment the token
> layer landed — the opposite of a phased migration, and it would have made
> Phase 1's "migrate this screen" meaningless for type. Role names sit in their
> own namespace, so the two scales coexist until a screen moves.
>
> Spacing is affected the same way and is therefore **not** redefined: Tailwind's
> scale is already the 4px base specified below, and overriding a step such as
> `--spacing-6` would shift every `p-6` in the tree. "One spacing scale" is
> enforced as a guard rule instead.

`text-[9px]` has no target — it is below the legible floor and its 7 uses become
`text-eyebrow`. Anything that then looks wrong is a layout problem to fix, not a
size to re-add.

### Font

Load Inter (or Arimo, per D2) + IBM Plex Mono from Google Fonts — the one font
host the CSP admits — with the current stack as a real fallback. `--font-mono`
carries ids, timestamps and any figure in a column.

### Spacing, state, tables, async

| Foundation | Rule | Audit finding |
|---|---|---|
| Spacing | 4px base; 4 / 8 / 12 / 16 / 20 / 26 / 34. No arbitrary margins. | — |
| State | Status readable without colour: dot **plus** text, never hue alone. The POC's `.pill` and `.dot` already do this. | — |
| Tables | Fixed column widths on `DataTable`, `font-variant-numeric: tabular-nums` on every numeric column. | 5, 8 |
| Async | One `<AsyncBoundary>` taking a query result and rendering loading / empty / **error**. | 2 |

`<AsyncBoundary>` is the one piece of new shared component work in Phase 0, and
it is what makes finding 2 a 24-file mechanical change instead of 24 decisions.

### Phase 0 acceptance

- `npx tsc -b`, `npm run lint`, `npm run build` clean.
- Every existing suite green — Phase 0 changes no component, so nothing should
  move. If a browser suite fails here, the token layer has changed rendering and
  that is a bug in Phase 0, not in the suite.
- New `test:design-tokens`. The migrated list starts with `<AsyncBoundary>`, the
  one new component, so the rule is live from the first file rather than
  arriving after the work.
- Contrast assertion in that guard: every `--ink*`, `--accent`, `--ok`,
  `--warn`, `--stop` token computed against `--card`, `--paper` and `--sunk`,
  light and dark, must be ≥ 4.5:1. This is the check that would have caught D1,
  and it runs on every commit thereafter.

---

## Phases

Ordered by **daily use first**, then by blast radius. The per-area class counts
are the migration cost, measured:

| Phase | Area | Raw classes | Files | Why here |
|---|---|---|---|---|
| **1** | Request detail + list | 456 | 35 | The screen the POC actually designs, and the most-used in the product |
| **1** | Dashboard | 80 | 37 | First screen every role sees; holds 5 of the 24 missing error states |
| **1** | Approvals | 24 | 6 | Small, high-frequency, and the POC's approval rows are a direct port |
| **1** | Shared components | 45 | — | `DataTable`, `PageHeader`, `StatusBadge`, `SLACountdown` — every later phase inherits them |
| **2** | Suppliers | 81 | 23 | |
| **2** | Analytics | 81 | 8 | Charts need token-aware series colours, which is its own small design pass |
| **2** | Sourcing / contracts / purchasing | 38 | 21 | Low class counts; mostly tables that Phase 1's `DataTable` already fixed |
| **2** | Workflows / pipeline / tasks | 49 | 16 | |
| **3** | Admin | 371 | 53 | 18 surfaces, just rebuilt in A2/A3 — highest count, lowest frequency of use |
| **3** | AI assistant | 51 | 7 | Overlay; visually self-contained |

**Phase 1 is 605 of the 1,390 classes and the screens people are in all day.**
Phase 3 is 371 classes nobody sees more than weekly, which is why it is last
despite being the second-largest.

### Per screen, in every phase

1. Re-run the `web-design-guidelines` audit on the touched files only.
2. Migrate to tokens; delete the raw utilities.
3. Add the screen's files to `test:design-tokens`' migrated list — so the guard
   tightens as the work proceeds rather than all at the end.
4. Browser check at 1360px and 375px, light and dark, confirming no horizontal
   overflow and no layout shift between loading and loaded.
5. `npm run test:all` + the stub-backed browser suite for that area.
6. Commit per screen, so any single screen can be reverted alone.

---

## What this plan will not do

- **No data-fetching or business-logic changes.** The configuration work is
  finished and on main; a redesign that also moves logic makes both
  unreviewable. The one exception is `<AsyncBoundary>`, which changes what is
  *rendered* on failure and nothing about the fetch.
- **No new dependencies** beyond the two webfonts.
- **No component library swap.** shadcn/ui and Tailwind 4 stay; tokens are
  applied through them.
- **The 42 dead `dark:` classes** are deleted in the phase that touches their
  file, not in a sweep — they do nothing today, so they are not urgent, and a
  cross-cutting delete makes every later diff noisier.

## Open, and deliberately not decided here

The POC covers **three screens** — home, intake, review, request detail. Phases
2 and 3 cover forty more with no reference design. The plan is to derive them
from the foundation and the patterns Phase 1 establishes (band, evidence rows,
fact grids, pill + dot status), not to invent per-screen direction. If a Phase 2
screen needs a genuinely new pattern, that is worth raising rather than
improvising — I will flag it rather than design it silently.

## Verification for Workstream B

- Per screen: `npx tsc -b`, `npm run lint`, `npm run build`.
- `npm run test:all` before each commit; `test:ui`, `test:e2e-ui` and the nine
  stub-backed browser suites before each push.
- `test:design-tokens` grows a file list as screens land, so a migrated screen
  cannot regress to raw utilities.
- Contrast computed in CI, not by eye.
