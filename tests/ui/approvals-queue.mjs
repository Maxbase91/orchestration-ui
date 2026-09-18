#!/usr/bin/env node
// The approvals queue says what it is approving, for how much, and whose it is.
//
// This screen had no browser suite, which is how it carried a fabricated "AI
// Summary" for four hardcoded request ids — prose asserting facts in no record
// ("CEO-sponsored transformation programme targeting €20M cost reduction") to
// an approver deciding on €1.85M. A static scan would not have found it; it
// rendered perfectly.
//
// What it checks now:
//   · nothing on the card claims to be AI, and none of the invented figures
//     survive anywhere;
//   · the amount is present and prominent — it was a small span among the
//     badges, on the screen whose whole purpose is approving an amount;
//   · the row you can act on is visually distinguishable from one you cannot,
//     which is the POC's `data-mine` row and the reason the layout changed;
//   · every control the old card had is still reachable — four actions, bulk
//     select, and both links to the request.
//
// Run: npm run test:approvals-ui

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

const BASE = 'http://localhost:5173';
const ADMIN = {
  id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com',
  role: 'admin', department: 'Global Procurement', initials: 'CD',
};
const LAUNCH = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

let failures = 0;
let checks = 0;
/** Set only once the assertions have actually been reached — see the end. */
let ran = false;
const check = (name, cond, detail = '') => {
  checks += 1;
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
};

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev server not ready at ${BASE}`);
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await installDbStub(context);
  await context.addInitScript((u) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 }));
  }, ADMIN);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));

  await page.goto(`${BASE}/approvals`, { waitUntil: 'domcontentloaded' });
  await page.getByText('My Approvals').first().waitFor({ timeout: 20000 });
  await page.getByRole('tab', { name: /^All/ }).click();
  await page.waitForTimeout(1200);
  const text = await page.locator('main').innerText();

  console.log('\nNothing on the card is invented');
  check('no panel claims to be an AI summary', !/AI Summary/i.test(text), text.slice(0, 160));
  // The four fabricated summaries, by their most distinctive claims.
  for (const invented of ['CEO-sponsored', '€20M cost reduction', '45% reduction in unplanned downtime', 'ROI projection']) {
    check(`"${invented}" does not appear`, !text.includes(invented));
  }

  console.log('\nThe amount is present and leads the row');
  check('the value is rendered', /€240,000/.test(text), text.slice(0, 200));
  // Prominence is a size, not a hope: the amount must be set larger than the
  // metadata beside it, or it is the small badge-row span it used to be.
  const sizes = await page.evaluate(() => {
    const amount = [...document.querySelectorAll('span')].find((el) => /^€[\d,]+$/.test(el.textContent.trim()));
    const meta = [...document.querySelectorAll('span')].find((el) => el.textContent.trim().startsWith('Cost centre'));
    const px = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
    return { amount: px(amount), meta: px(meta) };
  });
  check('the amount is set larger than the metadata',
    sizes.amount !== null && sizes.meta !== null && sizes.amount > sizes.meta,
    `amount ${sizes.amount}px vs meta ${sizes.meta}px`);

  console.log('\nThe row you can act on looks different from one you cannot');
  const mine = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-mine]')];
    const bg = (el) => getComputedStyle(el).backgroundColor;
    const yours = rows.find((r) => r.dataset.mine === 'true');
    const theirs = rows.find((r) => r.dataset.mine === 'false');
    return { count: rows.length, yours: yours && bg(yours), theirs: theirs && bg(theirs) };
  });
  check('both a pending and a resolved row render', mine.count >= 2, `${mine.count} rows`);
  check('they do not share a background', mine.yours !== mine.theirs,
    `${mine.yours} vs ${mine.theirs}`);

  console.log('\nEvery control the old card had is still here');
  for (const label of ['Approve', 'Reject', 'Request Info', 'Delegate']) {
    check(`${label} is reachable`, (await page.getByRole('button', { name: label }).count()) > 0);
  }
  check('bulk select is still offered', (await page.getByRole('checkbox').count()) > 0);
  check('the request is still linked', (await page.locator('a[href*="/requests/REQ-TEST-0001"]').count()) > 0);
  // Every field the key-data grid carried, now on one line.
  for (const field of ['Category', 'Cost centre', 'Budget owner', 'Channel', 'Needed by']) {
    check(`${field} is still shown`, text.includes(field));
  }
  check('an empty field reads as an em dash, not a bare label',
    !/Cost centre:\s*$/m.test(text) && text.includes('—'));

  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await context.close();
  ran = true;
} catch (err) {
  console.error('approvals queue UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log('');
// `ran` matters as much as `failures`. On the first CI run this suite printed
// "All approvals queue UI checks passed" AFTER Chromium failed to launch —
// zero checks executed, reported as a pass, which is precisely the
// "a check that did not run recorded as clear" failure the platform refuses.
// A harness that never got to the assertions is a failure, not a pass.
if (!ran) {
  console.error('FAILED: the suite did not reach its assertions.');
  process.exitCode = 1;
} else if (failures) {
  console.error(`FAILED: ${failures} check(s)`);
  process.exitCode = 1;
} else {
  console.log(`All ${checks} approvals queue UI checks passed.`);
}
