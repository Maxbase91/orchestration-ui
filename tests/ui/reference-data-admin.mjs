#!/usr/bin/env node
// Browser smoke for the cost-centre and delivery-location reference data.
//
// What matters here is the round trip: an administrator maintains the rows, and
// what the requester's pickers offer is exactly those rows. Before this, both
// values were typed in — the cost centre as free text, the delivery location
// against a list on the requester's profile that nothing ever populated.
//
// The REST surface is stubbed, so this never touches real data.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

const PORT = '5187';
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

const server = spawn('npm', ['run', 'dev', '--', '--port', PORT, '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  // The stub's fixtures carry one retired cost centre and one closed location,
  // which is what the "not offered" assertions below turn on.
  await installDbStub(context);
  await context.addInitScript(() => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin' }, version: 0 }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  console.log('\nAn administrator maintains the reference data');

  await page.goto(`${BASE}/admin/cost-centres`, { waitUntil: 'networkidle' });
  await page.getByText('CC-ENG-001').first().waitFor({ timeout: 20000 });
  const centresText = await page.locator('main').innerText();
  check('the cost-centre table lists the stored rows', centresText.includes('CC-ENG-001'));
  check('a retired cost centre is shown as retired, not hidden',
    centresText.includes('Retired centre') && centresText.includes('Retired'));
  // Deliberately no delete: requests store the code, not a foreign key, so a
  // removed row would orphan every record charged to it.
  check('there is no delete control — retiring is the way out',
    (await page.getByRole('button', { name: /delete/i }).count()) === 0);

  await page.getByRole('button', { name: /Add cost centre/ }).click();
  await page.locator('#cc-id').fill('CC-NEW-001');
  await page.locator('#cc-label').fill('New function');
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(1200);
  check('a new cost centre is saved and listed',
    (await page.locator('main').innerText()).includes('CC-NEW-001'));

  await page.goto(`${BASE}/admin/delivery-locations`, { waitUntil: 'networkidle' });
  await page.getByText('Head office').first().waitFor({ timeout: 20000 });
  const locationsText = await page.locator('main').innerText();
  check('the delivery-location table lists the stored rows', locationsText.includes('Head office'));
  check('a closed location is shown as closed, not hidden',
    locationsText.includes('Closed site') && locationsText.includes('Closed'));

  console.log('\nThe requester is offered exactly the active rows');

  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const costCentreTag = await page.locator('#profile-cost-centre')
    .evaluate((el) => el.tagName).catch(() => 'ABSENT');
  check('the profile cost centre is a picker, not a text field',
    costCentreTag !== 'ABSENT' && costCentreTag !== 'INPUT', `element was ${costCentreTag}`);

  // The load-bearing one: an inactive row must not be selectable anywhere. It
  // is the difference between a check that can fail and one that cannot.
  await page.locator('#profile-cost-centre').click();
  await page.waitForTimeout(600);
  const listboxText = await page.locator('[role="listbox"]').innerText().catch(() => '');
  check('the picker offers the active cost centres', /CC-ENG-001/.test(listboxText), listboxText.slice(0, 120));
  check('the picker does NOT offer the retired one', !/Retired centre/.test(listboxText), listboxText.slice(0, 120));

  check('no page errors while maintaining reference data', errors.length === 0, errors.join(' | '));
} catch (error) {
  console.error(`\n  \x1b[31m✗\x1b[0m suite error — ${error.message.split('\n')[0]}`);
  failures++;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log(failures === 0
  ? '\nAll reference-data admin checks passed.'
  : `\n${failures} reference-data admin check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
