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
  // The policy singleton has its own endpoint, not /api/db. Served from the
  // shipped defaults; a save is captured so its payload can be checked.
  const { DEFAULT_POLICY_CONFIG } = await import('../../src/lib/procurement/policy-config.ts');
  let savedPolicy = null;
  await context.route('**/api/policy-config', async (route) => {
    const body = route.request().method() === 'POST' ? JSON.parse(route.request().postData() || '{}') : null;
    if (body?.config) savedPolicy = body.config;
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ config: savedPolicy ?? DEFAULT_POLICY_CONFIG, updatedBy: null, updatedAt: null }) });
  });
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
  // removed row would orphan every record charged to it. Retiring is already
  // the way out, it is visible in the table above, and it keeps the history.
  //
  // This matched on the ACCESSIBLE NAME, so an icon-only trash button — which
  // is exactly how every other table on this platform renders delete — sailed
  // past it. A guard against a control appearing must not depend on how that
  // control happens to be labelled. Checked against the markup instead.
  const costCentreMarkup = await page.locator('main').innerHTML();
  check('there is no delete control — retiring is the way out',
    (await page.getByRole('button', { name: /delete/i }).count()) === 0
    && !/lucide-trash/i.test(costCentreMarkup));

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

  // ── Integration health ────────────────────────────────────────────────────
  // The page this replaces showed four green "Connected" cards, 99.97% uptime
  // and a five-row invented error log. The fixtures behind this screen include
  // a timed-out handover on purpose: the old page would have shown that system
  // green, which is the failure worth guarding.
  console.log('\nIntegration health reports what happened');

  await page.goto(`${BASE}/admin/health`, { waitUntil: 'networkidle' });
  await page.getByText('Integration Health').first().waitFor({ timeout: 20000 });
  const healthText = await page.locator('main').innerText();
  check('a timed-out handover makes its system read as failing',
    /Handovers failing/.test(healthText), healthText.slice(0, 400));
  check('a system awaiting a response reads as waiting',
    /Awaiting response/.test(healthText));
  check('a system with no handovers is shown as unused, not healthy',
    /No handovers yet/.test(healthText));
  check('the failed handover is listed with its own detail',
    /No response within the agreed window/.test(healthText));
  check('no invented uptime figure',
    !/99\.9|0\.02%|Active Sessions/.test(healthText), healthText.slice(0, 300));
  check('it states that there are no live connections',
    /no live upstream connections/i.test(healthText));

  // ── Category managers ─────────────────────────────────────────────────────
  // Who owns demand in a category was read by two things — approver derivation
  // and the validation stage gate — and writable by nobody: the only source was
  // a seed backfill, so a wrong assignment could not be corrected. A category
  // with none is not cosmetic: nobody but an admin can then move its requests
  // out of validation.
  console.log('\nAn administrator maintains the category managers');

  await page.goto(`${BASE}/admin/categories`, { waitUntil: 'networkidle' });
  await page.getByText('Consulting').first().waitFor({ timeout: 20000 });
  const categoriesText = await page.locator('main').innerText();
  check('a category with several managers names them all',
    /Christine Dupont/.test(categoriesText) && /Sarah Chen/.test(categoriesText), categoriesText.slice(0, 200));
  check('a category with no manager is flagged',
    /No manager/.test(categoriesText), categoriesText.slice(0, 200));

  // Assign a manager to the category that has none.
  await page.getByRole('button', { name: /No manager/ }).first().click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });
  const dialogText = await page.getByRole('dialog').innerText();
  check('the dialog explains what a manager does',
    /out of validation/i.test(dialogText), dialogText.slice(0, 160));
  // By name, not by the word "supplier" — the directory has a "Supplier
  // Management" department, so matching the word passes on a page that offers
  // every supplier. u13 is the external supplier user in the fixtures.
  check('the dialog does not offer the external supplier user',
    !/David Schneider/.test(dialogText), dialogText.slice(0, 200));
  check('the dialog does offer internal users',
    /Sarah Chen/.test(dialogText), dialogText.slice(0, 200));

  await page.getByRole('dialog').getByText('Sarah Chen').click();
  await page.getByRole('button', { name: 'Save managers' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(500);
  const afterAssign = await page.locator('main').innerText();
  const noManagerCount = (afterAssign.match(/No manager/g) ?? []).length;
  check('assigning a manager clears the warning', noManagerCount === 0,
    `${noManagerCount} still flagged`);

  // ── Commodity codes ───────────────────────────────────────────────────────
  // Two tables in code until now; each category carries its own list and its
  // default. What is saved here is what the next demand is coded as.
  console.log('\nAn administrator maintains the commodity codes');
  const codesText = await page.locator('main').innerText();
  check('a category shows its default code and keyword codes',
    /31160000\s*\+ 1 keyword code/.test(codesText), codesText.slice(0, 300));
  check('a category with no codes is flagged', /No codes/.test(codesText));

  await page.getByRole('button', { name: /80101600/ }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });
  check('the dialog shows the default code',
    (await page.getByLabel('Default code', { exact: true }).inputValue()) === '80101600');
  await page.getByRole('button', { name: 'Add code' }).click();
  await page.getByLabel('Code 1', { exact: true }).fill('84111500');
  await page.getByLabel('Label 1', { exact: true }).fill('Tax advisory services');
  // A code with no keywords can never match — refused, not saved.
  await page.getByRole('button', { name: 'Save commodity codes' }).click();
  await page.getByText('Code 84111500 needs at least one keyword').waitFor({ timeout: 5000 }).catch(() => {});
  check('a code without keywords is refused',
    await page.getByRole('dialog').isVisible() && (await page.getByText('Code 84111500 needs at least one keyword').count()) > 0);
  await page.getByLabel('Keywords 1', { exact: true }).fill('tax, transfer pricing');
  await page.getByRole('button', { name: 'Save commodity codes' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(500);
  check('the saved code shows on the category',
    /80101600\s*\+ 1 keyword code/.test(await page.locator('main').innerText()));

  // Editing the category itself must not erase them — the main dialog saves
  // the same row, and it used to write only the fields it showed.
  await page.getByRole('row', { name: /Consulting/ }).getByRole('button').filter({ has: page.locator('svg.lucide-pencil') }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(500);
  check('saving the category keeps its commodity codes',
    /80101600\s*\+ 1 keyword code/.test(await page.locator('main').innerText()));

  // ── Category-list thresholds ──────────────────────────────────────────────
  // Were ids typed into text boxes (a typo saved cleanly and matched nothing),
  // and the competitive-sourcing exemptions were a literal in code.
  console.log('\nCategory-list thresholds are checklists of the configured categories');
  await page.goto(`${BASE}/admin/thresholds`, { waitUntil: 'networkidle' });
  await page.getByText('Competitive sourcing', { exact: true }).waitFor({ timeout: 20000 });
  check('the exempt categories are a checklist of configured categories',
    (await page.getByLabel('Exempt from competitive quotes: Consulting', { exact: true }).count()) === 1);
  // The shipped default names contingent-labour, which this store has no row
  // for: it is shown and flagged rather than silently kept.
  check('a stored id that names no category is shown and flagged',
    (await page.getByText('contingent-labour').count()) > 0 && (await page.getByText('(no such category)').count()) > 0);
  check('the P-card lists are checklists too',
    (await page.getByLabel('P-card eligible categories: Goods', { exact: true }).isChecked())
    && (await page.getByLabel('Never on a P-card: Consulting', { exact: true }).isChecked()));
  await page.getByLabel('Exempt from competitive quotes: Consulting', { exact: true }).click();
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(800);
  check('saving sends the edited exemptions',
    JSON.stringify(savedPolicy?.competitiveSourcingExemptCategories?.slice().sort()) === JSON.stringify(['consulting', 'contingent-labour']),
    JSON.stringify(savedPolicy?.competitiveSourcingExemptCategories));

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
