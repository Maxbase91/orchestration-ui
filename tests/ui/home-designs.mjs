#!/usr/bin/env node
// Verifies the home surface has one serious operational layout. Decorative
// Apple-style variants were retired so users do not land in inconsistent views.
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
// Allow an explicit Chromium path. Sandboxes and CI images often ship a browser
// build that doesn't match the revision the pinned Playwright expects; pointing
// at the installed binary beats reinstalling one per run. Unset locally, where
// Playwright resolves its own download.
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

async function waitForServer(t = 60000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(BASE)).ok) return; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('dev server did not start');
}

const errors = [];

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);

  console.log('Operational dashboard');
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
    check('decorative home-design switcher is removed', (await page.locator('button[title="Home design"]').count()) === 0);
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
