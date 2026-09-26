#!/usr/bin/env node
// Browser check: the Active Workflows board is view-only (2026-09-26), run
// against the stubbed database.
//
// Its cards were draggable, and a drop sent `kanban-move` to the server, which
// moved the request to any stage past its gates, blocking forms, onboarding
// checks and approvals. The board now shows where each request is and a card
// opens the request, where the stage action checks all of that; the server
// refuses a board move (test:workflow-atomic). This drives the board.
//
// Run: npm run test:workflows-board-ui   (no credentials, no network)

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

// Its own port, with --strictPort: a port taken by another app fails the start
// rather than testing that app. UI_PORT overrides it.
const PORT = process.env.UI_PORT ?? '5185';
const BASE = `http://localhost:${PORT}`;
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const ADMIN = { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD' };

let failures = 0;
let ran = false;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}

let serverExited = false;
async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    if (serverExited) throw new Error(`The dev server did not start — is port ${PORT} in use? Set UI_PORT to another port.`);
    try {
      const res = await fetch(BASE);
      if (res.ok) {
        if ((await res.text()).includes('<title>Procurement Orchestration Platform</title>')) return;
        throw new Error(`Port ${PORT} is serving another app. Set UI_PORT to a free port.`);
      }
    } catch (error) {
      if (error instanceof Error && /another app/.test(error.message)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Dev server not ready');
}

const request = (id, title, status) => ({
  id, title, description: '', category: 'services', status, priority: 'medium', value: 25000, currency: 'EUR',
  requestor_id: 'u11', owner_id: 'u11', buying_channel: 'procurement-led', cost_centre: 'CC-ENG-001',
  is_urgent: false, days_in_stage: 2, is_overdue: false, refer_back_count: 0,
  created_at: '2026-09-01T09:00:00Z', updated_at: '2026-09-20T09:00:00Z',
});
const REQUESTS = [
  request('REQ-BOARD-0001', 'Facilities cleaning for the head office', 'validation'),
  request('REQ-BOARD-0002', 'Translation services for product manuals', 'sourcing'),
];

const server = spawn('npm', ['run', 'dev', '--', '--port', PORT, '--strictPort'], { stdio: 'ignore' });
server.on('exit', () => { serverExited = true; });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await installDbStub(context, { requests: REQUESTS, requests_with_derived: REQUESTS.map((r) => ({ ...r, days_in_stage_live: 2 })) });
  await context.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: user }, version: 0 }));
  }, ADMIN);
  // Any stage move the page tried would reach this.
  const moves = [];
  await context.route('**/api/workflow-action', async (route) => {
    moves.push(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  console.log('\nThe board shows where each request is');
  await page.goto(`${BASE}/workflows`, { waitUntil: 'domcontentloaded' });
  const card = page.getByRole('button', { name: /Open REQ-BOARD-0001/ });
  await card.waitFor({ timeout: 20000 });
  check('each request is a card in its stage’s column',
    (await page.getByRole('region', { name: 'Validation' }).getByRole('button', { name: /REQ-BOARD-0001/ }).count()) === 1
      && (await page.getByRole('region', { name: 'Sourcing' }).getByRole('button', { name: /REQ-BOARD-0002/ }).count()) === 1);
  check('nothing on the board is draggable',
    (await page.locator('[aria-roledescription="sortable"], [aria-roledescription="draggable"]').count()) === 0);

  console.log('\nA drag moves nothing');
  const target = page.getByRole('region', { name: 'Sourcing' });
  await card.dragTo(target).catch(() => {});
  await page.waitForTimeout(800);
  check('no stage move is sent', moves.length === 0, moves.join(' | '));
  check('the card stays in its stage',
    (await page.getByRole('region', { name: 'Validation' }).getByRole('button', { name: /REQ-BOARD-0001/ }).count()) === 1);

  console.log('\nA card opens the request');
  await page.getByRole('button', { name: /Open REQ-BOARD-0001/ }).click();
  await page.waitForURL(/\/requests\/REQ-BOARD-0001$/, { timeout: 10000 }).catch(() => {});
  check('clicking the card opens its request, where the stage action lives', /\/requests\/REQ-BOARD-0001$/.test(page.url()), page.url());
  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  ran = true;
} catch (error) {
  console.error('workflows board UI smoke errored:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log('');
if (!ran) {
  console.error('FAILED: the suite did not reach its assertions.');
  process.exitCode = 1;
} else if (failures) {
  console.error(`FAILED: ${failures} check(s)`);
  process.exitCode = 1;
} else {
  console.log('All workflows board UI checks passed.');
}
