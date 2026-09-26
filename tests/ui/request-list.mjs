#!/usr/bin/env node
// Following a link into the request list shows the rows the link promised.
//
// The attention band said "1 request is past the stage SLA" and linked to a
// list that showed every request in the system: the list read no parameters,
// so the band, Requests by Stage and the assistant all opened the same
// unfiltered table. This drives the real links from Home and checks the rows
// that come back — not the URL, which was already "right" while it filtered
// nothing.
//
// Also held here: a filtered list says so and can be un-filtered; a misspelt
// parameter is reported; priority is readable without its colour; and the
// status badges are theme tokens, which they were not in any screen.
//
// Run: npm run test:request-list-ui

import { chromium } from 'playwright';
import { installDbStub, FIXTURES } from './db-stub.mjs';
import { devServer } from './dev-server.mjs';

const server = devServer('5207');
const BASE = server.base;
const ADMIN = {
  id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com',
  role: 'admin', department: 'Global Procurement', initials: 'CD',
};
const LAUNCH = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

// Overdue is derived from `sla_deadline` in the mapper; the stored `is_overdue`
// column is never read, so a fixture that sets only that is not late at all.
const PAST = '2026-01-10T09:00:00Z';
const base = FIXTURES.requests[0];
const REQUESTS = [
  { ...base, id: 'REQ-T-MINE-LATE', title: 'Mine and late', status: 'sourcing', owner_id: 'u11', requestor_id: 'u02', sla_deadline: PAST },
  { ...base, id: 'REQ-T-THEIRS-LATE', title: 'Someone else’s and late', status: 'sourcing', owner_id: 'u05', requestor_id: 'u02', sla_deadline: PAST },
  { ...base, id: 'REQ-T-SENT-BACK', title: 'Sent back to me', status: 'referred-back', owner_id: 'u05', requestor_id: 'u11' },
  { ...base, id: 'REQ-T-APPROVAL', title: 'Waiting for approval', status: 'approval', owner_id: 'u05', requestor_id: 'u02', priority: 'urgent' },
];

let failures = 0;
let checks = 0;
let ran = false;
const check = (name, cond, detail = '') => {
  checks += 1;
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
};

let browser;
try {
  await server.start();
  browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await installDbStub(context, { requests: REQUESTS });
  await context.addInitScript((u) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 }));
    localStorage.setItem('dashboard-layout', JSON.stringify({
      state: { layouts: { admin: ['requests-by-stage'] }, quickActions: {} }, version: 1,
    }));
  }, ADMIN);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));

  /** The request ids the list is showing, in order. */
  const listed = async () => {
    await page.locator('table').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(400);
    return page.locator('tbody tr td:first-child').allInnerTexts();
  };
  const home = async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Needs your attention').first().waitFor({ timeout: 20000 });
  };

  console.log('\nThe attention band’s links show the rows they counted');
  await home();
  await page.getByRole('link', { name: /past the stage SLA/ }).click();
  let ids = await listed();
  check('"past the stage SLA" shows my late request', ids.includes('REQ-T-MINE-LATE'), ids.join(', '));
  check('…and not someone else’s late request', !ids.includes('REQ-T-THEIRS-LATE'), ids.join(', '));
  check('…and nothing that is on time', ids.length === 1, ids.join(', '));
  check('the filter is shown as a chip', (await page.getByRole('link', { name: /Remove filter: Past the stage SLA/ }).count()) === 1);
  check('the count says it is a subset', /1 of 4 requests/.test(await page.locator('main').innerText()));

  await page.getByRole('link', { name: /Remove filter/ }).click();
  ids = await listed();
  check('removing the chip brings every request back', ids.length === 4, ids.join(', '));

  await home();
  await page.getByRole('link', { name: /sent back to you/ }).click();
  ids = await listed();
  check('"sent back to you" shows exactly that request', ids.length === 1 && ids[0] === 'REQ-T-SENT-BACK', ids.join(', '));

  console.log('\nRequests by Stage opens that stage');
  await home();
  await page.getByRole('button', { name: /request\(s\) in Approval/ }).click();
  ids = await listed();
  check('clicking Approval lists only the request in approval', ids.length === 1 && ids[0] === 'REQ-T-APPROVAL', ids.join(', '));
  check('the stage picker agrees with the URL', (await page.getByRole('combobox', { name: /^Stage/ }).inputValue()) === 'approval');

  console.log('\nThe list is honest about what it did with the URL');
  await page.goto(`${BASE}/requests?status=aproval`, { waitUntil: 'domcontentloaded' });
  await listed();
  check('a misspelt stage is reported rather than silently ignored',
    /does not recognise: status=aproval/.test(await page.locator('main').innerText()));

  console.log('\nState reads without colour, and in the theme’s colours');
  await page.goto(`${BASE}/requests`, { waitUntil: 'domcontentloaded' });
  await listed();
  const text = await page.locator('main').innerText();
  check('priority is written, not only a dot', text.includes('Urgent'));
  check('a late request says "late"', /\d+d · late/.test(text));
  const badge = await page.evaluate(() => {
    const el = [...document.querySelectorAll('main span')].find((s) => s.textContent.trim() === 'Sourcing');
    return el ? el.className : null;
  });
  check('status badges use theme tokens, not palette classes',
    badge !== null && !/(amber|blue|red|green|gray)-\d/.test(badge) && /accent/.test(badge), badge ?? 'no badge');
  check('an in-progress stage is not coloured as a warning', badge !== null && !/warn/.test(badge), badge ?? '');

  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await context.close();
  ran = true;
} catch (err) {
  console.error('request list UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.stop();
}

console.log('');
if (!ran) {
  console.error('FAILED: the suite did not reach its assertions.');
  process.exitCode = 1;
} else if (failures) {
  console.error(`FAILED: ${failures} check(s)`);
  process.exitCode = 1;
} else {
  console.log(`All ${checks} request list UI checks passed.`);
}
