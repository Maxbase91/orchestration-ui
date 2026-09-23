# UI audit

Workstream B, step 2. Findings only — **no component was changed to produce
this document.** Every count is measured from the tree at `e972997`, not
estimated, and the command that produced each is given so the number can be
re-derived rather than trusted.

The audit runs `web-design-guidelines` and the two Vercel skills against
`src/**/*.tsx` (278 components). Both Vercel skills are written for Next.js —
this project is Vite with no server components, no app router and no
`next/image` — so their framework rules are not applicable and are not reported
as findings. What transfers is the React 19 and composition material.

Severity means: **High** — a user is shown something wrong, cannot read it, or
cannot operate it. **Medium** — inconsistency a user will notice, or a change
that gets harder the longer it waits. **Low** — polish.

---

## Summary

Status is as of Phase 1's colour work. "Closed" means a guard now fails if it
comes back, not that it was fixed once.

| # | Finding | Severity | Scale | Status |
|---|---|---|---|---|
| 1 | Text at 2.54:1 contrast — fails WCAG AA | **High** | 194 uses | **Closed** — `text-gray-400` → `--ink-3` (4.71–5.09:1) |
| 2 | 24 of 31 async surfaces have no error state | **High** | 24 files | Partly — `<AsyncBoundary>` exists; the 5 dashboard widgets converted and guarded, 19 call sites left |
| 3 | No semantic token layer; components name raw palette colours | **High** | 1,390 uses | **Closed** — 2,538 classes remapped; the guard now also scans `.ts` and hex classes, which found 57 hex classes and every status badge still on raw palette (fixed) |
| 4 | `Inter` is named as the UI font and never fetched | **High** | whole app | **Closed** — Inter + IBM Plex Mono fetched |
| 5 | Numbers do not align in any table | **Medium** | 5 of 65 files | Partly — `DataTable` supports `numeric`; per-column adoption outstanding |
| 6 | No dark mode, and the 42 `dark:` classes present do nothing | **Medium** | 42 uses | **Closed** — three-state theme live; dead `dark:` classes removed |
| 7 | Type scale is 11 sizes, 7 of them arbitrary pixels | **Medium** | 221 uses | Open — six role-named sizes exist; screens adopt them per phase |
| 8 | Tables have no column widths — layout shifts on load | **Medium** | all tables | Partly — `DataTable` supports `width`; per-column adoption outstanding |
| 9 | Three clickable `<div>`s are keyboard-unreachable | **Medium** | 3 sites | Partly — `KPICard` and `DataTable` rows fixed; one site left |
| 10 | Theme's own `--color-text-muted` and amber fail AA | **Medium** | theme | **Closed** — both roles now alias AA-passing tokens |

### Found during the work, not in the original audit

| Finding | Where |
|---|---|
| A migrated text on an unmigrated surface renders at **1.16:1** — per-file migration was never safe for dark | the whole phasing; fixed by aliasing shadcn's roles to the tokens |
| `bg-white`, 136 uses: a literal surface that cannot follow the theme | swapped to `--card`, byte-identical in light |
| `text-text-primary` — reads like a token, was a fixed near-black | aliased; it was why the header user name vanished in dark |
| `text-white` on a status fill: 6.12:1 light, **2.32:1 dark** | 15 sites, now `--paper`, which flips |
| `Sparkline` derived its gradient id from the colour string, so a `var()` colour silently produced no fill | fixed with `useId` |
| An approvals card asserted AI-generated facts present in no record | removed; see the commit |
| Card in card: KPI tiles, each with border and shadow, inside a widget card with border and shadow | dashboard health panels; replaced by `FactGrid` — one surface, hairline dividers |
| "Healthy" set at display size — the largest text on Home, above the user's name | system health panel; now the size of the figures beside it |
| Empty widgets reserved 72–120px and centred one sentence in it; the grid read as half-rendered | `AsyncBoundary` empty state is now one left-aligned line; `minHeight` applies to loading only |
| `col-span-3` in a one-column grid creates implicit columns — the dashboard would scroll sideways on a phone | spans now widen with breakpoints |
| Status badges came from a `.ts` map of palette classes the colour guard never scanned — light chips in dark mode, and six ordinary stages coloured amber, the warning hue | `src/config/theme.ts` now maps status → tone → tokens |
| 57 `text-[#…]` / `bg-[#…]` hex classes in 21 files — primary buttons, chat bubbles, the command bar — fixed at their light value | replaced with tokens; the guard rejects hex classes |
| The priority dot had no text, no title and no accessible name | named in every mode |
| The app shell is not responsive — the sidebar is a fixed 260px at every width, leaving ~115px of content at 375px | **Not a defect, by decision (2026-09-23):** the platform is desktop-only. Recorded so it is not re-raised |

---

## 1. Text at 2.54:1 contrast — fails WCAG AA · **High**

`text-gray-400` (`#9ca3af`) on white measures **2.54:1**. WCAG AA requires
**4.5:1** for body text and 3:1 for large text, so this fails both. It is used
**194 times**, and `text-gray-300` (**1.47:1**, effectively invisible) 16 times.

Not all 194 are text — some tint icons, where the bar is 3:1 and it still
fails. But many are prose a user is expected to read:

- `src/features/admin/ai-analytics-page.tsx:41` — the sub-label under every
  stat card, `text-xs text-gray-400`
- `src/features/admin/ai-analytics-page.tsx:148` — "Loading analytics…"
- `src/features/suppliers/portal/portal-documents.tsx:150` — `text-[11px]
  text-gray-400`, which is 11px at 2.54:1
- `src/features/pipeline/sourcing-pipeline-page.tsx:139` — the em dash standing
  in for a missing deadline

**Rule:** WCAG 2.1 AA 1.4.3 Contrast (Minimum). **Fix:** `text-gray-500`
(`4.83:1`) is the lowest passing grey on white and `text-gray-600` (`7.56:1`)
on `bg-gray-50`. Under the token layer this becomes one `--ink-muted` chosen to
pass on both grounds, which is why finding 3 should land first.

```bash
grep -rn "text-gray-400" src --include="*.tsx" | wc -l   # 194
```

## 2. 24 of 31 async surfaces have no error state · **High**

31 files render a loading state from a TanStack Query hook. **7** also handle
`isError`. The other 24 render the loaded view over `data ?? []` — so a failed
read is indistinguishable from an empty result.

This is not hypothetical: `/admin/ai-analytics` had exactly this shape and
showed zeroes for every metric when the read failed, until it was fixed this
week. The same pattern is live in:

- `src/features/dashboard/widgets/widget-requests-by-stage.tsx`
- `src/features/dashboard/widgets/widget-expiring-contracts.tsx`
- `src/features/dashboard/widgets/widget-invoice-exceptions.tsx`
- `src/features/dashboard/widgets/widget-open-pos.tsx`
- `src/features/dashboard/widgets/widget-supplier-onboarding.tsx`
- `src/features/admin/{approval-chains,categories,cost-centres,delivery-locations,kb-admin,sla-targets}-page.tsx`
- …and 13 more

Five of those are **dashboard widgets**, where "0 expiring contracts" and
"could not read contracts" look identical and one of them is a reason to act.

**Rule:** every async surface needs loading, empty *and* error. **Fix:** a
shared `<AsyncBoundary>` that takes the query result, rather than 24 hand-rolled
branches. Worth doing before the redesign touches these files.

The five dashboard widgets are converted. Proving it needed a way to make a read
fail from a browser test — `installDbStub(page, {}, { fail: [...] })` — because
the error state is unreachable while the stub always answers, and `tsc` proves
the component compiles rather than that the alert renders. The remaining 19 are
the admin pages listed above.

```bash
comm -23 <(grep -rl isLoading src/features --include="*.tsx" | sort) \
         <(grep -rl isError  src/features --include="*.tsx" | sort) | wc -l   # 24
```

## 3. No semantic token layer · **High**

**1,390** raw palette utility uses across the tree — `text-gray-500` 239 times,
`text-gray-900` 235, `text-gray-400` 194, `border-gray-200` 120, `bg-gray-50`
108. Meanwhile the custom `@theme` in `src/styles/globals.css` defines a full
navy/blue/amber palette that components almost never reach for.

So there is a theme, and the app does not use it. Every one of those 1,390 is a
decision taken in a component about what colour something should be, which is
why finding 1 exists — a contrast failure in a token is one fix, and in a
component it is 194.

Worst files:

| File | Raw uses |
|---|---|
| `src/features/requests/new-request/step-compliance.tsx` | 92 |
| `src/features/admin/forms/form-builder-page.tsx` | 63 |
| `src/features/requests/request-detail/components/step-detail-card.tsx` | 46 |
| `src/features/requests/new-request/step-chat-intake.tsx` | 38 |
| `src/features/dashboard/components/smart-command-bar.tsx` | 35 |

**Fix:** adopt the POC's semantic set (`--paper`, `--ink`, `--line`, `--idle`,
`--accent`, `--ok`, `--warn`, `--stop`) as the theme — **confirmed: the POC
palette becomes the theme** — then migrate components onto it. This is the
foundation every other finding depends on.

## 4. `Inter` is named and never fetched · **High**

`src/styles/globals.css:4` sets `--font-sans: "Inter", ui-sans-serif,
system-ui, sans-serif`, and nothing anywhere loads Inter: no
`fonts.googleapis.com` link in `index.html`, no `@font-face`, no package. The
app has been rendering in the system UI font since it was written, on every
machine.

That matters beyond aesthetics here, because Inter is what finding 5's fix
depends on: its tabular figures are the reason it was chosen for a data-dense
product.

**Fix:** load Inter and IBM Plex Mono from Google Fonts (the one font host the
CSP admits), with the existing stack as the real fallback.

```bash
grep -rn "fonts.googleapis\|@font-face" index.html src/styles/globals.css   # no matches
```

## 5. Numbers do not align · **Medium**

**65 files** format currency or quantities; **5** use `tabular-nums`. In a
proportional font the digits have different widths, so every money column in
every table is ragged and two figures of the same magnitude do not line up.

This is the single cheapest visible improvement in the audit: one utility on
each numeric column.

**Rule:** tabular figures on any column of numbers meant to be compared.

## 6. No dark mode, and 42 `dark:` classes that do nothing · **Medium**

There are **42** `dark:` utilities in the tree — and no `darkMode` strategy, no
`data-theme` switch and no dark token values, so none of them can ever apply.
They are dead code that reads as a feature.

The POC already solves this properly: light and dark values for every token,
with the three-state mechanism (`:root`, `@media (prefers-color-scheme: dark)`
guarded by `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`).

**Fix:** dark mode after tokens, as one block of overrides — not 277 files of
work. Until then, remove the 42 dead classes or make them live; leaving them is
the "control that configures nothing" pattern in CSS.

## 7. Type scale is 11 sizes, 7 arbitrary · **Medium**

| Size | Uses |
|---|---|
| `text-xs` | 784 |
| `text-sm` | 772 |
| `text-[10px]` | 103 |
| `text-[11px]` | 100 |
| `text-base` | 47 |
| `text-xl` / `text-lg` | 20 / 20 |
| `text-2xl` | 13 |
| `text-[9px]` | 7 |
| `text-[12px]`, `text-[13px]`, `text-[13.5px]`, `text-[12.5px]` | 11 |

**221** uses are arbitrary pixel values, including half-pixel steps
(`text-[13.5px]`, `text-[12.5px]`) that no scale would contain. `text-[9px]` is
below the floor for legible UI text at any weight.

**Fix:** one documented scale of ~6 sizes; map the 221 arbitrary uses onto it,
showing the mapping before changing any component.

## 8. Tables have no column widths · **Medium**

`src/components/shared/data-table.tsx` sets no column widths, no
`table-fixed` and no `<colgroup>`. Column widths are therefore derived from
content, so every table re-lays-out when data arrives and again when a filter
changes the longest cell. Only **3 files** in the tree use a skeleton or
`animate-pulse`, so most tables shift from empty to full with nothing holding
the space.

**Rule:** fixed column widths and no layout shift between loading and loaded.

## 9. Three clickable `<div>`s · **Medium**

Three `<div onClick=…>` with no `role` and no `tabIndex`, so they cannot be
reached or activated by keyboard. Small in number and worth fixing while the
files are open.

```bash
grep -rn "<div[^>]*onClick=" src --include="*.tsx" | grep -v "role=" | wc -l   # 3
```

Also: **19 of 278** components reference `focus-visible`. Most interactive
elements inherit a focus ring from the shadcn primitives, which is why this is
not a High — but it needs verifying per screen during the redesign rather than
assuming.

## 10. The theme's own colours fail AA · **Medium**

Two of the values the redesign would otherwise inherit:

- `--color-text-muted: #718096` on `--color-background: #F3F5F9` → **3.68:1**,
  fails AA for body text.
- `--color-amber-500: #D4782F` on white → **3.22:1**. It is the warning colour,
  so it is used for text that says something is wrong.

Worth recording because it is the concrete argument for the palette decision:
the existing theme cannot be adopted wholesale without fixing these two anyway.

---

## Not findings

Recorded so they are not re-raised:

- **Heading hierarchy.** 15 feature pages declare an `<h1>`; `PageHeader`
  provides it consistently. No duplicate-`h1` problems found.
- **Image alt text.** Zero `<img>` without `alt` — the tree uses inline SVG
  icons almost exclusively.
- **Next.js rules** from the two Vercel skills — `next/image`, server
  components, app-router data fetching, route segment config. Not applicable to
  a Vite SPA and not counted against it.

## Verification

Every count above re-derives from the commands shown. `test:design-tokens`,
proposed in the plan, would freeze findings 1, 3 and 5 once fixed: no raw
palette utility in a redesigned file, and tabular figures on every numeric
column. Without it the 1,390 grow back.
