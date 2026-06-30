#!/usr/bin/env node
// Verifies the alternative home designs (1a/1b/1c) are FULLY FUNCTIONAL — not
// static marketing pages — and that the current dashboard is untouched.
//
// For each design: the real front door, role quick-actions, live pipeline
// stages and a working "Start a request" CTA must render. Then it confirms the
// default '/' still shows the dashboard, and that the top-bar toggle switches
// designs live. Run: node tests/ui/home-designs.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
async function waitForServer(t = 60000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(BASE)).ok) return; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('dev server did not start');
}

const STAGES = ['Intake', 'Routing', 'Approvals', 'Automation', 'Fulfilled'];
const errors = [];

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch();

  for (const variant of ['1a', '1b', '1c']) {
    console.log(`Design ${variant}`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((v) => localStorage.setItem('settings', JSON.stringify({ state: { currency: 'EUR', matchTolerancePct: 2, homeDesign: v }, version: 0 })), variant);
    await ctx.addInitScript(() => localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'procurement-manager' }, version: 0 })));
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') { const u = m.location()?.url ?? ''; if (/\/api\//.test(u) && /Failed to load resource/.test(m.text())) return; errors.push(`[${variant}] ${m.text()}`); } });
    page.on('pageerror', (e) => errors.push(`[${variant}] pageerror: ${e.message}`));

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.getByText('What do you need?').first().waitFor({ timeout: 15000 });
    check('renders the real front door (SmartCommandBar), not static copy',
      (await page.getByText('What do you need?').count()) > 0
      && (await page.getByPlaceholder(/Press Enter/).count()) > 0);
    let stagesSeen = 0;
    for (const s of STAGES) if ((await page.getByText(s, { exact: true }).count()) > 0) stagesSeen++;
    check('live demand-pipeline stages render (real data)', stagesSeen === STAGES.length, `${stagesSeen}/5`);
    check('role quick-actions render (functional)', (await page.getByText('New Request', { exact: true }).count()) > 0);
    check('it is a design, not the dashboard (no Customise control)', (await page.getByText('Customise', { exact: true }).count()) === 0);
    // The "Start a request" CTA actually routes into the front door.
    await page.getByRole('button', { name: /Start a request/ }).first().click();
    await page.waitForURL(/\/requests\/new/, { timeout: 10000 }).catch(() => {});
    check('"Start a request" navigates to the real new-request flow', /\/requests\/new/.test(page.url()), page.url());
    await ctx.close();
  }

  // Default '/' still shows the untouched dashboard.
  console.log('Dashboard intact + live switch');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(() => localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin' }, version: 0 })));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[dashboard] pageerror: ${e.message}`));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.getByText('System Health').first().waitFor({ timeout: 15000 });
    check('default / still renders the current dashboard (Customise + widgets)',
      (await page.getByText('Customise', { exact: true }).count()) > 0
      && (await page.getByText('System Health').count()) > 0);
    // Toggle to a design live via the top-bar switcher (target by its title to
    // avoid the sidebar's "Dashboards" nav item).
    await page.locator('button[title="Home design"]').click();
    await page.getByRole('menuitem', { name: /Cupertino/ }).click();
    await page.getByText('One front door', { exact: false }).waitFor({ timeout: 10000 });
    check('top-bar toggle switches to a design live', (await page.getByText('One front door', { exact: false }).count()) > 0);
    await ctx.close();
  }

  check('no console / page errors across all designs', errors.length === 0, errors.slice(0, 4).join(' | '));

  console.log('');
  if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
  else console.log('All home-design checks passed.');
} catch (err) {
  console.error('home-designs errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
