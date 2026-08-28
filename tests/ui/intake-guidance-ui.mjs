#!/usr/bin/env node
// Browser smoke for the New Request wizard's guidance surfaces.
//
// `tsc -b` proves the wizard compiles; it cannot prove a step renders. These
// four changes are all things a green build is blind to:
//
//   * step 1 shows ONE classification block, not the demand three times over
//     with a 600 ms banner nobody can read;
//   * every step carries a header panel saying what it is for, what it needs
//     and what happens after;
//   * the stepper renders the per-step description that had been defined and
//     drawn nowhere since the wizard was written;
//   * step 3's Next is disabled until the mandatory floor is met.
//
// `test:ui` (the full wizard smoke) cannot complete in a sandbox where Supabase
// is unreachable — it dies at the catalogue step. This is the narrow,
// offline-tolerant check, in the same shape as test:service-description-ui:
// domcontentloaded rather than networkidle, and network errors ignored.
//
// Run: npm run test:intake-guidance-ui

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const ROUTE = '/requests/new';

const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(BASE)).ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not become ready at ${BASE} within ${timeoutMs}ms`);
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  // No auth seeding: the wizard is a requester route and the app's default
  // session already reaches it — tests/ui/wizard-smoke.mjs does the same.
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/supabase|Failed to (load resource|fetch)|net::|ERR_TUNNEL/i.test(text)) return;
    pageErrors.push(text);
  });

  // Land on the app root first so the store hydrates, then navigate — the same
  // order the full wizard smoke uses.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('#root *').first().waitFor({ timeout: 20000 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Describe what you need', { exact: true }).waitFor({ timeout: 20000 });

  console.log('The wizard explains itself');
  check('the step header panel renders',
    (await page.getByText('What we need from you', { exact: true }).count()) > 0);
  check('and says what happens after the step',
    (await page.getByText('What happens next', { exact: true }).count()) > 0);
  // The copy that was dead config for the wizard's whole life.
  check("the stepper renders each step's description",
    (await page.getByText('What do you need?', { exact: true }).count()) > 0);
  check('the pre-check step is described as a catalogue & contract match',
    (await page.getByText('Catalogue & contract match', { exact: true }).count()) > 0);

  console.log('\nStep 1 asks once and shows the demand once');
  check('the free-text prompt is present',
    (await page.getByPlaceholder(/I need business consulting/).count()) > 0);
  // The banner repeated the category and supplier from the card above it and
  // auto-advanced after 600 ms. It should not exist at all now.
  check('no accepted banner in the markup',
    !(await page.content()).includes('Details pre-filled. Moving to next step'));
  check('the false "routes the request" sub-label is gone',
    !(await page.content()).includes('routes the request'));

  console.log('\nThe wizard cannot be walked past its gates');
  const next = page.getByRole('button', { name: /^Next$/ });
  check('Next is present', (await next.count()) > 0);
  // Step 1 has no category until something is classified, so Next is disabled —
  // the same mechanism that holds step 3 to the mandatory floor.
  check('Next is disabled before the step is satisfied', await next.first().isDisabled());

  check('no non-network render errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  console.log('');
  if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exitCode = 1; }
  else console.log('All intake-guidance UI checks passed.');
} catch (err) {
  console.error('intake-guidance UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
