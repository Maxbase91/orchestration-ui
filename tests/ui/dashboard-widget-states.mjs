#!/usr/bin/env node
// The dashboard says what it could not read, and what is waiting on you.
//
// Five widgets rendered `data ?? []` and branched on `isLoading` alone, so a
// failed read reached the user as "No open purchase orders.", "No contracts
// expiring soon.", "Every supplier is onboarded and screened." — reassurance,
// in place of the one fact that warranted action. The audit counted 24 surfaces
// with that shape; these five are the ones on the screen everybody opens first.
//
// The conversion is to `<AsyncBoundary>`, and the state it adds is the error
// state. That state is only reachable when a read actually fails, which is why
// the stub gained `options.fail` — a `tsc` pass proves the component compiles,
// not that the alert renders.
//
// Both halves matter:
//   · with every table failing, each of the five renders an alert naming what
//     it could not load, and none of them shows its reassuring empty line;
//   · with the tables answering, no alert appears at all — otherwise an
//     always-on error banner would pass the first half.
//
// The attention band is held to the same rule from the other side. It is
// absent when nothing is waiting — but it must never be absent *because* a read
// failed, or silence would mean "checked, nothing found" about a queue nobody
// checked. It also carries the one definition of "an approval that is mine",
// which includes one delegated to you while its approver is out of office; two
// surfaces disagreed about that and the band would have been a third.
//
// Run: npm run test:dashboard-widget-states

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

const BASE = 'http://localhost:5173';
const ADMIN = {
  id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com',
  role: 'admin', department: 'Global Procurement', initials: 'CD',
};
/** The five converted widgets, the relation each reads, and its error heading. */
const WIDGETS = [
  { id: 'expiring-contracts', table: 'contracts_with_derived', heading: 'Contract alerts could not be loaded', empty: 'No contracts in their renewal window.' },
  { id: 'invoice-exceptions', table: 'invoices', heading: 'Invoices could not be loaded', empty: 'No invoice exceptions' },
  { id: 'open-pos', table: 'purchase_orders', heading: 'Purchase orders could not be loaded', empty: 'No open purchase orders.' },
  { id: 'requests-by-stage', table: 'requests_with_derived', heading: 'Requests could not be loaded', empty: 'No requests are in an active stage.' },
  { id: 'supplier-onboarding', table: 'suppliers_with_derived', heading: 'Suppliers could not be loaded', empty: 'Every supplier is onboarded and screened.' },
];
const LAUNCH = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

let failures = 0;
let checks = 0;
/** Set only once both passes have run — see the end. */
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

/**
 * Open the dashboard with exactly these five widgets on it.
 *
 * The layout is per-role and persisted under `dashboard-layout`; no single
 * role's default carries all five, so the suite seeds one rather than asserting
 * against whichever widgets a role happens to ship with today.
 */
async function dashboardText(browser, { fail = [], rows = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1400 } });
  await installDbStub(context, rows, { fail });
  await context.addInitScript(([user, ids]) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: user }, version: 0 }));
    localStorage.setItem('dashboard-layout', JSON.stringify({
      state: { layouts: { admin: ids }, quickActions: {} }, version: 1,
    }));
  }, [ADMIN, WIDGETS.map((w) => w.id)]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Expiring Contracts').first().waitFor({ timeout: 20000 });
  // `retry: 1` on the query client, so a failing read resolves on the second
  // attempt — a shorter wait would sample the loading state and call it a pass.
  await page.waitForTimeout(2500);
  const text = await page.locator('main').innerText();
  const alerts = await page.getByRole('alert').allInnerTexts();
  const band = await page.getByRole('region', { name: 'Needs your attention' }).count();
  await context.close();
  return { text, alerts, errors, band };
}

/** The stub's own approval rows, so a variant changes one field, not the set. */
const APPROVALS = [
  {
    id: 'APR-TEST-1', request_id: 'REQ-TEST-0001', approver_id: 'u11',
    approver_name: 'Christine Dupont', approver_role: 'VP Procurement',
    status: 'pending', requested_at: '2026-09-15T09:00:00Z',
    step_order: 3, assignment_mode: 'role',
  },
];

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH);

  console.log('\nEvery table answers: the widgets render, and nothing claims a failure');
  const healthy = await dashboardText(browser, { fail: [] });
  for (const w of WIDGETS) {
    check(`${w.id} does not report a failure`, !healthy.text.includes(w.heading));
  }
  check('no alert is on the dashboard at all', healthy.alerts.length === 0,
    healthy.alerts.slice(0, 2).join(' | '));
  check('no page errors', healthy.errors.length === 0, healthy.errors.slice(0, 2).join(' | '));

  console.log('\nEvery table fails: each widget says what it could not read');
  const broken = await dashboardText(browser, { fail: WIDGETS.map((w) => w.table) });
  for (const w of WIDGETS) {
    check(`${w.id} reports "${w.heading}"`, broken.text.includes(w.heading),
      broken.text.slice(0, 200).replace(/\n/g, ' / '));
    // The whole point: the reassuring line must not be what a failed read shows.
    check(`${w.id} does not show its empty line instead`, !broken.text.includes(w.empty));
  }
  check('each failure is announced as an alert', broken.alerts.length >= WIDGETS.length,
    `${broken.alerts.length} alerts`);
  // A database message naming columns or constraints must not reach the screen.
  check('no database internals are shown', !/Database request failed/.test(broken.text),
    broken.text.slice(0, 160));
  check('no page errors', broken.errors.length === 0, broken.errors.slice(0, 2).join(' | '));

  console.log('\nThe attention band shows what is waiting on the person reading it');
  check('the pending approval is named', healthy.text.includes('approval is waiting on you'),
    healthy.text.slice(0, 160).replace(/\n/g, ' / '));
  check('the band is a landmark, not a floating row', healthy.band === 1, `${healthy.band} regions`);

  // The reason `isMyApproval` exists: an approval assigned to someone else and
  // delegated here is mine to decide. /approvals counted it, /tasks did not.
  const delegated = await dashboardText(browser, {
    rows: { approval_entries: [{ ...APPROVALS[0], approver_id: 'u05', delegated_to: 'u11' }] },
  });
  check('an approval delegated to you counts as yours',
    delegated.text.includes('approval is waiting on you'),
    delegated.text.slice(0, 160).replace(/\n/g, ' / '));

  // Silence has to mean "checked, nothing found".
  const quiet = await dashboardText(browser, { rows: { approval_entries: [] } });
  check('with nothing waiting the band is absent entirely', quiet.band === 0);
  check('and it does not leave an all-clear card behind',
    !quiet.text.includes('Needs your attention'));

  const unreadable = await dashboardText(browser, { fail: ['approval_entries'] });
  check('an unreadable queue is reported, not passed over as empty',
    unreadable.text.includes('Your queue could not be read'),
    unreadable.text.slice(0, 200).replace(/\n/g, ' / '));

  // The widget lists what the contracts view reads as expiring — the status
  // from the end date against the renewal window (2026-09-26) — not what the
  // record says, and not a 90 of its own.
  console.log('\nThe Expiring Contracts widget reads the live status');
  const iso = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const contractRow = (id, title, status, statusLive, endDate) => ({
    id, title, supplier_id: 'SUP-001', supplier_name: 'Example Supplier', value: 50000,
    start_date: '2025-01-01', end_date: endDate, status, status_live: statusLive,
    utilisation_percentage: 10, linked_request_ids_live: [],
  });
  const contracts = await dashboardText(browser, {
    rows: {
      contracts_with_derived: [
        contractRow('CON-T1', 'Cleaning services agreement', 'active', 'expiring', iso(5)),
        contractRow('CON-T2', 'Printer lease', 'active', 'expired', iso(-3)),
        contractRow('CON-T3', 'Office furniture framework', 'expiring', 'active', iso(200)),
      ],
    },
  });
  check('a contract in its renewal window is listed, with its days left',
    contracts.text.includes('Cleaning services agreement') && contracts.text.includes('5d left'),
    contracts.text.slice(0, 240).replace(/\n/g, ' / '));
  check('one past its end date is not, although it is recorded active',
    !contracts.text.includes('Printer lease'));
  check('one recorded expiring but far from its end is not either',
    !contracts.text.includes('Office furniture framework'));

  ran = true;
} catch (err) {
  console.error('dashboard widget UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log('');
// A harness that never reached its assertions is a failure, not a pass — the
// approvals suite printed "all checks passed" after Chromium failed to launch.
if (!ran) {
  console.error('FAILED: the suite did not reach its assertions.');
  process.exitCode = 1;
} else if (failures) {
  console.error(`FAILED: ${failures} check(s)`);
  process.exitCode = 1;
} else {
  console.log(`All ${checks} dashboard widget UI checks passed.`);
}
