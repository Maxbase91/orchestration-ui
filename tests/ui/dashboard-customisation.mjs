#!/usr/bin/env node
// Browser smoke for dashboard customisation: what a role opens on, and whether
// a change to it survives a reload.
//
// Two defects this pins. (1) The purchasing and vendor widgets shipped in the
// registry but in nobody's default layout, so the only way to see a PO waiting
// on a receipt was to open "Add Widget" and know it existed. (2) The layout
// store was not persisted, so adding or removing a widget was undone by the
// next page load — indistinguishable, from the user's seat, from a button that
// does nothing.
//
// The REST surface is stubbed, so this never touches real data.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

const PORT = '5183';
const BASE = `http://localhost:${PORT}`;
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}
async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Dev server not ready');
}

// Enough of a purchasing surface for the new widgets to have something to draw.
const OVERRIDES = {
  purchase_orders: [{
    id: 'PO-1', supplier_id: 'S1', supplier_name: 'Example Supplier', value: 25000,
    status: 'submitted', created_at: '2026-07-01', delivery_date: '2026-08-01', line_items: [],
  }],
  invoices: [{
    id: 'INV-1', supplier_id: 'S1', supplier_name: 'Example Supplier', amount: 12000,
    currency: 'EUR', status: 'disputed', invoice_date: '2026-06-01', due_date: '2026-07-01',
    match_status: 'variance',
  }],
};

const server = spawn('npm', ['run', 'dev', '--', '--port', PORT, '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await installDbStub(context, OVERRIDES);
  await context.addInitScript(() => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'procurement-manager' }, version: 0 }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  console.log('\nThe role opens on a dashboard that covers its work');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const main = page.locator('main');
  await page.getByText('Open Purchase Orders').first().waitFor({ timeout: 20000 });
  const home = await main.innerText();
  check('purchase orders are on the default dashboard', home.includes('Open Purchase Orders'));
  check('invoice exceptions are on the default dashboard', home.includes('Invoice Exceptions'));

  console.log('\nCustomising is a mode, and its controls live only inside it');
  // Out of the mode the dashboard is a thing to read: no grips on the tiles, no
  // remove buttons, and none of the three controls that used to sit permanently
  // in three different places.
  check('no drag handle is on screen at rest',
    (await page.getByRole('button', { name: /^Drag / }).count()) === 0);
  check('no remove button is on screen at rest',
    (await page.getByRole('button', { name: /^Remove / }).count()) === 0);
  check('Add widget is not offered at rest',
    (await page.getByRole('button', { name: /Add widget/i }).count()) === 0);
  check('Reset to default is not offered at rest',
    (await page.getByRole('button', { name: /Reset to default/i }).count()) === 0);
  // dnd-kit's attributes carry role="button" and tabIndex=0 even when sorting is
  // disabled. On the card, every tile was a keyboard stop announced as a button
  // that did nothing. They belong on the handle, which exists only in the mode.
  const fakeButtons = await page.evaluate(() =>
    [...document.querySelectorAll('main [aria-roledescription="sortable"]')].length);
  check('no tile is a sortable button at rest', fakeButtons === 0, `${fakeButtons} found`);

  await page.getByRole('button', { name: /Customise/ }).click();
  await page.getByRole('button', { name: /Add widget/i }).first().waitFor({ timeout: 10000 });
  // Every control the old dashboard had is still reachable — one click further
  // in, not gone. Quick actions used to be what the header's "Customise" button
  // opened, despite its name.
  for (const label of [/Add widget/i, /Quick actions/i, /Reset to default/i]) {
    check(`${label} is offered in customise mode`,
      (await page.getByRole('button', { name: label }).count()) > 0);
  }
  check('tiles gain a drag handle in the mode',
    (await page.getByRole('button', { name: /^Drag / }).count()) > 0);
  check('tiles gain a remove button in the mode',
    (await page.getByRole('button', { name: /^Remove / }).count()) > 0);

  console.log('\nA customisation survives a reload');
  // Add a widget this role does NOT get by default, then reload. Before the
  // store was persisted, `survived` came back false while `added` was true —
  // the change applied and was then silently thrown away.
  await page.getByRole('button', { name: /Add widget/i }).first().click();
  const pickCard = page.locator('div.rounded-md.border, div.border.rounded-md')
    .filter({ hasText: 'Suppliers Blocking Work' }).first();
  await pickCard.getByRole('button', { name: /^Add$/ }).click();
  await page.keyboard.press('Escape');
  await page.getByText('Suppliers Blocking Work').first().waitFor({ timeout: 10000 });
  const added = (await main.innerText()).includes('Suppliers Blocking Work');
  check('the added widget appears immediately', added);

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Open Purchase Orders').first().waitFor({ timeout: 20000 });
  // A reload leaves customise mode — it is view state, not a saved preference.
  check('the dashboard comes back out of customise mode',
    (await page.getByRole('button', { name: /^Drag / }).count()) === 0);
  check('the added widget is still there after a reload',
    (await main.innerText()).includes('Suppliers Blocking Work'));

  // And the removal direction, which is the one users notice: a widget they
  // took off the dashboard must not come back.
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('dashboard-layout'));
    stored.state.layouts['procurement-manager'] =
      stored.state.layouts['procurement-manager'].filter((id) => id !== 'open-pos');
    localStorage.setItem('dashboard-layout', JSON.stringify(stored));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Suppliers Blocking Work').first().waitFor({ timeout: 20000 });
  check('a removed widget stays removed after a reload',
    !(await main.innerText()).includes('Open Purchase Orders'));

  check('the dashboard raised no page errors', errors.length === 0, errors.join(' | '));
} catch (error) {
  console.error(`\n  \x1b[31m✗\x1b[0m suite error — ${error.message}`);
  failures++;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log(failures === 0
  ? '\nAll dashboard customisation checks passed.'
  : `\n${failures} dashboard customisation check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
