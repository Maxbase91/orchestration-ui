#!/usr/bin/env node
// Full UI-only UAT **evidence harness** for the procurement lifecycle. It uses
// the visible role switcher, records every checkpoint, and never writes through
// an API.
//
// Read what it does and does not prove. It walks 60+ checkpoints and screenshots
// each, but it asserts only two things: that no uncaught page error occurred and
// that the page rendered something (`#root` has children). It records the
// heading it found into the manifest without checking it, so a screen that
// renders the wrong content passes.
//
// That makes it a good regression net for crashes and white screens across a
// wide surface, and a poor one for correctness. Content assertions belong in the
// focused suites — test:request-detail-ui drives one screen against fixtures and
// checks actual values. Do not read a green run here as "the lifecycle works".
//
// Its output goes to a gitignored directory: a run writes ~5 MB of PNGs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.E2E_UI_BASE ?? 'http://localhost:5173';
const LIVE_WRITES = process.env.ALLOW_LIVE_WRITES === '1';
const LOCAL_VITE = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(BASE);
const runId = `ui-e2e-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const artifactDir = `docs/testing/artifacts/ui-e2e/${runId}`;
mkdirSync(artifactDir, { recursive: true });

const ROLES = {
  requester: 'Requestor / End User',
  procurement: 'Strategic Procurement Manager',
  vendor: 'Vendor Manager',
  operations: 'Procurement Operations Lead',
  admin: 'Admin / Platform Owner',
  supplier: 'Supplier (External)',
};

const routes = {
  requester: ['/', '/requests/new', '/requests/my', '/help/kb', '/help/support'],
  procurement: ['/requests', '/approvals', '/sourcing', '/contracts', '/purchasing/invoices', '/purchasing/payments'],
  vendor: ['/suppliers', '/suppliers/risk', '/suppliers/onboarding', '/contracts'],
  operations: ['/tasks', '/purchasing/receipt', '/purchasing/invoices', '/purchasing/match'],
  admin: ['/admin/rules', '/admin/policies', '/admin/workflows', '/admin/database', '/admin/audit'],
  supplier: ['/portal', '/portal/sourcing', '/portal/invoices', '/portal/documents', '/portal/messages'],
};

const findings = [];
const unavailable = [];
let screenshotNumber = 0;

function screenshotPath(label) {
  const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${artifactDir}/${String(++screenshotNumber).padStart(3, '0')}-${safe}.png`;
}

async function checkpoint(page, scenario, role, stage, action, expected) {
  const file = screenshotPath(`${scenario}-${role}-${stage}`);
  await page.screenshot({ path: file, fullPage: true });
  findings.push({ scenario, role, stage, action, expected, observedUrl: page.url(), screenshot: file, errors: [] });
  return file;
}

async function switchRole(page, roleLabel) {
  console.log(`  switch role ${roleLabel}`);
  const trigger = page.getByRole('button', { name: /James O'Brien|Anna Müller|Sarah Chen|Marcus Johnson|Christine Dupont|David Schneider/ }).first();
  await trigger.click({ timeoutMs: 8000 });
  // `Supplier (External)` contains regex metacharacters, so use visible text
  // filtering instead of interpolating role labels into a regular expression.
  await page.getByRole('menuitem').filter({ hasText: roleLabel }).first().click({ timeoutMs: 8000 });
  await page.waitForTimeout(250);
}

async function visit(page, scenario, roleKey, route) {
  console.log(`  route ${roleKey} ${route}`);
  // Supplier portal uses a separate shell without the internal persona menu;
  // switch from the common home shell before entering every route.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(350);
  await switchRole(page, ROLES[roleKey]);
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(600);
  const rootCount = await page.locator('#root *').count().catch(() => 0);
  const heading = await page.locator('main h1, main h2').first().innerText().catch(() => '');
  findings.push({ scenario, role: roleKey, stage: 'route', action: `open ${route}`, expected: 'screen renders', observedUrl: page.url(), heading, whiteScreen: rootCount < 3, errors: [] });
  await checkpoint(page, scenario, roleKey, 'route', `open ${route}`, 'screen renders');
}

async function fillCatalogue(page) {
  await switchRole(page, ROLES.requester);
  await page.goto(`${BASE}/catalogue/items/IT-001`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(800);
  await page.getByLabel('Who is this for?').fill('UI-E2E-20260830 laptop recipient');
  await page.getByLabel('What is it needed for?').fill('UI-E2E-20260830 catalogue lifecycle verification');
  // Both are pickers over the reference tables now, and neither is defaulted
  // behind the requester, so both have to be chosen for review to enable.
  const cost = page.getByLabel('Charged to');
  if (await cost.evaluate((el) => el.tagName === 'SELECT').catch(() => false)) await cost.selectOption({ index: 1 });
  const location = page.getByLabel('Deliver to');
  if (await location.evaluate((el) => el.tagName === 'SELECT').catch(() => false)) await location.selectOption({ index: 1 });
  await checkpoint(page, 'catalogue', 'requester', 'checkout-filled', 'fill mandatory order details', 'review enabled');
  const review = page.getByRole('button', { name: /Review order/i });
  if (!(await review.isEnabled().catch(() => false))) throw new Error('catalogue review remains disabled');
  if (!LIVE_WRITES) return;
  await review.click();
  await page.waitForTimeout(800);
  await checkpoint(page, 'catalogue', 'requester', 'checkout-reviewed', 'review catalogue order', 'request form retains item details');
}

async function run() {
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => findings.push({ scenario: 'runtime', role: 'unknown', stage: 'pageerror', action: error.message, expected: 'no uncaught error', observedUrl: page.url(), errors: [error.message] }));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Local Vite does not host Vercel serverless functions. Keep these visible
    // in the manifest, but do not misclassify infrastructure absence as an app defect.
    if (LOCAL_VITE && (/\/api\//.test(text) || /status of 404 \(Not Found\)/i.test(text))) {
      unavailable.push({ kind: 'local-serverless', message: text, url: page.url() });
      return;
    }
    findings.push({ scenario: 'runtime', role: 'unknown', stage: 'console', action: text, expected: 'no console error', observedUrl: page.url(), errors: [text] });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    if (LOCAL_VITE && response.url().includes('/api/')) {
      unavailable.push({ kind: 'local-serverless', status: response.status(), url: response.url() });
      return;
    }
    if (!response.url().includes('/api/')) findings.push({ scenario: 'runtime', role: 'unknown', stage: 'http', action: `${response.status()} ${response.url()}`, expected: 'successful page resource', observedUrl: page.url(), errors: [`HTTP ${response.status()}`] });
  });

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(600);
  await checkpoint(page, 'shell', 'requester', 'home', 'open home', 'requester entry point renders');

  for (const [roleKey, roleRoutes] of Object.entries(routes)) {
    for (const route of roleRoutes) {
      try { await visit(page, 'route-sweep', roleKey, route); }
      catch (error) { findings.push({ scenario: 'route-sweep', role: roleKey, stage: 'route', action: route, expected: 'screen renders', observedUrl: page.url(), errors: [String(error)] }); }
    }
  }

  // The last route in the matrix is the supplier portal, whose shell has a
  // different header. Return to the shared app shell before switching back to
  // the requester persona for checkout readiness; otherwise the role trigger
  // is not present and the harness stops before it writes its manifest.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(500);

  // One checkout. This ran twice, once per experience mode, when the same
  // component was mounted with a different `mode` prop.
  try { await fillCatalogue(page); }
  catch (error) { findings.push({ scenario: 'catalogue', role: 'requester', stage: 'checkout', action: 'fill/review', expected: 'mandatory fields enable review', observedUrl: page.url(), errors: [String(error)] }); }

  // Responsive and keyboard checks are read-only and run after the main paths.
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await checkpoint(page, 'responsive', 'requester', `${width}px`, 'open home', `no horizontal overflow (observed ${overflow ? 'overflow' : 'ok'})`);
  }

  writeFileSync(`${artifactDir}/manifest.json`, JSON.stringify({ runId, base: BASE, liveWrites: LIVE_WRITES, localServerlessUnavailable: unavailable, findings }, null, 2));
  const lines = [`# UI E2E ${runId}`, '', `Base: ${BASE}`, `Live writes enabled: ${LIVE_WRITES}`, '', '| Scenario | Role | Stage | Action | Result | Screenshot |', '|---|---|---|---|---|---|'];
  for (const finding of findings) lines.push(`| ${finding.scenario} | ${finding.role} | ${finding.stage} | ${finding.action} | ${(finding.errors?.length ?? 0) ? 'FAILED' : 'OBSERVED'} | ${finding.screenshot ? `[image](${finding.screenshot.split('/').pop()})` : ''} |`);
  writeFileSync(`${artifactDir}/INDEX.md`, `${lines.join('\n')}\n`);
  await browser.close();
  const failures = findings.filter((finding) => finding.errors?.length || finding.whiteScreen).length;
  console.log(`UI E2E complete: ${findings.length} checkpoints, ${failures} failures, ${unavailable.length} local-serverless unavailable. Artifacts: ${artifactDir}`);
  if (failures > 0) process.exitCode = 1;
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
