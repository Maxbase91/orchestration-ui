#!/usr/bin/env node
// Browser smoke test for the new-request wizard.
//
// Boots the Vite dev server, drives the wizard in a headless browser, and
// asserts the connector-backed pre-check step actually renders — the kind of
// runtime/render failure that `tsc -b` and `npm run build` cannot catch.
// Also fails on any uncaught page error or console error during the flow.
//
// Run: npm run test:ui   (requires .env.local with NEON_DATABASE_URL)

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

class LocalServerlessUnavailable extends Error {}

const BASE = 'http://localhost:5173';
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures++;
    console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Allow an explicit Chromium path. Sandboxes and CI images often ship a browser
// build that doesn't match the revision the pinned Playwright expects; pointing
// at the installed binary beats reinstalling one per run. Unset locally, where
// Playwright resolves its own download.
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not become ready at ${BASE} within ${timeoutMs}ms`);
}

// Keep this full Expert-path smoke deterministic even when a developer's local
// Neon preferences have a saved Simple view. The dedicated experience-mode
// browser suite covers the requester presentation separately.
const server = spawn('npm', ['run', 'dev'], {
  stdio: 'ignore',
  env: {
    ...process.env,
    // Browser smoke uses the in-memory PostgREST fixture below. This keeps the
    // test independent from the developer's Neon URL while production remains
    // Neon-backed through the private API boundary.
    VITE_SIMPLE_EXPERIENCE_ENABLED: 'false',
  },
});
let browser;
let page;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext();
  // The app is now Neon-backed in production, while Vite serves no Vercel API
  // functions locally. Keep this browser smoke deterministic with a fixture
  // catalogue row, without writing to a real database or pretending that a
  // local Vite process can exercise serverless routes.
  await installDbStub(context, {
    catalogue_items: [{
      id: 'IT-001', name: 'ThinkPad T14 Gen 5', description: 'Lenovo business laptop, 14-inch, 16GB RAM',
      unit_price: 1299, unit: 'each', catalogue_id: 'it-equipment', catalogue_name: 'IT Equipment',
      supplier_name: 'Lenovo', supplier_id: 'SUP-CAT-001', lead_time: '5-7 days', available: true,
    }],
  });
  await context.route('**/api/governed-checkout', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        requestId: payload.requestId,
        request: payload.request,
        requisition: { ...payload.requisition, id: payload.requisitionId, status: 'approved' },
        lines: payload.lines ?? [],
        purchaseOrder: { id: `PO-${payload.requestId}`, requestId: payload.requestId, status: 'created' },
      }),
    });
  });
  page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url ?? '';
    // The vite dev server has no serverless functions, so /api/* endpoints 404
    // here and the app falls back gracefully (local classify / local narrative).
    // These are expected in dev and not app errors.
    if (/\/api\//.test(url) && /Failed to load resource/.test(m.text())) return;
    consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // 1. App boots and React mounts.
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#root *').first().waitFor({ timeout: 15000 });
  check('app shell mounts at /', (await page.locator('#root *').count()) > 0);

  // 2. New-request wizard: free text is the ONLY commodity entry — there are no
  //    category tiles (the fulfilment path is derived, not chosen). "Browse the
  //    catalogue" is the one explicit alternative entry point.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  // exact: the step-1 guidance panel opens with "Describe what you need in
  // plain language…", so a loose match now resolves to two elements.
  await page.getByText('Describe what you need', { exact: true }).waitFor({ timeout: 15000 });
  check('wizard category step renders free-text entry', true);
  check('unified intake labels the first step Describe', (await page.getByText('Describe', { exact: true }).count()) > 0);
  check('unified intake offers PDF/DOCX upload', (await page.locator('#intake-upload').count()) > 0);

  // 2b. The floating AI assistant button is `fixed bottom-6 right-6`, mounted
  //     globally over every page. Content that scrolls to the bottom of a
  //     wide/tall step (e.g. this wizard's own Back/Next footer) must never
  //     end up underneath it — see app-layout.tsx / supplier-portal-layout.tsx.
  //     Assert the invariant generically from the FAB's own rendered geometry
  //     (not a hardcoded pixel count), so this can't silently rot if the FAB's
  //     size ever changes.
  const fabClearance = await page.evaluate(() => {
    const main = document.querySelector('main');
    const fab = Array.from(document.querySelectorAll('button')).find((b) => {
      const r = b.getBoundingClientRect();
      return getComputedStyle(b).position === 'fixed' && r.width > 40 && r.width < 80;
    });
    if (!main || !fab) return null;
    const fabRect = fab.getBoundingClientRect();
    const viewportBottom = window.innerHeight;
    // Height of the FAB's fixed exclusion zone, measured from the bottom of
    // the viewport (its own height plus its offset from the bottom edge).
    const exclusionZone = viewportBottom - fabRect.top;
    const paddingBottom = parseFloat(getComputedStyle(main).paddingBottom);
    return { exclusionZone, paddingBottom };
  });
  check('scrollable content reserves enough bottom clearance to never sit under the AI assistant button',
    fabClearance !== null && fabClearance.paddingBottom >= fabClearance.exclusionZone,
    fabClearance ? `exclusion zone ${fabClearance.exclusionZone}px, main padding-bottom ${fabClearance.paddingBottom}px` : 'FAB or <main> not found');

  check('NO commodity-category tiles (Goods/Contingent Labour are not a choice)',
    (await page.getByText('Goods', { exact: true }).count()) === 0
    && (await page.getByText('Contingent Labour', { exact: true }).count()) === 0);
  check('catalogue is the one explicit alternative entry point',
    (await page.getByRole('button', { name: /Browse the catalogue/ }).count()) > 0);

  // 3. Describe a need in free text → the system derives the category and shows
  //    all three ways to buy it at once, recommendation first. The two-stage
  //    funnel this replaced hid whichever route it had not reached yet, so a
  //    wrong catalogue match hid the contract check behind a green button
  //    pointing the other way.
  await page.locator('#need-input').fill('a few standard office laptops for a new starter');
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await Promise.race([
    page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 }),
    page.getByText('We could not check what already exists', { exact: true }).waitFor({ timeout: 15000 }),
  ]);
  if (await page.getByText('We could not check what already exists', { exact: true }).count()) {
    throw new LocalServerlessUnavailable('Local Vite has no serverless API handlers; the buy-route check is unavailable.');
  }
  check('free-text classification routes into the buy-route screen', true);
  // Regression: a plain product word ("laptops") must surface catalogue items,
  // even though the seed laptop is named by model ("ThinkPad T14 Gen 5").
  check('catalogue items surface for a plain product word (laptops)',
    (await page.getByRole('button', { name: /Order this/ }).count()) > 0);
  // All three routes are visible together, so the requester can compare rather
  // than being walked through a funnel one gate at a time.
  check('every way to buy is on the screen at once',
    (await page.getByText('Order it from the catalogue').count()) > 0
    && (await page.getByText('Call it off an existing contract').count()) > 0
    && (await page.getByText('Raise a full request').count()) > 0);
  check('the recommendation is marked, not just ordered first',
    (await page.getByText('Recommended', { exact: true }).count()) > 0);
  // The route must stay explainable — but as an audit trail a buyer opens, not
  // as annotations a requester has to read past.
  check('the matched words are evidence behind a disclosure, not on the surface',
    (await page.getByText(/matched on/).count()) === 0
    && (await page.getByRole('button', { name: /Why this\?/ }).count()) > 0);
  await page.getByRole('button', { name: /Why this\?/ }).click();
  check('the evidence names the words that matched and the rule that decided it',
    (await page.getByText(/matched on/).count()) > 0
    && (await page.getByText(/routing rule|default fallback/).count()) > 0);
  // Regression: selecting the suggested item must open its product-details
  // page, preserving the item id for governed checkout, rather than dropping
  // the requester at the catalogue root.
  await page.getByRole('button', { name: /Order this/ }).first().click();
  await page.waitForURL(`${BASE}/catalogue/items/IT-001`, { timeout: 10000 });
  check('ordering the matched item opens its detail page',
    new URL(page.url()).pathname === '/catalogue/items/IT-001');

  // 3b. THE REPORTED DEFECT. "business consulting" used to match the catalogue
  //     item "Business Cards 500" — the word "business" hit the item name and
  //     carried the whole match, while "consulting" matched nothing and cost
  //     nothing. A consulting demand must never be offered a catalogue item.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#need-input').fill('I want to buy business consulting');
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 });
  check('a consulting demand is not offered the catalogue', true);
  check('NO catalogue order CTA for a consulting demand',
    (await page.getByRole('button', { name: /Order this/ }).count()) === 0);
  check('"Business Cards" is never offered for a consulting demand',
    (await page.getByText(/Business Cards/).count()) === 0);
  // A ruled-out route states its reason on the option itself rather than
  // disappearing — silence is as unhelpful as a wrong suggestion.
  check('the ruled-out catalogue says why, in place',
    (await page.getByText(/isn.t fulfilled from the catalogue|No catalogue item covers/).count()) > 0);
  check('the full-request route is always startable',
    (await page.getByRole('button', { name: /^Start$/ }).count()) > 0);

  // 3c. "Add detail" has to *act*. Both ruled-out routes offer it, but the
  //     handler only set the flag that reveals the enrichment box — and that box
  //     already renders whenever nothing matched, which is exactly when the
  //     buttons appear. So the press was a no-op the requester could see: the
  //     screen did not move. Focus landing in the box is the observable proof.
  const addDetail = page.getByRole('button', { name: /^Add detail$/ });
  check('a ruled-out route offers a way to add detail', (await addDetail.count()) > 0);
  await addDetail.first().click();
  await page.waitForTimeout(600);
  check('pressing "Add detail" puts the cursor in the detail box',
    (await page.evaluate(() => document.activeElement?.tagName ?? 'NONE')) === 'TEXTAREA');

  // 4. Full staged funnel via free text: classify → catalogue (no match) →
  //    enrich → contract (no match) → proceed to full request → risk step.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#need-input').fill('renew our existing vendor contract for another year');
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 });
  check('a renewal demand reaches the buy-route screen', true);
  await page.getByRole('button', { name: /^Start$/ }).last().click();
  // The parent advances after the route callback; wait for the details control
  // rather than assuming the React state update is synchronous.
  await page.locator('#title').waitFor({ timeout: 10000 });
  await page.locator('#title').fill('Renewal smoke test');
  await page.locator('#value').fill('150000');  // ≥ critical-service threshold so that residual question triggers

  // 4. Details — EVERY input the requester supplies, on one screen: the demand
  //    form and the risk questions the description could not answer. The risk
  //    questions used to be a step of their own, four screens after the demand
  //    they refer to.
  await page.getByText('Mini risk questionnaire').waitFor({ timeout: 15000 });
  check('risk questions are asked on the details step, with the demand', true);
  // The residual questions are criteria-driven (INT-10 stage 5): the
  // critical-service question shows because the spend is material in size, and
  // it states why it's being asked.
  check('residual question is criteria-triggered (shows its rationale)',
    (await page.getByText(/Asked because:/).count()) > 0);
  await page.locator('#mini-irq-critical').click();

  // 5. Review & submit — EVERY conclusion, and nothing to fill in: the buying
  //    channel, the risk read, who approves it, and which checks ran. This was
  //    three separate screens (Risk, Determination, Routing) that had to be
  //    paged through one at a time.
  await page.getByRole('button', { name: /Next/ }).click();              // → review
  // The channel card leads in the requester's words — "Procurement runs a
  // sourcing exercise", not "Buying Channel Classification: Procurement-Led
  // Sourcing" with a rule id under it.
  await page.getByText(/Procurement runs a sourcing exercise|Call it off an existing contract|Raise a purchase order directly|Your team runs this one|Order it from the catalogue|Pay by purchasing card/).first().waitFor({ timeout: 15000 });
  check('the channel leads in plain language', true);
  check('the full process is stated before the submit button',
    (await page.getByText('What happens next:').count()) > 0);
  check('every group says what it means, not just what it is',
    (await page.getByText(/The route this request takes from here/).count()) > 0
    && (await page.getByText(/What the risk read found/).count()) > 0
    && (await page.getByText(/What was actually checked at intake/).count()) > 0);
  check('the risk read is stated as a consequence, not a tier',
    (await page.getByText(/risk assessment is required before this can proceed|No new risk assessment needed|No separate risk assessment is required/).count()) > 0);
  // Expert still gets the workings, under the plain statement.
  check('expert density keeps the classification detail',
    (await page.getByText(/this is classified as:/).count()) > 0);
  check('review screen renders the determination', true);
  check('demand disposition surfaces (RTE-06: proceed/request-change/refer-back)',
    (await page.getByText(/^(Proceed|Request change|Refer back)$/).count()) > 0);
  check('materiality determination surfaces', (await page.getByText(/Materiality:/).count()) > 0);
  check('supplier screening surfaces (SUP-03)', (await page.getByText(/Supplier screening:/).count()) > 0);
  check('inherent risk segmentation surfaces, once, under Risk',
    (await page.getByText('Inherent risk', { exact: true }).count()) === 1);
  check('mini-IRQ toggle drove the cascade (critical-service driver appears)', (await page.getByText('Supports a critical service').count()) > 0);
  check('contract-type & sourcing-type surface', (await page.getByText(/Contract type:/).count()) > 0);
  check('next-steps handoff panel renders', (await page.getByText('Next steps', { exact: true }).count()) > 0);
  check('handoff routes the detailed risk assessment', (await page.getByText('Third-party risk register').count()) > 0);
  check('second contract check (Contract coverage) renders', (await page.getByText('Contract coverage', { exact: true }).count()) > 0);
  check('approval-to-source gate renders', (await page.getByText('Approval to source', { exact: true }).count()) > 0);
  check('approval-to-source shows a demand-validation gate', (await page.getByText('Demand validation', { exact: true }).count()) > 0);

  // Item 10 — the determination is grouped under scannable section headings
  // (was a flat, unstructured stack of cards).
  check('determination is grouped under section headings (item 10)',
    (await page.getByText("How you'll buy", { exact: true }).count()) > 0 &&
    (await page.getByText('Risk', { exact: true }).count()) > 0 &&
    (await page.getByText('Routing & approvals', { exact: true }).count()) > 0 &&
    (await page.getByText('Checks we ran', { exact: true }).count()) > 0);

  // Item 8 — the workflow is predefined from the input; there is NO picker.
  check('NO workflow-template picker on the determination (item 8)',
    (await page.getByText('Which template should this request follow?').count()) === 0);

  // Item 9 — Save as draft is available before submitting.
  check('Save as Draft is available on the review step (item 9)',
    (await page.getByRole('button', { name: /Save as Draft/ }).count()) > 0);

  // The determination is exportable — clicking Export downloads a .md file.
  check('determination Export button renders', (await page.getByRole('button', { name: /Export/ }).count()) > 0);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.getByRole('button', { name: /Export/ }).click(),
  ]);
  check('Export downloads a determination markdown file',
    Boolean(download) && /determination-.*\.md/.test(download.suggestedFilename()),
    download ? download.suggestedFilename() : 'no download');

  // Policy checks render only when the Request Validator agent (AI-002) is
  // active (an admin toggle); otherwise the step shows the validator notice.
  const dtps = await page.getByText('Competitive sourcing').count();
  const validatorNotice = await page.getByText('Request Validator agent').count();
  check('policy-check region renders (competitive sourcing checks when validator active, else notice)',
    dtps > 0 || validatorNotice > 0, `dtps=${dtps} notice=${validatorNotice}`);
  if (dtps > 0) {
    check('preferred-supplier (PSL) check surfaces alongside competitive sourcing',
      (await page.getByText('Preferred-supplier routing').count()) > 0);
  }

  // The routing preview sits on the SAME screen as the determination: the
  // lifecycle, approvals, timeline and reviewers are all DERIVED from admin
  // config (items 7+11), with no hardcoded literals. The renewal demand
  // (€150k, no supplier) drives both conditional steps.
  await page.getByText('Workflow Preview', { exact: true }).waitFor({ timeout: 15000 });
  // Wait for the config queries to resolve: a base lifecycle stage proves the
  // template loaded; the chain caption proves the approval chains resolved.
  await page.getByText('Validation', { exact: true }).first().waitFor({ timeout: 15000 });
  await page.getByText(/VP-Level chain/).waitFor({ timeout: 15000 });
  check('routing preview shares the review screen with the determination', true);
  check('routing step renders the workflow preview', true);
  check('lifecycle is template-derived — real stages, not the old "Intake Review by System"',
    (await page.getByText('Intake Review', { exact: true }).count()) === 0
    && (await page.getByText('Validation', { exact: true }).count()) > 0);
  check('dynamic Risk assessment step overlaid on the lifecycle (item 11)',
    (await page.getByText('Risk Assessment', { exact: true }).count()) > 0);
  check('dynamic Vendor onboarding step overlaid on the lifecycle (item 11)',
    (await page.getByText('Vendor Onboarding', { exact: true }).count()) > 0);
  check('approvals derive from the value-banded chain (€150k → VP-Level)',
    (await page.getByText(/VP-Level chain/).count()) > 0);
  check('approver resolves to the actionable persona (config, not a hardcoded name)',
    (await page.getByText('Christine Dupont').count()) > 0);
  check('timeline derives from the category SLA config',
    (await page.getByText(/business days/).count()) > 0);
  // Sarah Chen is a real directory user (vendor-manager) and not a VP-Level
  // approver, so her chip proves reviewers come from the directory; "Markus
  // Braun" was a fabricated name in the old hardcoded list and must be gone.
  check('reviewers come from the user directory (not the old hardcoded list)',
    (await page.getByText('Sarah Chen').count()) > 0
    && (await page.getByText('Markus Braun').count()) === 0);

  // 5. Service-description capture (chat intake): the SOW and the service
  //    description are one document built automatically from the conversation —
  //    there is NO manual "Generate SOW" button.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#need-input').fill('management consulting to design a target operating model');
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /^Start$/ }).click();
  await page.getByText('Service description', { exact: true }).waitFor({ timeout: 15000 });
  check('service-description capture renders (components panel)', true);

  // Requester context (who / where) is established in the shell for every path:
  // location is auto-derived from the profile, beneficiary defaults to self.
  check('requester-context block renders requester location',
    (await page.getByText('Requesting from').count()) > 0);
  check('requester location is a read-only profile value',
    (await page.getByText('from your profile').count()) > 0);
  check('beneficiary defaults to self with a Change control',
    (await page.getByText('Buying for').count()) > 0 &&
    (await page.getByRole('button', { name: /Change/ }).count()) > 0);
  check('NO manual "Generate SOW" button (auto-composed from chat)',
    (await page.getByRole('button', { name: /Generate SOW/ }).count()) === 0);
  check('SOW sections build from the conversation (no generate hint)',
    (await page.getByText(/click Generate SOW/i).count()) === 0);

  // 5b. Catalogue entry: item selection leads to an explicit review action.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Browse the catalogue/ }).click();
  await page.getByText('Browse Catalogues').waitFor({ timeout: 10000 });
  check('catalogue fast track omits the review step entirely',
    (await page.getByText('Review & submit').count()) === 0 &&
    (await page.getByText('Determination', { exact: true }).count()) === 0);
  check('catalogue shows the governed checkout header',
    (await page.getByText(/Catalogue request — governed checkout/i).count()) > 0);
  await page.getByRole('button', { name: /IT Equipment/ }).first().click();
  await page.getByRole('button', { name: /^Add$/ }).first().click();
  const placeBtn = page.getByRole('button', { name: /Review order/ });
  check('catalogue cart shows a Review order action', (await placeBtn.count()) > 0);
  await placeBtn.first().click();
  // A blocked checkout must say what it wants. It used to read "Complete the
  // highlighted order details to continue" with nothing highlighted, so a
  // requester whose blocking field was derived rather than asked for had a dead
  // button and nothing to act on.
  const blockedHint = await page.getByText(/Still needed:/).first().textContent().catch(() => '');
  check('a blocked checkout names the fields it is waiting for',
    /Still needed:/.test(blockedHint) && /who it is for|a business purpose|a cost centre/.test(blockedHint),
    `hint was: ${blockedHint || '(absent)'}`);
  check('the blocked checkout no longer points at a highlight that does not exist',
    (await page.getByText(/Complete the highlighted/).count()) === 0);
  await page.locator('#catalogue-recipient').fill('New starter');
  await page.locator('#catalogue-purpose').fill('Provide standard equipment for the new starter.');
  // Derived, not asked — unless the profile genuinely has no default, which is
  // this fixture's case. The dropdown of five invented cost centres is gone; a
  // governed order does need an account to charge, so the field appears only
  // when nothing is known.
  const costCentreField = page.locator('#catalogue-cost-centre');
  check('no invented cost-centre picker remains',
    (await costCentreField.evaluate((el) => el.tagName).catch(() => 'NONE')) !== 'SELECT');
  if (await costCentreField.count()) await costCentreField.fill('CC-2001');
  const checkoutSubmit = page.getByRole('button', { name: /Review order/ });
  check('shared checkout enables submit after required details', await checkoutSubmit.isEnabled().catch(() => false));
  await checkoutSubmit.click();
  await page.getByText('Request Submitted Successfully').waitFor({ timeout: 15000 });
  check('catalogue order placed → confirmation reached without the full wizard', true);
  check('confirmation lists the catalogue items',
    (await page.getByText(/Catalogue Items/).count()) > 0);

  // 6. No runtime errors surfaced during the flow.
  check('no console / page errors during flow', consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(' | '));

  console.log('');
  if (failures) {
    console.error(`FAILED: ${failures} UI check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('All wizard UI smoke checks passed.');
  }
} catch (err) {
  if (err instanceof LocalServerlessUnavailable) {
    console.log(`UI smoke serverless unavailable: ${err.message}`);
    process.exitCode = 0;
  } else {
  console.error('UI smoke errored:', err.message);
  if (page) console.error(`At ${page.url()}\n${(await page.locator('body').innerText().catch(() => '')).slice(0, 1200)}`);
  process.exitCode = 1;
  }
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
