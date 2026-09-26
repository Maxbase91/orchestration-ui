#!/usr/bin/env node
// Browser smoke for /admin/rules.
//
// The routing-rules editor decides the single most consequential thing the
// front door decides — the buying channel — and had no browser coverage at all.
// It has just been rewritten in two places that `tsc -b` cannot check:
//
//   - a value condition can now reference a governed threshold instead of
//     restating it, so the editor must render the picker and say WHICH
//     threshold, rather than printing the raw `policy:` token at the admin.
//   - the approval-chain select offered nine hard-coded role-path strings that
//     intake looked up as approval_chains ids. It never matched, so the value
//     band silently decided every time. The select is driven by the chains
//     table now, and "let the value band decide" is the default.
//
// Both are the same failure class: a control that looks configured and is not.
// A green build proves neither renders.
//
// Run: npm run test:routing-rules-ui

import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';
import { devServer } from './dev-server.mjs';

const server = devServer('5208');
const BASE = server.base;
const ROUTE = '/admin/rules';

const ADMIN = {
  id: 'u11',
  name: 'Christine Dupont',
  email: 'christine.dupont@company.com',
  role: 'admin',
  department: 'Global Procurement',
  initials: 'CD',
};

const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

let browser;
try {
  await server.start();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext();
  await context.addInitScript((u) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 }));
  }, ADMIN);
  await installDbStub(context);
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/\/api\/db|Failed to (load resource|fetch)|net::|ERR_TUNNEL/i.test(text)) return;
    pageErrors.push(text);
  });

  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Routing Rules Engine').first().waitFor({ timeout: 20000 });
  check('admin reaches the route (not bounced by the role guard)', page.url().endsWith(ROUTE));

  // The stub serves two rules; the list must show them before anything else is
  // meaningful.
  await page.getByText('High-value software').first().waitFor({ timeout: 15000 });
  check('the rules list renders from the table', true);

  await page.getByText('High-value software').first().click();

  // ── The governed-threshold control ───────────────────────────────────────
  // RR-T1's value condition is stored as `policy:budgetApprovalThreshold`.
  const body = await page.locator('body').innerText();
  check('a governed condition never shows the raw token to the admin',
    !body.includes('policy:budgetApprovalThreshold'),
    'the stored token leaked into the UI');
  check('the threshold is named',
    /Budget approval threshold/i.test(body),
    body.slice(0, 200));
  check('the resolved amount is shown beside it',
    /Currently\s+€?\s?100[.,]000/i.test(body) || /€100,000/.test(body),
    'no resolved amount rendered');
  check('the plain-English summary names the threshold, not a bare number',
    /budget approval threshold/i.test(body));

  // ── The approval-chain select ────────────────────────────────────────────
  check('the value band is the default when no chain is named',
    /Let the value band decide/i.test(body));
  check('no role-path string is offered as a chain',
    !/category-manager > finance/.test(body),
    'the nine hard-coded role paths are meant to be gone');

  // A rule that DOES name a chain must show that chain by name, and say it
  // overrides the band — the whole point of making the field real.
  await page.getByText('Compliance escalation').first().click();
  const overrideBody = await page.locator('body').innerText();
  check('a rule naming a chain shows that chain by name',
    /Compliance Escalation/.test(overrideBody),
    overrideBody.slice(0, 200));
  check('the editor says the named chain overrides the value band',
    /overrides the value band/i.test(overrideBody));

  check('no non-network render errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  console.log('');
  if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exitCode = 1; }
  else console.log('All routing-rules admin UI checks passed.');
} catch (err) {
  console.error('routing-rules admin UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.stop();
}
