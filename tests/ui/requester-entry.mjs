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
  check('the describe screen renders', await page.getByText('Describe what you need', { exact: true }).isVisible().catch(() => false));
  // There is no experience switch to find any more: one UI, so nothing to pick
  // before the requester can start.
  check('no experience-view switch is offered',
    (await page.locator('button[aria-label*="Experience view"]').count()) === 0);

  // A demand entered on Home is already the first intake signal, and it lands on
  // the describe step with that text ALREADY CLASSIFIED — the commodity
  // assessment is the point of that screen, not a duplicate of the home box.
  // What must never happen is being asked for the text a second time.
  const homeDemand = 'I need a new laptop for a new starter';
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  // The home demand box moved: it was on the separate Simple home page, and the
  // one home carries the smart command bar instead. The handoff it has to make
  // is the same one — the text becomes `?q=` on intake, already classified.
  await page.locator('input[placeholder*="Press Enter"]').fill(homeDemand);
  await page.locator('input[placeholder*="Press Enter"]').press('Enter');
  await page.waitForURL(`${BASE}/requests/new?q=${encodeURIComponent(homeDemand)}`, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  const classified = await page.getByText(/suggested commodity or service family/i)
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('home demand lands on the commodity assessment, already classified', classified);
  check('the demand text is carried, not retyped',
    (await page.getByText(homeDemand).count()) > 0);
  check('the requester is not asked for the text a second time',
    (await page.locator('#need-input').inputValue().catch(() => '')) !== ''
    || (await page.getByText(homeDemand).count()) > 0);

  await page.getByRole('button', { name: /Accept & continue/ }).click();
  // The buy-route screen only resolves when the catalogue and contract sources
  // are reachable; this suite's dev server has no serverless handlers, so it
  // legitimately reports that neither could be checked. Accept either — what is
  // asserted here is that the demand reached the route decision at all.
  const reachedRouteScreen = await Promise.race([
    page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 }).then(() => true),
    page.getByText('We could not check what already exists', { exact: true }).waitFor({ timeout: 15000 }).then(() => true),
  ]).catch(() => false);
  check('accepting the classification reaches the buy-route decision', reachedRouteScreen);
  await page.getByRole('button', { name: /^Start$|^Continue$/ }).last().click();
  check('full-request escape opens the adaptive details path', await page.getByPlaceholder('Type your answer...').isVisible().catch(() => false));
  check('full-request escape does not open catalogue selection', (await page.getByText('Choose your items', { exact: true }).count()) === 0);

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // One home for every role. A requester's default widget layout is their own
  // requests rather than KPIs, so the simplification that used to come from
  // picking "Simple" now comes from the role — without asking them to choose.
  check('home has a clear start-request entry point',
    await page.locator('input[placeholder*="Press Enter"]').isVisible().catch(() => false)
      || await page.getByRole('button', { name: /New Request/i }).first().isVisible().catch(() => false));
  check('home shows the requester their own work',
    (await page.locator('main').innerText()).toLowerCase().includes('request'));
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
  console.error(`requester-entry-ui errored: ${error.message}`);
  failures++;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All requester-entry browser checks passed.');
process.exit(failures === 0 ? 0 : 1);
