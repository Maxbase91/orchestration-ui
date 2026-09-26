#!/usr/bin/env node
// Browser check for the request detail, run against fixtures rather than a live
// database.
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
  // The attached template says what the requester does at each stage — the
  // same field the Channel page showed before they submitted.
  const attached = page.locator('table').filter({ hasText: 'What the requester does' });
  check('the attached template says what the requester does at a stage',
    (await attached.locator('tr', { hasText: 'Intake' }).getByText('Describe what you need and submit it.').count()) === 1);
  check('and says nothing where they do nothing',
    (await attached.locator('tr', { hasText: 'Validation' }).getByText('—').count()) === 1);

  console.log('\nThe risk form pre-populates from the description');
  const fillOutButtons = column.getByRole('button', { name: 'Fill Out Form' });
  const fillOutCount = await fillOutButtons.count();
  // Two forms on this stage must NOT be offered: FT-RISK-2-DRAFT (regression
  // for forStage() never checking template status) and
  // FT-RISK-3-SOFTWARE-ONLY, whose condition excludes this consulting demand.
  // So exactly one "Fill Out Form" button should exist.
  check('only the active, applicable form is offered', fillOutCount === 1, `found ${fillOutCount}`);
  const bodyText = await page.locator('body').innerText();
  check('a form whose conditions exclude this request is not offered',
    !/Software licensing addendum/.test(bodyText),
    'FT-RISK-3-SOFTWARE-ONLY is software-only and this demand is consulting');
  // The blocking gate is NOT asserted here: this context runs as admin, which
  // is deliberately exempt from it, so any assertion about the gate would pass
  // whether or not the bug existed. It is exercised as vendor-manager below —
  // the role that actually advances the risk stage.
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

  // ── The blocking gate, as the role it applies to ─────────────────────────
  // FT-RISK-3-SOFTWARE-ONLY is active, blocking, on this stage, and its
  // condition excludes this consulting demand. The gate used to filter on
  // status/blocking/stage without ever evaluating conditions, so it held the
  // stage shut for a request the form never applied to — and since the form
  // never rendered, there was no way to satisfy it. A dead end with no message.
  console.log('\nA form that does not apply does not hold the stage shut');
  const gateContext = await browser.newContext();
  await installDbStub(gateContext);
  await gateContext.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'vendor-manager', currentUser: user }, version: 0 }));
  }, { ...ADMIN, id: 'u7', name: 'Vendor Manager', role: 'vendor-manager', initials: 'VM' });
  const gatePage = await gateContext.newPage();
  await gatePage.goto(`${BASE}/requests/REQ-TEST-0001`, { waitUntil: 'domcontentloaded' });
  await gatePage.getByText('Advisory support for a supplier consolidation programme').first()
    .waitFor({ timeout: 20000 });
  await gatePage.waitForTimeout(800);
  const gateBody = await gatePage.locator('body').innerText();
  check('vendor-manager sees the stage action for the risk stage',
    /Record risk decision/i.test(gateBody),
    'without the action rendering, the gate assertion below proves nothing');
  check('a conditional blocking form does not hold a stage it does not apply to',
    !/Software licensing addendum/.test(gateBody),
    gateBody.slice(0, 300));
  await gateContext.close();

  // ── The redesigned header, stepper and overview ─────────────────────────
  console.log('\nOne next step, the rest in a menu, and nothing claimed that is not true');
  const viewContext = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  await installDbStub(viewContext);
  await viewContext.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: user }, version: 0 }));
  }, ADMIN);
  const view = await viewContext.newPage();
  await view.goto(`${BASE}/requests/${REQUEST_ID}`, { waitUntil: 'domcontentloaded' });
  await view.getByText('Advisory support for a supplier consolidation programme').first().waitFor({ timeout: 20000 });
  await view.waitForTimeout(1000);

  // Seven buttons across two rows, three of them solid, became one filled
  // button for the stage's next step. "Filled" is read from the computed
  // background, not a class name, so a restyle cannot pass by renaming.
  const header = view.locator('main').locator('div').filter({ has: view.getByRole('button', { name: 'More actions' }) }).first();
  const filled = await header.evaluate((root) =>
    [...root.querySelectorAll('button')].filter((b) => {
      const bg = getComputedStyle(b).backgroundColor;
      return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && !/rgb\(2[45]\d, 2[45]\d, 2[45]\d\)/.test(bg);
    }).map((b) => b.textContent.trim()));
  check('exactly one filled action in the header', filled.length === 1, filled.join(' | '));
  check('it is the stage’s next step', /Record risk decision/.test(filled[0] ?? ''), filled.join(' | '));

  await view.getByRole('button', { name: 'More actions' }).click();
  for (const item of ['Refer back', 'Reassign', 'Escalate', 'Cancel request']) {
    check(`"${item}" is still reachable, in More`, (await view.getByRole('menuitem', { name: item }).count()) === 1);
  }
  await view.keyboard.press('Escape');

  const body = await view.locator('main').innerText();
  // The panel was a sentence template in lib/mock-ai.ts labelled as a model's.
  check('nothing on the overview claims to be AI-generated', !/AI-generated/i.test(body));
  // It read `quality_score` from a camel-cased record and never rendered once.
  check('the service description’s quality score renders', /Quality 82\/100/.test(body));
  // The supplier was a dash here. It is an attribute of the request, and
  // "currently unknown" is a real state — with the category's preferred
  // suppliers beside it, since they are who sourcing will ask.
  check('the supplier is shown as currently unknown, not a dash', /Supplier\s*Currently unknown/.test(body), body.slice(0, 200));
  check('the category\u2019s preferred suppliers are listed beside it',
    /Preferred suppliers for this category\s*Advisory Partner A/.test(body));
  check('the breadcrumb shows the id as stored, not title-cased',
    (await view.locator('header, nav').filter({ hasText: REQUEST_ID }).count()) > 0);

  // cn() dropped the role sizes whenever a colour followed them, so the stage
  // names rendered at the inherited 17px. Measured, not assumed.
  const stageSize = await view.getByRole('button', { name: /^Intake:/ }).evaluate((b) =>
    parseFloat(getComputedStyle(b.querySelector('span:nth-child(2)')).fontSize));
  check('stage names are set in the type scale (≤ 13px), not inherited', stageSize <= 13, `${stageSize}px`);
  check('the current stage says so to a screen reader',
    (await view.getByRole('button', { name: /Risk Assessment: current stage/ }).count()) === 1);

  // Refer back offers the rework stages this request's channel ran before where
  // it is — at Risk Assessment, Intake and Validation (2026-09-26). It offered
  // the same five stages whatever the channel, later ones included, and the
  // server moved the request wherever the dialog said.
  await view.getByRole('button', { name: 'More actions' }).click();
  await view.getByRole('menuitem', { name: 'Refer back' }).click();
  const referDialog = view.getByRole('dialog');
  await referDialog.getByRole('combobox').filter({ hasText: 'Select stage' }).click();
  const offered = await view.getByRole('option').allInnerTexts();
  check('Refer back offers only the earlier stages of the request’s channel',
    JSON.stringify(offered.map((o) => o.trim())) === JSON.stringify(['Intake', 'Validation']), offered.join(' | '));
  await view.keyboard.press('Escape');
  await view.keyboard.press('Escape');
  await referDialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});

  // Cancel goes to the server, with the reason (2026-09-26). It used to hand
  // 'cancelled' to the workflow engine, which moved the request on to its next
  // stage — or did nothing — while the page said it was cancelled.
  const posted = [];
  await viewContext.route('**/api/workflow-action', async (route) => {
    posted.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await view.getByRole('button', { name: 'More actions' }).click();
  await view.getByRole('menuitem', { name: 'Cancel request' }).click();
  const cancelDialog = view.getByRole('dialog');
  const cancelButton = cancelDialog.getByRole('button', { name: 'Cancel request' });
  check('Cancel waits for a reason', await cancelButton.isDisabled());
  check('it says what cancelling does to the approvals waiting',
    /approvals still waiting are withdrawn/.test(await cancelDialog.innerText()));
  await cancelDialog.getByLabel('Why is it being cancelled?').fill('Covered by an existing contract');
  await cancelButton.click();
  await view.waitForTimeout(800);
  check('Cancel asks the server to cancel, with the reason',
    posted.length === 1 && posted[0].requestId === REQUEST_ID && posted[0].newStatus === 'cancelled'
      && posted[0].action === 'cancelled' && posted[0].notes === 'Covered by an existing contract',
    JSON.stringify(posted));
  await viewContext.close();

  // A failed read is not a missing request.
  const failContext = await browser.newContext();
  await installDbStub(failContext, {}, { fail: ['requests_with_derived'] });
  await failContext.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: user }, version: 0 }));
  }, ADMIN);
  const failPage = await failContext.newPage();
  await failPage.goto(`${BASE}/requests/${REQUEST_ID}`, { waitUntil: 'domcontentloaded' });
  await failPage.waitForTimeout(3000);
  const failBody = await failPage.locator('main').innerText();
  check('an unreadable request says it could not be loaded', /could not be loaded/.test(failBody), failBody.slice(0, 160));
  check('…and does not claim the request was removed', !/does not exist or has been removed/.test(failBody));
  await failContext.close();

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
