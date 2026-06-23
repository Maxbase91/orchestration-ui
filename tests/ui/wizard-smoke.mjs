#!/usr/bin/env node
// Browser smoke test for the new-request wizard.
//
// Boots the Vite dev server, drives the wizard in a headless browser, and
// asserts the connector-backed pre-check step actually renders — the kind of
// runtime/render failure that `tsc -b` and `npm run build` cannot catch.
// Also fails on any uncaught page error or console error during the flow.
//
// Run: npm run test:ui   (requires .env.local with Supabase creds)

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures++;
    console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not become ready at ${BASE} within ${timeoutMs}ms`);
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const page = await browser.newContext().then((c) => c.newPage());

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // 1. App boots and React mounts.
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#root *').first().waitFor({ timeout: 15000 });
  check('app shell mounts at /', (await page.locator('#root *').count()) > 0);

  // 2. New-request wizard renders its first (category) step.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  const goodsTile = page.getByText('Goods', { exact: true }).first();
  await goodsTile.waitFor({ timeout: 15000 });
  check('wizard category step renders', await goodsTile.isVisible());

  // The category taxonomy (canonical default or the configured store) maps to
  // tiles — assert several distinct categories render, not just one.
  for (const label of ['Consulting', 'Software / IT', 'Services']) {
    check(`taxonomy renders "${label}" tile`,
      (await page.getByText(label, { exact: true }).count()) > 0);
  }

  // 3. Pick a category and advance to the pre-check step. This step reads
  //    catalogue + contracts + suppliers through the source-connector layer,
  //    so reaching it proves those reads execute in the browser.
  await goodsTile.click();
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByText('Catalogue & Contract Check').waitFor({ timeout: 15000 });
  check('pre-check step renders via connector reads', true);

  // 4. Reach the determination screen via the form-based path, where the
  //    PSL/DTPS policy checks and risk-aware routing render.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.getByText('Contract Renewal', { exact: true }).first().click();
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByRole('button', { name: /Proceed to full request/ }).click();
  await page.locator('#title').fill('Renewal smoke test');
  await page.locator('#value').fill('50000');
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByText('Buying Channel Classification', { exact: true }).waitFor({ timeout: 15000 });
  check('determination screen renders', true);
  // Materiality is surfaced in the always-rendered determination panel (not
  // gated by the validator agent), so assert it appears.
  check('materiality determination surfaces', (await page.getByText(/Materiality:/).count()) > 0);
  check('inherent risk segmentation surfaces', (await page.getByText(/Inherent risk:/).count()) > 0);

  // Mini-IRQ (delta) capture: toggling "critical service" must drive the
  // inherent-risk cascade to critical (a live recompute).
  check('mini-IRQ delta capture renders', (await page.getByText('Mini risk questionnaire').count()) > 0);
  await page.locator('#mini-irq-critical').click();
  await page.getByText('Supports a critical service').waitFor({ timeout: 8000 });
  check('mini-IRQ toggle drives the cascade (critical service → critical risk)', true);

  // The determination endpoint lists the downstream handoff steps with systems.
  check('next-steps handoff panel renders', (await page.getByText('Next steps', { exact: true }).count()) > 0);
  check('handoff routes the detailed risk assessment', (await page.getByText('Third-party risk register').count()) > 0);

  // Policy checks render only when the Request Validator agent (AI-002) is
  // active (an admin toggle); otherwise the step shows the validator notice.
  // Assert the policy-check region rendered in a valid state, and when the
  // validator is active, that the new DTPS + PSL checks are the ones surfaced.
  const dtps = await page.getByText('Competitive sourcing (DTPS)').count();
  const validatorNotice = await page.getByText('Request Validator agent').count();
  check('policy-check region renders (DTPS checks when validator active, else notice)',
    dtps > 0 || validatorNotice > 0, `dtps=${dtps} notice=${validatorNotice}`);
  if (dtps > 0) {
    check('preferred-supplier (PSL) check surfaces alongside DTPS',
      (await page.getByText('Preferred-supplier routing').count()) > 0);
  }

  // 5. No runtime errors surfaced during the flow.
  check('no console / page errors during flow', consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(' | '));

  console.log('');
  if (failures) {
    console.error(`FAILED: ${failures} UI check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('All wizard UI smoke checks passed.');
  }
} catch (err) {
  console.error('UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
