#!/usr/bin/env node
// The design foundation holds, and a migrated screen cannot regress.
//
// Three jobs:
//
//  1. CONTRAST, computed rather than eyeballed. Every text token against every
//     ground it is used on, in both themes. This is the check that caught the
//     POC's own `--ink-3: #6C768F` — 4.54:1 on --card but 4.20:1 on --paper and
//     4.01:1 on --sunk, the two grounds it is used on most. Adopting the
//     artifact verbatim would have frozen a WCAG AA failure into a token, where
//     it is far harder to notice than the 194 component classes the audit found.
//
//  2. THE MIGRATED LIST. A screen that has moved onto tokens may not contain a
//     raw palette utility. The list grows as screens land, so the guard tightens
//     with the work instead of arriving at the end — by which point the 1,390
//     would have grown back.
//
//  3. THE FOUNDATION ITSELF: three theme states wired correctly, the fonts
//     actually fetched, and the type scale kept out of Tailwind's namespace.
//
// Run: npm run test:design-tokens

import { readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };

const css = read('src/styles/globals.css');

// ── Parse the tokens out of the stylesheet, rather than restating them ──────
// A copy here would be one more thing to keep in sync, and the whole tranche
// has been deleting those.
function tokensIn(blockStart) {
  const from = css.indexOf(blockStart);
  if (from < 0) return null;
  const open = css.indexOf('{', from);
  let depth = 0, i = open;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) break; }
  }
  const body = css.slice(open + 1, i);
  const out = {};
  for (const [, k, v] of body.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) out[k] = v;
  return out;
}

const light = tokensIn('\n:root {');
const dark = tokensIn(':root[data-theme="dark"]');

function lum(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const AA_BODY = 4.5;
/** Text tokens, and every surface each is rendered on. */
const PAIRS = [
  ['ink', ['card', 'paper', 'sunk', 'card-2']],
  ['ink-2', ['card', 'paper', 'sunk', 'card-2']],
  ['ink-3', ['card', 'paper', 'sunk', 'card-2']],
  ['accent', ['card', 'paper', 'accent-soft']],
  ['ok', ['card', 'paper', 'ok-soft']],
  ['warn', ['card', 'paper', 'warn-soft']],
  ['stop', ['card', 'paper', 'stop-soft']],
  ['idle', ['card', 'paper', 'idle-soft']],
  // --paper as TEXT, on the solid fills it is set on: primary buttons, chat
  // bubbles and avatars (accent), and the status fills. `text-white` was used
  // here and measured 2.32:1 on --ok in dark; --paper flips with the fill.
  ['paper', ['accent', 'ok', 'warn', 'stop']],
];

console.log('Every text token clears WCAG AA on every ground it is used on');
for (const [theme, set] of [['light', light], ['dark', dark]]) {
  if (!set) { bad(`${theme} tokens parse from globals.css`); continue; }
  const failed = [];
  let checked = 0;
  for (const [ink, grounds] of PAIRS) {
    for (const ground of grounds) {
      if (!set[ink] || !set[ground]) { failed.push(`${ink}/${ground} missing`); continue; }
      checked += 1;
      const ratio = contrast(set[ink], set[ground]);
      if (ratio < AA_BODY) failed.push(`--${ink} on --${ground}: ${ratio.toFixed(2)}`);
    }
  }
  if (failed.length) bad(`${theme}: all ${checked} pairs ≥ ${AA_BODY}:1`, failed.join(' · '));
  else ok(`${theme}: ${checked} token pairs, all ≥ ${AA_BODY}:1`);
}

// The specific correction, asserted by value. If someone "restores" the
// artifact's original this fails by name rather than as an anonymous ratio.
if (light?.['ink-3'] === '#6C768F') {
  bad('--ink-3 is the corrected value, not the artifact’s',
    '#6C768F measures 4.20:1 on --paper and 4.01:1 on --sunk — see docs/ui-redesign-plan.md D1');
} else ok(`--ink-3 is ${light?.['ink-3']}, the corrected value`);

// ── The three-state theme mechanism ────────────────────────────────────────
console.log('\nThe theme resolves for all three viewer states');
if (!/@media \(prefers-color-scheme: dark\)/.test(css)) bad('a dark media query exists');
else if (!/:root:not\(\[data-theme="light"\]\)/.test(css)) {
  bad('the dark media query is guarded against an explicit light choice',
    'unguarded, a dark OS overrides a viewer who chose light');
} else ok('the system-dark block is guarded with :not([data-theme="light"])');
if (!/:root\[data-theme="dark"\]/.test(css)) {
  bad('an explicit dark choice has its own block', 'otherwise the toggle cannot beat a light OS');
} else ok('an explicit dark choice has its own block');

// Every token defined in light must exist in dark, or that surface renders one
// theme's text on the other theme's ground.
if (light && dark) {
  const missing = Object.keys(light).filter((k) => !(k in dark));
  if (missing.length) bad('every light token is redefined for dark', missing.join(', '));
  else ok(`all ${Object.keys(light).length} tokens are defined in both themes`);
}

// ── The fonts are actually fetched ─────────────────────────────────────────
console.log('\nThe named fonts are loaded');
const html = read('index.html');
if (!/fonts\.googleapis\.com\/css2\?family=Inter/.test(html)) {
  bad('Inter is fetched, not just named',
    '--font-sans named Inter for the life of the project and nothing loaded it');
} else ok('Inter is fetched');
if (!/IBM\+Plex\+Mono/.test(html)) bad('IBM Plex Mono is fetched');
else ok('IBM Plex Mono is fetched');
if (!/--font-mono:\s*"IBM Plex Mono"/.test(css)) {
  bad('--font-mono resolves to Plex', 'font-mono would fall back to the browser default');
} else ok('--font-mono resolves to Plex');

// ── The type scale stays out of Tailwind's namespace ───────────────────────
console.log('\nThe type scale does not silently resize the app');
// Redefining --text-sm would change all 772 existing `text-sm` uses at once,
// which is the opposite of a phased migration.
for (const collide of ['--text-xs:', '--text-sm:', '--text-base:', '--text-lg:', '--text-xl:']) {
  if (css.includes(collide)) {
    bad(`the scale does not redefine Tailwind's ${collide.slice(2, -1)}`,
      'that resizes every existing use in the tree at once');
  }
}
for (const own of ['--text-eyebrow', '--text-caption', '--text-body', '--text-prose', '--text-heading', '--text-display']) {
  if (!css.includes(`${own}:`)) bad(`${own} is defined`);
}
if (failures === 0) ok('six role-named sizes, none of them Tailwind’s');
// cn() must know the same six names. tailwind-merge took `text-caption` for a
// colour and dropped it whenever a colour followed, so role sizes silently
// vanished inside every component that merged classes — found when the request
// stepper's stage names rendered at 17px.
{
  const utils = read('src/lib/utils.ts');
  const declared = [...(utils.match(/TYPE_SCALE\s*=\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  const inCss = [...css.matchAll(/--text-([a-z]+):/g)].map((m) => m[1]);
  const missing = inCss.filter((n) => !declared.includes(n));
  if (declared.length === 0) bad('cn() registers the type scale with tailwind-merge', 'no TYPE_SCALE found in src/lib/utils.ts');
  else if (missing.length) bad('cn() knows every role size', `missing from TYPE_SCALE: ${missing.join(', ')} — cn() would drop them beside a colour`);
  else ok(`cn() registers all ${declared.length} role sizes, so a colour beside one cannot erase it`);
}
// Same argument for spacing: overriding a step shifts every p-6 in the tree.
if (/--spacing-\d+:/.test(css)) {
  bad('the spacing scale is not redefined', 'overriding a step shifts every existing use');
} else ok('spacing is left to Tailwind’s 4px base');

// ── Nothing names a colour that cannot follow the theme ────────────────────
//
// This began as a list of migrated files and is now its inverse: every .tsx is
// checked, and the exemptions are named with a reason. The list flipped because
// per-file migration turned out to be unsafe for dark — a migrated TEXT on an
// unmigrated SURFACE renders one theme's ink on the other theme's ground, which
// measured 1.16:1 on the approvals card. The colours had to move together, so
// they did: 2,538 classes in one pass.
//
// `bg-white` is called out separately because it reads as harmless. It is a
// literal, so it cannot flip, and it was the surface under most of the app.
import { readdirSync, statSync } from 'node:fs';

/**
 * Files allowed to name a palette colour, and why.
 *
 * The workflow designer's node types encode WHICH KIND of node a chip is — AI
 * agent, notification, start, end — not a status. Folding them into
 * ok/warn/stop would destroy the distinction, so they keep a categorical
 * palette until that screen is designed properly in Phase 3.
 */
const EXEMPT = [
  'src/features/admin/workflow-designer/components/custom-nodes/',
  'src/features/admin/workflow-designer/components/node-palette.tsx',
  'src/components/layout/supplier-portal-layout.tsx',
];

function tsxFiles(dir, out = []) {
  for (const entry of readdirSync(new URL(dir, ROOT))) {
    const rel = `${dir}${entry}`;
    if (statSync(new URL(rel, ROOT)).isDirectory()) tsxFiles(`${rel}/`, out);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(rel);
  }
  return out;
}

const RAW = /\b(?:text|bg|border|ring|divide)-(?:gray|slate|zinc|neutral|stone|red|green|blue|amber|yellow|indigo|purple|teal|orange|emerald|sky|rose)-\d{2,3}\b/g;
// A hex in an arbitrary-value class — `text-[#2D5F8A]`, `bg-[#1B2A4A]/90`. The
// palette scan above could not see these, and 57 of them survived the colour
// migration in 21 files: the command bar's gradient, every primary chat bubble
// and hand-styled button, all fixed at their light-mode value.
const HEX = /-\[#[0-9A-Fa-f]{3,8}\]/g;
// .ts as well as .tsx. Class strings live in .ts lookup tables too, and the one
// that coloured every status badge in the product (src/config/theme.ts) was
// never scanned — so the badges stayed light-mode chips in dark mode.
const all = tsxFiles('src/').filter((f) => !EXEMPT.some((e) => f.startsWith(e)));

console.log(`\nNo source file names a colour that cannot follow the theme (${all.length} files)`);
{
  const offenders = [];
  let whites = 0;
  for (const file of all) {
    const source = read(file);
    const code = source.split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
      .join('\n');
    const hits = [...new Set([...(code.match(RAW) ?? []), ...(code.match(HEX) ?? [])])];
    if (hits.length) offenders.push(`${file.replace('src/', '')}: ${hits.slice(0, 3).join(', ')}`);
    // A literal white surface cannot flip; --card is #FFFFFF in light, so the
    // swap was pixel-identical there and is what makes dark readable.
    whites += (code.match(/(?<![\w-])bg-white(?![\w-])/g) ?? []).length;
  }
  if (offenders.length) bad(`${offenders.length} file(s) still name a palette colour`, offenders.slice(0, 6).join(' | '));
  else ok(`all ${all.length} files name tokens only`);
  if (whites) bad(`${whites} literal bg-white remain`, 'a literal surface cannot follow the theme');
  else ok('no literal bg-white surface');
}

// The aliases are what let an unmigrated component follow the theme at all.
console.log('\nshadcn roles resolve to the semantic tokens');
for (const [role, token] of [
  ['--color-background', '--paper'], ['--color-card', '--card'],
  ['--color-foreground', '--ink'], ['--color-muted-foreground', '--ink-3'],
  ['--color-border', '--line'], ['--color-destructive', '--stop'],
  ['--color-text-primary', '--ink'], ['--color-status-success', '--ok'],
]) {
  if (!new RegExp(`${role}:\\s*var\\(${token}\\)`).test(css)) {
    bad(`${role} is aliased to ${token}`, 'a fixed hex here does not flip, and dark breaks wherever it is used');
  }
}
if (failures === 0) ok('every shadcn and legacy role follows a token');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('Design foundation holds.');
