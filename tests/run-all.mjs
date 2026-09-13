#!/usr/bin/env node
// Runs every `test:*` suite and reports one result.
//
// Why this exists: there are ~90 npm scripts and no way to run them together,
// so "the suite is green" was an unverifiable claim — the 72-commit tranche that
// migrated the database to Neon shipped without one, and the only real gate was
// a failing Vercel deploy.
//
// Suites are discovered from package.json rather than listed here, so a new
// `test:*` script is picked up automatically and cannot be forgotten. The only
// hand-maintained set is BROWSER — suites needing a Chromium binary, run
// separately via `npm run test:ui:all`.
//
// Exit codes from the suites themselves: 0 pass, 1 fail, 3 skipped (see
// tests/lib/live.mjs). A skip is reported as a skip, never counted as a pass.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SKIP_EXIT_CODE = 3;
// A suite that hangs is worse than one that fails: unbounded, it blocks CI
// indefinitely and looks like a slow build rather than a broken test.
const SUITE_TIMEOUT_MS = 120_000;

// Needs a browser binary and a dev server, so it runs as its own pass rather
// than inside the default gate. `npm run test:all -- --browser` includes them.
//
// Membership is decided by what a suite *needs*, not by its name.
// `test:catalogue-ui` sat here for its suffix: it is a static readFileSync
// scan over five .tsx files with no Playwright import, so the default gate was
// skipping it for no reason.
const BROWSER = new Set([
  'test:ui', 'test:e2e-ui', 'test:ui-full',
  'test:service-description-ui', 'test:intake-guidance-ui', 'test:request-detail-ui',
  'test:interactions-ui', 'test:requester-entry-ui', 'test:link-navigation',
  'test:dashboard-ui', 'test:reference-data-ui', 'test:routing-rules-ui',
  'test:approval-chains-ui',
]);

// Suites that call a third party. Kept out of the default gate because a
// per-commit check must not depend on someone else's uptime: `test:models` asks
// Groq and Gemini what they currently serve, so an outage at either would
// redden a pull request that has nothing to do with them. What it guards
// against — a model id retired out from under us — is a periodic concern, not a
// per-commit one, so run it deliberately: `npm run test:models`, or
// `npm run test:all -- --external`.
//
// It also needs GROQ_API_KEY / GEMINI_API_KEY, which CI does not carry; without
// them it can check nothing, which is how it failed the first time it ran there.
const EXTERNAL = new Set(['test:models']);

// This runner is itself registered as `test:all`; without excluding the
// aggregates, discovery finds them and the run recurses into itself.
const AGGREGATE = new Set(['test:all', 'test:ui:all']);

const includeBrowser = process.argv.includes('--browser');
const includeExternal = process.argv.includes('--external');
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const suites = Object.keys(scripts)
  .filter((name) => name.startsWith('test:'))
  .filter((name) => !AGGREGATE.has(name))
  .filter((name) => includeBrowser || !BROWSER.has(name))
  .filter((name) => includeExternal || !EXTERNAL.has(name))
  .sort();

const passed = [];
const skipped = [];
const failed = [];

for (const suite of suites) {
  const result = spawnSync('npm', ['run', '--silent', suite], { encoding: 'utf8', timeout: SUITE_TIMEOUT_MS });
  if (result.signal) {
    failed.push({ suite, output: `timed out after ${SUITE_TIMEOUT_MS / 1000}s (killed with ${result.signal})` });
    process.stdout.write('T');
    continue;
  }
  const code = result.status ?? 1;
  if (code === 0) { passed.push(suite); process.stdout.write('.'); }
  else if (code === SKIP_EXIT_CODE) { skipped.push(suite); process.stdout.write('s'); }
  else {
    // Keep the tail of the output: the failing assertion is almost always last.
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trimEnd().split('\n').slice(-12).join('\n');
    failed.push({ suite, output });
    process.stdout.write('F');
  }
}

console.log(`\n\n${passed.length} passed · ${skipped.length} skipped · ${failed.length} failed`);
if (skipped.length) {
  console.log(`\nSkipped (no live database — set NEON_DATABASE_URL, or REQUIRE_LIVE=1 to make these fail):`);
  for (const suite of skipped) console.log(`  ${suite}`);
}
for (const { suite, output } of failed) {
  console.log(`\n── ${suite} ──\n${output}`);
}
process.exit(failed.length === 0 ? 0 : 1);
