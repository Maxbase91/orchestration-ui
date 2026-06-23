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

  // 2. New-request wizard renders its first (category) step. Free text is the
  //    primary entry point (FD-E3-10); the category grid is a manual fallback
  //    behind a disclosure, so we reveal it before asserting the tiles.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.getByText('Describe what you need').waitFor({ timeout: 15000 });
  check('wizard category step renders free-text entry', true);
  check('category grid is hidden by default (free text primary)',
    (await page.getByText('Goods', { exact: true }).count()) === 0);
  await page.getByRole('button', { name: /choose a category manually/i }).click();
  const goodsTile = page.getByText('Goods', { exact: true }).first();
  await goodsTile.waitFor({ timeout: 15000 });
  check('manual category grid reveals on demand', await goodsTile.isVisible());

  // The category taxonomy (canonical default or the configured store) maps to
  // tiles — assert several distinct categories render, not just one.
  for (const label of ['Consulting', 'Software / IT', 'Services']) {
    check(`taxonomy renders "${label}" tile`,
      (await page.getByText(label, { exact: true }).count()) > 0);
  }

  // 3. Pick a category and advance to the staged pre-check. Stage 1 is the
  //    catalogue check, which reads catalogue items through the connector
  //    layer — reaching it proves those reads execute in the browser. The
  //    contract check must NOT be visible yet (no premature assertion).
  await goodsTile.click();
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByText('Catalogue check', { exact: true }).waitFor({ timeout: 15000 });
  check('pre-check stage 1 (catalogue) renders via connector reads', true);
  check('contract check is NOT shown before catalogue is ruled out',
    (await page.getByText('Contract check', { exact: true }).count()) === 0);

  // 4. Step 4 — Risk & assessment: the mini-IRQ delta capture lives here.
  //    Drive the full staged funnel: catalogue (no match) → enrich → contract
  //    (no match) → proceed to full request.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /choose a category manually/i }).click();
  await page.getByText('Contract Renewal', { exact: true }).first().click();
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByText('Catalogue check', { exact: true }).waitFor({ timeout: 15000 });
  await page.locator('textarea').first().fill('annual renewal of an existing managed service, EMEA region');
  await page.getByRole('button', { name: /Check for a covering contract/ }).click();
  await page.getByText('Contract check', { exact: true }).waitFor({ timeout: 15000 });
  check('pre-check stage 2 (contract) reached only after enrichment', true);
  await page.getByRole('button', { name: /Proceed to full request/ }).click();
  await page.locator('#title').fill('Renewal smoke test');
  await page.locator('#value').fill('150000');  // ≥ critical-service threshold so that residual question triggers
  await page.getByRole('button', { name: /Next/ }).click();              // → step 4 (risk)
  await page.getByText('Mini risk questionnaire').waitFor({ timeout: 15000 });
  check('risk step renders the mini-IRQ delta capture', true);
  // The residual questions are criteria-driven (FD-E3-10 stage 5): the
  // critical-service question shows because the spend is material in size, and
  // it states why it's being asked.
  check('residual question is criteria-triggered (shows its rationale)',
    (await page.getByText(/Asked because:/).count()) > 0);
  await page.locator('#mini-irq-critical').click();                      // toggle on the risk step

  // 5. Step 5 — Determination: channel, contract/sourcing type, materiality,
  //    inherent risk (driven by the mini-IRQ toggle above), handoff next-steps.
  await page.getByRole('button', { name: /Next/ }).click();              // → step 5 (determination)
  await page.getByText('Buying Channel Classification', { exact: true }).waitFor({ timeout: 15000 });
  check('determination screen renders', true);
  check('materiality determination surfaces', (await page.getByText(/Materiality:/).count()) > 0);
  check('inherent risk segmentation surfaces', (await page.getByText(/Inherent risk:/).count()) > 0);
  check('mini-IRQ toggle drove the cascade (critical-service driver appears)', (await page.getByText('Supports a critical service').count()) > 0);
  check('contract-type & sourcing-type surface', (await page.getByText(/Contract type:/).count()) > 0);
  check('next-steps handoff panel renders', (await page.getByText('Next steps', { exact: true }).count()) > 0);
  check('handoff routes the detailed risk assessment', (await page.getByText('Third-party risk register').count()) > 0);
  check('second contract check (Contract coverage) renders', (await page.getByText('Contract coverage', { exact: true }).count()) > 0);
  check('approval-to-source gate renders', (await page.getByText('Approval to source', { exact: true }).count()) > 0);
  check('approval-to-source shows a demand-validation gate', (await page.getByText('Demand validation', { exact: true }).count()) > 0);

  // The determination is exportable — clicking Export downloads a .md file.
  check('determination Export button renders', (await page.getByRole('button', { name: /Export/ }).count()) > 0);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.getByRole('button', { name: /Export/ }).click(),
  ]);
  check('Export downloads a determination markdown file',
    Boolean(download) && /determination-.*\.md/.test(download.suggestedFilename()),
    download ? download.suggestedFilename() : 'no download');

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
