#!/usr/bin/env node
// Browser check for the request detail, run against fixtures rather than a live
// Supabase project.
//
// This is the check that was missing. A service description is stored with ten
// text columns AND a quality score, two arrays and two objects; a call site
// walked the whole record as if every value were a string and threw
// "trim is not a function" the moment a workflow step with a pre-populated form
// rendered — on every one of the twelve descriptions in the live project. No
// suite caught it: `tsc` accepted the cast that caused it, the integration
// suites do not render, and every browser suite needed a database this sandbox
// cannot reach.
//
// So the database is stubbed (tests/ui/db-stub.mjs) and the real screen
// is driven: open the request, expand every workflow step, open the form that
// pre-populates from the description, and assert both that nothing threw and
// that the pre-populated values actually arrived.
//
// Run: npm run test:request-detail-ui   (no credentials, no network)

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

const BASE = 'http://localhost:5178';
const REQUEST_ID = 'REQ-TEST-0001';
const ADMIN = {
  id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com',
  role: 'admin', department: 'Global Procurement', initials: 'CD',
};

const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Dev server not ready');
}

// No credentials: the client posts to /api/db, which the stub intercepts before
// it leaves the page. That is the point — this suite runs where no database is
// reachable, against the same client production runs.
const server = spawn('npm', ['run', 'dev', '--', '--port', '5178', '--strictPort'], { stdio: 'ignore' });

let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext();
  const stub = await installDbStub(context);
  await context.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: user }, version: 0 }));
  }, ADMIN);

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  console.log('\nThe request detail renders and its workflow steps open');
  await page.goto(`${BASE}/requests/${REQUEST_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  // A throw during render leaves #root empty. Report that as a white screen with
  // the error attached rather than as a locator timeout, which says nothing
  // about what went wrong — this is exactly how the regression presented.
  const rendered = await page.locator('#root *').first()
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('the page renders (no white screen)', rendered, pageErrors[0]?.slice(0, 160));
  if (!rendered) throw new Error('white screen — nothing else can be asserted');
  check('the request loads from the stub',
    await page.getByText('supplier consolidation programme').first().isVisible().catch(() => false));

  await page.getByRole('tab', { name: 'Workflow' }).click();
  await page.waitForTimeout(600);

  // The crash happened on *render* of the step cards, not on a click: the
  // current stage's card is expanded by default, so simply landing on this tab
  // was enough to take the page down.
  const column = page.locator('div.lg\\:col-span-2').first();
  const stepHeaders = column.locator('button.w-full.text-left');
  const stepCount = await stepHeaders.count();
  check('the workflow tab renders step cards', stepCount > 0, `found ${stepCount}`);
  check('the current stage opens with the description summary',
    await column.getByText('An advisory engagement').first().isVisible().catch(() => false));

  console.log('\nThe risk form pre-populates from the description');
  const fillOutButtons = column.getByRole('button', { name: 'Fill Out Form' });
  const fillOutCount = await fillOutButtons.count();
  // Regression for forStage() never checking template status: the fixture
  // also seeds a `draft` form on the same stage (FT-RISK-2-DRAFT) \u2014 it must
  // never be offered, so exactly one "Fill Out Form" button should exist.
  check('only the active form is offered (draft form excluded)', fillOutCount === 1, `found ${fillOutCount}`);
  const fillOut = fillOutButtons.first();
  const hasForm = await fillOut.isVisible().catch(() => false);
  check('the risk stage offers its triggered form', hasForm);
  if (hasForm) {
    await fillOut.click();
    await page.waitForTimeout(400);
    const scope = page.getByLabel(/Scope of the engagement/i).first();
    const value = await scope.inputValue().catch(() => '');
    // Not merely "no crash": the mapped field must actually carry the section,
    // which is what `sowPrePopulateValues` is for. A stub that returned nothing
    // would satisfy a crash-only assertion.
    check('the mapped field carries the description\u2019s scope',
      value.includes('Spend analysis'), value.slice(0, 60) || '(empty)');

    console.log('\nSubmitting the form actually persists it, not just a toast');
    const before = stub.tables.form_submissions.length;
    await column.getByRole('button', { name: 'Submit', exact: true }).click();
    await page.waitForTimeout(500);
    const after = stub.tables.form_submissions;
    check('a real form_submissions row was created', after.length === before + 1, `${before} -> ${after.length}`);
    const created = after[after.length - 1];
    check('the submission carries the request/stage/template it was filled out on',
      created?.request_id === REQUEST_ID && created?.stage === 'risk' && created?.form_template_id === 'FT-RISK-1',
      JSON.stringify({ requestId: created?.request_id, stage: created?.stage, template: created?.form_template_id }));
    // The bug: onSubmit dropped DynamicForm's `values` argument entirely, so
    // nothing typed was ever saved. Assert the actual field values landed.
    // (field_values is the DB column name — mapFormSubmissionToDb maps
    // FormSubmission.values -> field_values.)
    check('the typed/pre-populated field values were actually saved (not discarded)',
      typeof created?.field_values?.f1 === 'string' && created.field_values.f1.includes('Spend analysis'),
      JSON.stringify(created?.field_values).slice(0, 120));
    check('the form disappears once really submitted (not re-offered)',
      (await column.getByRole('button', { name: 'Fill Out Form' }).count()) === 0);
  }

  console.log('\nEvery step card collapses and reopens');
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < stepCount; i++) {
      await stepHeaders.nth(i).click();
      await page.waitForTimeout(120);
    }
  }
  check('toggling every step throws nothing', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  // Named explicitly: this is the reported message, and a generic "no errors"
  // check would not say which regression came back.
  check('no \"trim is not a function\"',
    !pageErrors.some((m) => /trim is not a function/.test(m)),
    pageErrors.find((m) => /trim is not a function/.test(m)));

  console.log('\nThe stub answered every query it was given');
  check('no filter was silently dropped', stub.unsupported.length === 0,
    [...new Set(stub.unsupported)].slice(0, 5).join(', '));

  if (pageErrors.length) {
    console.log('\n── uncaught page errors ──');
    for (const m of pageErrors.slice(0, 5)) console.log(`  ${m.slice(0, 200)}`);
  }
  await context.close();
} catch (e) {
  console.error(`request-detail-ui errored: ${e.message}`);
  failures++;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All request-detail browser checks passed.');
process.exit(failures === 0 ? 0 : 1);
