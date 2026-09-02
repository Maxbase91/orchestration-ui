#!/usr/bin/env node
// Browser smoke for the mode contract: role defaults, visible switching, and persistence.
// The REST surface is stubbed so this test never writes request or production data.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

const BASE = 'http://localhost:5179';
const USER = { id: 'u6', name: "James O'Brien", email: 'james.obrien@company.com', role: 'service-owner', department: 'Marketing', initials: 'JO' };
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}
async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Dev server not ready');
}

const server = spawn('npm', ['run', 'dev', '--', '--port', '5179', '--strictPort'], {
  stdio: 'ignore', env: {
    ...process.env,
    // Keep this browser suite deterministic and independent from a developer's
    // local Neon URL. The route handoff only needs the fixture REST surface.
  },
});
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext();
  // The stub used to intercept `**/rest/v1/**`, the PostgREST path from before
  // the Neon cutover. The client posts to /api/db, so it caught nothing: every
  // data call 404'd and the pre-check screen rendered its heading over no
  // catalogue and no contracts. Two checks here failed for months on that.
  await installDbStub(context);
  // The pre-check also calls the server matcher directly. "No contract covers
  // this" is a legitimate answer and is what sends the screen to its contract
  // stage — but it has to be the real ContractMatchResponse shape
  // (src/data/types.ts), because the screen maps `candidates` unguarded.
  await context.route('**/api/contract-match', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        sufficient: false, route: 'full-request',
        missingFields: [], questions: [], candidates: [],
      }),
    });
  });
  await context.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'service-owner', currentUser: user }, version: 0 }));
  }, USER);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // Vite serves the SPA but not Vercel serverless functions. Those expected
    // local API 404s are intentionally ignored; uncaught React/runtime errors
    // remain failures.
    if (/Failed to load resource|\/api\//i.test(message.text())) return;
    errors.push(message.text());
  });

  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  check('requester defaults to Simple view', await page.getByText('Simple requester view', { exact: true }).isVisible().catch(() => false));
  check('adaptive describe screen renders', await page.getByText('Describe what you need', { exact: true }).isVisible().catch(() => false));
  const switcher = page.getByRole('button', { name: /Experience view: simple/i });
  check('mode switch is visible and labelled', await switcher.isVisible().catch(() => false));
  await switcher.click();
  await page.getByRole('menuitem', { name: /Expert view/ }).click();
  // The wizard's heading, not any node whose text happens to be "New Request".
  // `getByText(exact)` matched a breadcrumb span before the reload and nothing
  // after it, so this check reported the preference lost when the heading was
  // on screen the whole time. Waits for the element rather than sleeping 250 ms:
  // with the data stub answering /api/db the switch re-renders behind real
  // queries, and a sleep long enough today is a flake tomorrow.
  const expertWizard = page.getByRole('heading', { name: 'New Request', exact: true });
  await expertWizard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  check('switching to Expert preserves the route and renders the expert wizard', await expertWizard.isVisible().catch(() => false));

  await page.reload({ waitUntil: 'networkidle' });
  await expertWizard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  check('mode preference survives reload', await expertWizard.isVisible().catch(() => false));
  const expertSwitcher = page.locator('button[aria-label*="Experience view"]').first();
  await expertSwitcher.click({ force: true, timeout: 3000 });
  await page.getByRole('menuitem', { name: /Simple view/ }).click({ force: true, timeout: 3000 });
  await page.waitForTimeout(250);
  check('switching back to Simple renders the adaptive request entry', await page.getByText('Simple requester view', { exact: true }).isVisible().catch(() => false));

  // A demand entered on Simple Home is already the first intake signal. The
  // route screen should open directly with that text preserved, rather than
  // sending the requester through the describe/classify screen a second time.
  const homeDemand = 'I need a new laptop for a new starter';
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Describe what you need').fill(homeDemand);
  await page.getByRole('button', { name: /Start with this/ }).click();
  await page.waitForURL(`${BASE}/requests/new?q=${encodeURIComponent(homeDemand)}`, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  check('home demand opens directly on route evaluation', await page.getByText('Contract check', { exact: true }).isVisible().catch(() => false));
  check('home demand is carried into route evaluation', await page.getByText(homeDemand, { exact: true }).isVisible().catch(() => false));
  check('home demand skips the duplicate describe screen', (await page.getByText('Describe what you need', { exact: true }).count()) === 0);
  await page.getByRole('button', { name: /Proceed to full request/ }).last().click();
  check('full-request escape opens the adaptive details path', await page.getByPlaceholder('Type your answer...').isVisible().catch(() => false));
  check('full-request escape does not open catalogue selection', (await page.getByText('Choose your items', { exact: true }).count()) === 0);

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  check('Simple home has a clear start-request entry point',
    await page.getByRole('button', { name: /Start with this/ }).isVisible().catch(() => false)
      || await page.getByRole('link', { name: /Open full intake/ }).isVisible().catch(() => false));
  check('Simple home shows requester-focused content', await page.getByText('Your requests', { exact: true }).isVisible().catch(() => false));
  check('Simple home hides Expert dashboard customization', (await page.getByRole('button', { name: /Customise/ }).count()) === 0);
  await page.setViewportSize({ width: 320, height: 800 });
  // The dashboard starts background query refreshes, so networkidle is not a
  // stable readiness signal once the REST surface is stubbed.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const menuButton = page.getByRole('button', { name: 'Open navigation' });
  check('mobile navigation exposes a labelled menu button', await menuButton.isVisible().catch(() => false));
  await menuButton.click({ force: true, timeout: 3000 });
  const drawerText = await page.locator('aside nav').innerText().catch(() => '');
  check('mobile navigation opens the drawer with labels', drawerText.includes('Requests'), drawerText.slice(0, 120));
  check('320px viewport has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('no uncaught browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await context.close();
} catch (error) {
  console.error(`experience-mode-ui errored: ${error.message}`);
  failures++;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All experience-mode browser checks passed.');
process.exit(failures === 0 ? 0 : 1);
