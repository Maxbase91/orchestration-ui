#!/usr/bin/env node
// Read-only navigation contract for the active dashboard and request detail
// surfaces. It uses the visible role/mode controls so a route that falls back
// to Home is reported as an entitlement/link defect rather than hidden by a
// storage shortcut.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.E2E_UI_BASE ?? 'https://orchestration-ui.vercel.app';
const runId = `link-navigation-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
const artifactDir = process.env.E2E_UI_ARTIFACT_DIR ?? `docs/testing/artifacts/ui-e2e/${runId}`;
await mkdir(artifactDir, { recursive: true });

let failures = 0;
const results = [];
const errors = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function screenshot(page, name) {
  const path = `${artifactDir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function setRole(page, label) {
  await page.locator('header button').last().click();
  await page.getByRole('menuitem', { name: new RegExp(label, 'i') }).click();
  await page.waitForTimeout(700);
}

async function setExpertMode(page) {
  const trigger = page.getByRole('button', { name: /Experience view:/i });
  await trigger.click();
  const expert = page.getByRole('menuitem', { name: /Expert view/i });
  if (await expert.count()) await expert.click();
  await page.waitForTimeout(700);
}

async function openAndAssert(page, locator, expected, label) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.focus();
  await screenshot(page, `${label}-before`);
  await locator.click();
  await page.waitForTimeout(900);
  const url = page.url();
  check(`${label} reaches ${expected}`, new URL(url).pathname.startsWith(expected), url);
  check(`${label} does not fall back to Home`, new URL(url).pathname !== '/', url);
  await screenshot(page, `${label}-after`);
  return url;
}

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  console.log(`Link navigation run against ${BASE}`);

  // Requester path: the supplier is visible from the request overview and is
  // now a read-only detail route rather than an authorization redirect.
  await page.goto(`${BASE}/requests/REQ-2025-7833`, { waitUntil: 'networkidle', timeout: 60000 });
  await setRole(page, 'Requestor / End User');
  await setExpertMode(page);
  await page.goto(`${BASE}/requests/REQ-2025-7833`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2200);
  const supplierLink = page.getByRole('link', { name: 'Lenovo', exact: true });
  const supplierUrl = await openAndAssert(page, supplierLink, '/suppliers/', 'request-overview-supplier');
  check('requester supplier detail renders the supplier identity', await page.getByText('Lenovo', { exact: true }).count() > 0, supplierUrl);

  // Requesters can inspect contract data, but contract editing remains hidden.
  await page.goto(`${BASE}/contracts/CON-002`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2200);
  check('requester contract detail renders', new URL(page.url()).pathname === '/contracts/CON-002' && await page.getByRole('tab', { name: 'Summary' }).count() > 0);
  check('requester contract editing is read-only', new URL(page.url()).pathname === '/contracts/CON-002' && await page.getByRole('button', { name: 'Save coverage' }).count() === 0);
  check('requester contract renewal action is hidden', new URL(page.url()).pathname === '/contracts/CON-002' && await page.getByRole('button', { name: /Initiate Renewal/i }).count() === 0);

  // The requester expert dashboard includes expiring contracts. Its row must
  // remain a keyboard-accessible button and land on the selected contract.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2200);
  const reset = page.getByRole('button', { name: 'Reset to Default' });
  if (await reset.count()) { await reset.click(); await page.waitForTimeout(600); }
  const expiring = page.getByRole('button', { name: /Open contract details for/i }).first();
  if (await expiring.count()) {
    await openAndAssert(page, expiring, '/contracts/', 'expiring-contract');
  } else {
    check('expiring-contract widget has an actionable row', false, 'no expiring contract row was returned');
  }

  // Privileged roles retain operational controls on the same contract page.
  await setRole(page, 'Admin / Platform Owner');
  await page.goto(`${BASE}/contracts/CON-002`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.getByRole('tab', { name: 'Coverage & Matching' }).click();
  check('admin retains contract coverage controls', await page.getByRole('button', { name: 'Save coverage' }).count() > 0);

  check('no console or uncaught runtime errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  check('no horizontal overflow at desktop width', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
} catch (error) {
  check('link-navigation suite completed', false, error.message);
} finally {
  await writeFile(`${artifactDir}/manifest.json`, JSON.stringify({ base: BASE, runId, results, errors }, null, 2));
  await context.close();
  await browser.close();
}

console.log(`Artifacts: ${artifactDir}`);
process.exitCode = failures ? 1 : 0;
