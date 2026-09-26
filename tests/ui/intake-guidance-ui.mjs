#!/usr/bin/env node
// Browser smoke for the New request page's guidance surfaces — how it says
// where the requester is and what it needs, before anything has loaded.
//
// `tsc -b` proves the page compiles; it cannot prove it renders, or that it
// opens by asking rather than by presenting a form. What this holds:
//
//   * the page opens with one open question, in the requester's own words;
//   * the header names the three phases and marks the current one;
//   * Your request says where each value comes from (the legend) and that the
//     channel waits for the checks;
//   * there is no Next to walk past — the conversation confirms the channel
//     itself — and no field the requester is not asked for.
//
// `test:ui` drives every route through the conversation against the stub.
// This is the narrow, offline-tolerant check, in the same shape as
// test:service-description-ui: domcontentloaded rather than networkidle, and
// network errors ignored.
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
    if (/\/api\/db|Failed to (load resource|fetch)|net::|ERR_TUNNEL/i.test(text)) return;
    pageErrors.push(text);
  });

  // Land on the app root first so the store hydrates, then navigate — the same
  // order the full wizard smoke uses.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('#root *').first().waitFor({ timeout: 20000 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#intake-reply').waitFor({ timeout: 20000 });

  console.log('The page explains itself');
  check('it opens by asking, in the requester\u2019s own words',
    (await page.getByText(/What do you need\? Say it in your own words/).count()) === 1);
  check('and says what happens first — the catalogue and contracts are checked',
    (await page.getByText(/I.ll check the catalogue and existing contracts first, then ask only what is still missing/).count()) === 1);
  const progress = page.getByRole('list', { name: 'Progress' });
  check('the header names the three phases',
    /1 · What you need[\s\S]*2 · How it is bought[\s\S]*3 · What it needs/.test(await progress.innerText()));
  check('and marks the one the requester is in',
    (await progress.locator('[aria-current="step"]').innerText()) === '1 · What you need');
  check('the assistant says what it is doing', (await page.getByText('identifying what you need', { exact: true }).count()) === 1);

  console.log('\nYour request says where everything comes from');
  const panel = page.locator('aside[aria-label="Your request"]');
  check('the legend names the four sources',
    /From you[\s\S]*Derived[\s\S]*Drafted — check it[\s\S]*Still to come/.test(await panel.innerText()));
  check('the channel waits for the checks, and says so',
    /Deciding — the catalogue and contracts are checked first/.test(await panel.innerText()));
  check('it counts what is known against what is needed', /\d+ of \d+ known/.test(await panel.innerText()));

  console.log('\nNothing to walk past, nothing not asked for');
  check('there is no stepper and no Next', (await page.getByRole('button', { name: /^Next$/ }).count()) === 0);
  check('the reply box shows an example, and Send waits for words',
    /e\.g\./.test(await page.locator('#intake-reply').getAttribute('placeholder') ?? '')
    && await page.getByRole('button', { name: /^Send$/ }).isDisabled());
  check('no accepted banner in the markup',
    !(await page.content()).includes('Details pre-filled. Moving to next step'));
  // The business need is captured in the service description, not typed into a
  // justification field.
  check('no business justification field', (await page.getByText(/Business justification/i).count()) === 0);

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
