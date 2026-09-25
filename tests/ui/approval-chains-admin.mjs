#!/usr/bin/env node
// Browser smoke for /admin/approvals.
//
// The value band was a free-text string parsed by regex, and a string with no
// number in it parsed as [0, ∞) — so an unbanded chain matched every value and
// shadowed every banded one behind it. Reachable two ways without typing
// anything odd: the column defaults to '' and this page created new chains at
// 'TBD'.
//
// The band is structured bounds now, each optionally following a governed
// threshold, and the page reports gaps and overlaps. `tsc -b` proves none of
// that renders; this does.
//
// Run: npm run test:approval-chains-ui

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

const BASE = 'http://localhost:5173';
const ROUTE = '/admin/approvals';
const ADMIN = {
  id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com',
  role: 'admin', department: 'Global Procurement', initials: 'CD',
};
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

const chain = (id, name, minValue, maxValue, threshold) => ({
  id, name, description: name, threshold, min_value: minValue, max_value: maxValue,
  steps: [{ id: `${id}-s1`, role: 'Category Manager' }], referenced_by: [],
});

/** A coherent ladder: no gap, no overlap, two bounds following policy. */
const COHERENT = [
  chain('chain-2', 'Fast-Track', null, '10000', 'Below €10,000'),
  chain('chain-1', 'Standard', '10000', 'policy:budgetApprovalThreshold', '€10,000 – €100,000'),
  chain('chain-3', 'VP-Level', 'policy:budgetApprovalThreshold', 'policy:delegatedAuthorityThreshold', '€100,000 – €500,000'),
  chain('chain-4', 'Board-Level', 'policy:delegatedAuthorityThreshold', null, 'Above €500,000'),
  { ...chain('chain-compliance', 'Compliance Escalation', null, null, 'By routing rule only'), steps: [{ id: 'cs1', role: 'Supplier Manager' }, { id: 'cs2', role: 'Legal' }] },
];

/** The same ladder with the middle removed, so €10k–€100k has no approver. */
const GAPPED = COHERENT.filter((c) => c.id !== 'chain-1');

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
};

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not become ready at ${BASE}`);
}

async function openPage(browser, chains) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 960 } });
  await context.addInitScript((u) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 }));
  }, ADMIN);
  // The roles the chains name, configured — minus 'Legal', so the page has an
  // unconfigured role to flag. RR-T is the one rule that names a chain.
  const { functionalRoles } = await import('../../src/data/functional-roles.ts');
  await installDbStub(context, {
    approval_chains: chains,
    functional_roles: functionalRoles.filter((r) => r.name !== 'Legal').map((r) => ({ name: r.name, acts_as: r.actsAs, description: r.description, sort_order: r.sortOrder })),
    routing_rules: [{ id: 'RR-T', name: 'High-risk supplier', status: 'active', priority: 100, category: 'Risk', conditions: [{ field: 'supplierRiskRating', operator: 'risk_rating', value: 'high' }], action: { buyingChannel: 'procurement-led', approvalChain: 'chain-compliance' }, description: '', last_modified: '2026-09-25' }],
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/\/api\/db|Failed to (load resource|fetch)|net::|ERR_TUNNEL/i.test(t)) return;
    errors.push(t);
  });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Approval Chains').first().waitFor({ timeout: 20000 });
  return { page, errors };
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);

  // ── A coherent ladder ────────────────────────────────────────────────────
  const { page, errors } = await openPage(browser, COHERENT);
  await page.getByText('VP-Level').first().waitFor({ timeout: 15000 });
  let body = await page.locator('body').innerText();

  check('a coherent ladder raises no warning', !/do not cover every request/.test(body));
  check('a banded chain shows its band as amounts', /€100,000 – €500,000/.test(body), body.slice(0, 200));
  check('an unbanded chain says it is reachable by rule only', /By routing rule only/.test(body));
  check('the hardcoded "EUR" prefix is gone', !/EUR (Below|Above|By routing)/.test(body));

  // ── The band editor ──────────────────────────────────────────────────────
  await page.getByText('VP-Level').first().click();
  const pencil = page.locator('button:has(svg.lucide-pencil)');
  await pencil.first().click();
  await page.getByText('Value band').first().waitFor({ timeout: 10000 });
  body = await page.locator('body').innerText();

  check('the band editor replaces the free-text threshold input', /Value band/.test(body));
  check('a governed bound is offered by name', /Budget approval threshold/i.test(body));
  check('the editor says which thresholds the band follows',
    /Follows .*budget approval threshold.* and .*delegated authority threshold/i.test(body),
    body.slice(body.indexOf('Value band'), body.indexOf('Value band') + 300));
  check('no raw policy token is shown to the admin', !/policy:budgetApprovalThreshold/.test(body));
  check('a step role is picked from the configured roles, not typed',
    (await page.getByLabel('Step 1 role').evaluate((el) => el.tagName)) === 'SELECT');

  // ── Roles ────────────────────────────────────────────────────────────────
  const rolesTable = page.getByRole('table', { name: 'Functional roles' });
  await rolesTable.waitFor({ timeout: 10000 });
  check('the Roles table lists what acts as each role',
    (await page.getByLabel('Finance acts as').inputValue()) === 'procurement-manager'
    && (await page.getByLabel('Budget Owner acts as').inputValue()) === 'procurement-manager');
  check('a role a chain names but nobody configured is flagged', /Named but not configured[^.]*Legal/.test(await page.locator('body').innerText()));
  check('a role in use cannot be deleted', await page.getByLabel('Delete Supplier Manager', { exact: true }).isDisabled());
  check('an unused role can be', await page.getByLabel('Delete Finance Approver', { exact: true }).isEnabled());
  check('the chain a rule names shows that rule, read from the rules',
    await page.getByText('Compliance Escalation').first().click().then(async () => /RR-T High-risk supplier/.test(await page.locator('body').innerText())));
  check('no non-network render errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  // ── A gap is reported ────────────────────────────────────────────────────
  const gapped = await openPage(browser, GAPPED);
  await gapped.page.getByText('Fast-Track').first().waitFor({ timeout: 15000 });
  const gapBody = await gapped.page.locator('body').innerText();
  check('a gap between bands is reported', /do not cover every request/.test(gapBody));
  check('the gap names the values nobody would approve',
    /between €10,000 and €100,000/.test(gapBody),
    gapBody.slice(0, 300));
  check('the warning explains why a gap matters',
    /nobody able to approve/.test(gapBody));

  console.log('');
  if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exitCode = 1; }
  else console.log('All approval-chains admin UI checks passed.');
} catch (err) {
  console.error('approval-chains admin UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
