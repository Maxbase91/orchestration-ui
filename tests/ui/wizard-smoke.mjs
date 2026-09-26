#!/usr/bin/env node
// Browser smoke test for the new-request wizard.
//
// Boots the Vite dev server, drives the wizard in a headless browser, and
// asserts the connector-backed pre-check step actually renders — the kind of
// runtime/render failure that `tsc -b` and `npm run build` cannot catch.
// Also fails on any uncaught page error or console error during the flow.
//
// Run: npm run test:ui   (no credentials — the database is stubbed)
//      UI_SHOT_DIR=<dir> npm run test:ui   also screenshots the Channel pages

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub, templateRows } from './db-stub.mjs';
import { workflowTemplates } from '../../src/data/workflows.ts';

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
const SHOT_DIR = process.env.UI_SHOT_DIR;
async function shot(name) {
  if (!SHOT_DIR) return;
  // The app scrolls inside <main>, so a full-page capture is one viewport:
  // make the viewport tall enough instead, from the top.
  const size = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 1700 });
  await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
  if (size) await page.setViewportSize(size);
}
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext();
  // The app is now Neon-backed in production, while Vite serves no Vercel API
  // functions locally. Keep this browser smoke deterministic with a fixture
  // catalogue row, without writing to a real database or pretending that a
  // local Vite process can exercise serverless routes.
  await installDbStub(context, {
    // The shipped templates, graphs and all: each option's headline is the
    // claiming template's requester wording, and the Channel page walks the
    // real branches.
    workflow_templates: templateRows(workflowTemplates),
    catalogue_items: [{
      id: 'IT-001', name: 'ThinkPad T14 Gen 5', description: 'Lenovo business laptop, 14-inch, 16GB RAM',
      unit_price: 1299, unit: 'each', catalogue_id: 'it-equipment', catalogue_name: 'IT Equipment',
      supplier_name: 'Lenovo', supplier_id: 'SUP-CAT-001', lead_time: '5-7 days', available: true,
    }],
  });
  // The Catalogue page places its basket through the checkout's basket mode;
  // the rules are test:catalogue-basket's, this answers as the server would.
  await context.route('**/api/governed-checkout', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    const orders = (payload.basket?.orders ?? [payload]).map((order) => ({
      requestId: order.requestId,
      request: order.request,
      requisition: { id: order.requisitionId, status: 'po-created' },
      lines: order.lines ?? [],
      purchaseOrder: { id: `PO-${order.requestId}`, requestId: order.requestId, status: 'created' },
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload.basket ? { orders } : orders[0]),
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
    // Same cause, logged by the app's own catch rather than by the network
    // layer: the SOW composes from `/api/generate-sow`, which does not exist on
    // a local Vite server. The chat falls back to a locally composed narrative.
    // This surfaced here only because generation now fires when the DESCRIPTION
    // is captured rather than when the whole conversation ends.
    if (/\[generate-sow\]/.test(m.text())) return;
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
  // Ordering the suggested item puts THAT item in the basket on the Catalogue
  // page — where every catalogue order is placed (ADR-0009) — rather than
  // dropping the requester at the catalogue root to find it again. Once: the
  // add used to run twice and order two.
  await page.getByRole('button', { name: /Order this/ }).first().click();
  await page.waitForURL((url) => url.pathname === '/catalogue', { timeout: 10000 });
  const order = page.locator('aside[aria-label="Your order"]');
  await order.getByText('ThinkPad T14 Gen 5').waitFor({ timeout: 10000 });
  check('ordering the matched item adds it to the basket on the Catalogue page',
    (await order.innerText()).includes('ThinkPad T14 Gen 5'));
  check('…once', (await page.getByRole('button', { name: /Add another ThinkPad T14 Gen 5 \(1 in your order\)/ }).count()) === 1);

  // 3a. THE DIRECT CALL-OFF LIMIT. Above it a call-off needs a mini-competition,
  //     and the checkout refuses it — so the form says so beside the value and
  //     holds the way on, rather than the refusal arriving after submit.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#need-input').fill('a few standard office laptops for a new starter');
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 });
  const callOff = page.getByRole('button', { name: /Call it off/ }).first();
  check('the covering contract can be called off', (await callOff.count()) > 0);
  await callOff.click();
  await page.locator('#calloff-value').waitFor({ timeout: 10000 });
  await page.locator('#calloff-value').fill('300000');
  check('a call-off above the limit is named as needing a mini-competition',
    (await page.getByRole('alert').filter({ hasText: /direct call-off limit/ }).count()) > 0);
  check('…and the way on is held',
    !(await page.getByRole('button', { name: 'See how it will be bought' }).isEnabled()));
  await page.locator('#calloff-value').fill('20000');
  check('under the limit the warning goes',
    (await page.getByRole('alert').filter({ hasText: /direct call-off limit/ }).count()) === 0);
  // The rest of the details, then on to the Channel page — the call-off no
  // longer submits from this form.
  await page.locator('#calloff-title').fill('Laptops for the new starter');
  await page.locator('#calloff-recipient').fill('The new starter');
  await page.locator('#calloff-purpose').fill('Equipment for the first week');
  await page.locator('#calloff-need-by').fill('2026-12-01');
  for (const id of ['#calloff-location', '#calloff-cost-centre']) {
    const select = page.locator(id);
    if (!(await select.inputValue())) await select.selectOption(await select.evaluate((el) => [...el.options].map((o) => o.value).find(Boolean) ?? ''));
  }
  const onward = page.getByRole('button', { name: 'See how it will be bought' });
  check('with the details complete, the call-off can go on to its Channel page',
    await onward.isEnabled(), await page.getByText(/^Still needed:/).innerText().catch(() => ''));
  await onward.click();
  const offPane = page.locator('section[aria-label="How it will be bought"]');
  await offPane.getByRole('list', { name: 'Stages' }).waitFor({ timeout: 15000 }).catch(async (error) => {
    console.error((await page.locator('main').innerText()).slice(0, 600));
    console.error('CONSOLE:', consoleErrors.slice(-3).join('\n---\n').slice(0, 4000));
    throw error;
  });
  await page.waitForTimeout(600);
  await shot('channel-call-off');
  check('a call-off gets a Channel page too, in its template\'s words',
    (await offPane.getByRole('heading', { name: 'Call it off an existing contract' }).count()) === 1);
  const offStages = await offPane.getByRole('list', { name: 'Stages' }).locator('li').evaluateAll((items) => items.map((li) => `${li.dataset.stage}:${li.dataset.applicability}`));
  check('its stages come from the call-off template, landed by the checkout\'s rule',
    offStages[0] === 'intake:here' && offStages.some((s) => s.startsWith('contracting:')) && !offStages.some((s) => s.startsWith('sourcing')),
    offStages.join(' '));
  const offChecks = await page.locator('aside[aria-label="What you are submitting"]').getByRole('list', { name: 'Checks' }).innerText();
  check('the call-off\'s checks come from its governed decision',
    /The contract can be called off/.test(offChecks) && /Within the direct call-off limit/.test(offChecks), offChecks);
  const submitCallOff = page.getByRole('button', { name: /Submit the call-off/ });
  if (await submitCallOff.isEnabled()) {
    await submitCallOff.click();
    await page.getByRole('heading', { name: 'Request submitted', exact: true }).waitFor({ timeout: 15000 });
    check('the call-off submits from its Channel page', true);
    check('the confirmation names the call-off as its channel',
      /Framework Call-Off/.test(await page.locator('main').innerText()));
  } else {
    check('a call-off the decision refuses cannot be submitted, and the checks say why',
      /cannot be placed as it stands/.test(offChecks), offChecks);
  }

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

  // 3e. THE CHAT PATH. The risk questions used to be a card of switches BELOW
  //     the conversation, and supplier selection was on screen from the moment
  //     the step opened — everything visible at once, before the requester had
  //     answered anything. They are now the tail of the conversation itself,
  //     asked as yes/no with the text input disabled, and supplier appears only
  //     once the conversation is done.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#need-input').fill('IT strategy consulting to design a target operating model');
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /^Start$/ }).last().click();
  await page.getByPlaceholder(/Type your answer/).waitFor({ timeout: 15000 });
  check('the chat path opens on the conversation alone',
    (await page.getByText('Mini risk questionnaire').count()) === 0
    && (await page.getByText('Selected supplier').count()) === 0);

  // One answer that satisfies whichever slot is asked: prose, a value, a date.
  const chatAnswer = 'Target operating model design for the IT function, budget 250000 EUR, '
    + 'needed by 2027-01-15, covering assessment, target design, a roadmap, '
    + 'accepted at steering-group sign-off, fixed price, depends on finance availability.';
  let reachedChoice = false;
  for (let turn = 0; turn < 16; turn++) {
    if (await page.getByRole('button', { name: /^Yes$/ }).count()) { reachedChoice = true; break; }
    const field = page.getByPlaceholder(/Type your answer|Choose Yes or No/);
    if (await field.isDisabled().catch(() => true)) { reachedChoice = true; break; }
    await field.fill(chatAnswer);
    await field.press('Enter');
    await page.waitForTimeout(1200);
  }
  check('the conversation reaches its risk questions', reachedChoice);
  check('a risk question is asked as a choice, not a text box',
    (await page.getByRole('button', { name: /^Yes$/ }).count()) > 0
    && (await page.getByRole('button', { name: /^No$/ }).count()) > 0);
  // The guarantee: there is no free-text path into a governance answer, so a
  // model cannot fill one by extracting it from the requester's prose.
  check('the text input is disabled while a choice is pending',
    (await page.getByPlaceholder(/Choose Yes or No/).count()) > 0);
  check('the question still carries its rationale',
    (await page.getByText(/Asked because/).count()) > 0);
  check('Next is blocked while a triggered risk question is unanswered',
    !(await page.getByRole('button', { name: /^Next$/ }).isEnabled().catch(() => true)));
  check('supplier selection is still not on screen', (await page.getByText('Selected supplier').count()) === 0);

  // Answer every risk question, then the last section appears.
  for (let turn = 0; turn < 6; turn++) {
    if (await page.getByRole('button', { name: /^Next$/ }).isEnabled().catch(() => false)) break;
    const no = page.getByRole('button', { name: /^No$/ });
    if (!(await no.count())) break;
    await no.last().click();
    await page.waitForTimeout(1200);
  }
  check('supplier selection appears once the conversation is finished',
    (await page.getByText('Selected supplier').count()) > 0);
  // Intake could name exactly one supplier, and "go out to market" was only
  // expressible by leaving the field blank — which reads as an omission.
  // The ranked list only renders when the recommender agent is active and the
  // fixture has suppliers in the category — so assert the CONTRACT (both
  // actions offered together) rather than that a list happens to be there.
  const preferCount = await page.getByRole('button', { name: /^Prefer$/ }).count();
  const inviteCount = await page.getByRole('button', { name: /Also invite/ }).count();
  check('a recommended supplier can be preferred, and others invited alongside',
    preferCount === inviteCount, `prefer=${preferCount} invite=${inviteCount}`);
  check('having no supplier in mind is an explicit choice',
    (await page.getByRole('button', { name: /I have none in mind/ }).count()) > 0);
  // A supplier outside the category's preferred list (consulting lists only
  // Advisory Partner A) is allowed, but owes a reason — asked here, where the
  // choice is made, and named in the footer until it is given.
  await page.getByRole('combobox').filter({ hasText: /Search supplier directory/ }).click();
  await page.getByPlaceholder('Type supplier name...').fill('Lenovo');
  await page.getByRole('option', { name: /Lenovo/ }).click();
  await page.locator('#supplier-override-reason').waitFor({ timeout: 5000 }).catch(() => {});
  check('a non-preferred supplier asks why',
    (await page.getByText('Not on the preferred list for this category — why this supplier?').count()) > 0);
  check('…says a category manager will approve it',
    (await page.getByText(/A category manager approves this choice/).count()) > 0);
  check('…and the footer names the reason as still needed',
    (await page.getByText(/Add why this supplier rather than a preferred one under Supplier/).count()) > 0);
  await page.locator('#supplier-override-reason').fill('Only supplier with the certification this work needs');
  await page.waitForTimeout(300);
  check('giving the reason clears it from the footer',
    (await page.getByText(/why this supplier rather than a preferred one/).count()) === 0);
  await page.getByRole('button', { name: /I have none in mind/ }).click();
  await page.waitForTimeout(600);
  check('choosing it says so, and is reversible',
    (await page.getByText(/No supplier in mind — sourcing will identify candidates/).count()) > 0
    && (await page.getByRole('button', { name: /I do have one/ }).count()) > 0);
  // Submit requires a cost centre (submission-requirements.ts), and this user
  // has none on their profile. Details used to let them through and the server
  // refused on the final click; now Details holds Next and says where to add it.
  check('with every question answered, Next still waits for a cost centre',
    !(await page.getByRole('button', { name: /^Next$/ }).isEnabled().catch(() => true)));
  check('…and the footer says where to add it',
    (await page.getByText(/Add a cost centre under Charged to/).count()) > 0);
  check('Charged to says it is needed, not that it can wait',
    (await page.getByText('Not set yet — needed before you submit').count()) > 0);
  await page.getByText('Charged to', { exact: true }).locator('xpath=..').getByRole('button', { name: /Change/ }).click();
  const centre = page.getByLabel('Cost centre', { exact: true });
  const firstCentre = await centre.evaluate((el) => [...el.options].map((o) => o.value).find(Boolean) ?? '');
  await centre.selectOption(firstCentre);
  await page.waitForTimeout(400);
  // The conversation gave up on the need-by date inside that long answer. It
  // used to be read-only in Key facts, so a skipped date could never be added
  // and the request could never be submitted.
  check('a skipped need-by date is named, with where to add it',
    (await page.getByText('Add a need-by date under Key facts.').count()) > 0);
  await page.locator('#key-facts-need-by').fill('2027-01-15');
  await page.waitForTimeout(400);
  check('Next opens once every risk question is answered and a cost centre and date are given',
    await page.getByRole('button', { name: /^Next$/ }).isEnabled().catch(() => false));

  // 3f. BUDGET "NOT KNOWN" — THE REPORTED DEFECT. Budget used to be slot #2,
  //     asked immediately after the title, and a requester who did not yet
  //     know the figure had no extractable number to give — the engine kept
  //     re-asking the identical "What's the estimated budget for this?"
  //     forever. Budget (and the delivery date) are now asked LAST, and
  //     answering "not known" is accepted after one retry instead of looped
  //     on.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#need-input').fill('a market-research study for APAC expansion');
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /^Start$/ }).last().click();
  await page.getByPlaceholder(/Type your answer/).waitFor({ timeout: 15000 });

  // Answer the opening invitation first, deliberately WITHOUT a figure in it,
  // and confirm the very next question is not the budget — pinning down the
  // reorder itself, not just that budget shows up somewhere within N turns.
  const fillerAnswer = 'A detailed answer covering everything this question needs for the request.';
  await page.getByPlaceholder(/Type your answer/).fill(fillerAnswer);
  await page.getByPlaceholder(/Type your answer/).press('Enter');
  await page.waitForTimeout(1200);
  check('budget is NOT the first substantive question (it used to be slot #2, right after the title)',
    (await page.getByText(/estimated budget/i).count()) === 0);

  let sawBudgetQuestion = false;
  for (let turn = 0; turn < 8 && !sawBudgetQuestion; turn++) {
    if (await page.getByText(/estimated budget/i).count()) { sawBudgetQuestion = true; break; }
    const field = page.getByPlaceholder(/Type your answer/);
    if (await field.isDisabled().catch(() => true)) break;
    await field.fill(fillerAnswer);
    await field.press('Enter');
    await page.waitForTimeout(1200);
  }
  check('budget is still asked eventually, once the description is captured',
    sawBudgetQuestion);

  const budgetField = page.getByPlaceholder(/Type your answer/);
  await budgetField.fill('not known yet');
  await budgetField.press('Enter');
  await page.waitForTimeout(1200);
  // "approximate figure" only — NOT "not known yet", which is also the text of
  // the user's own message bubble still on screen and would match regardless
  // of whether the assistant actually replied with a retry hint.
  check('a vague first budget answer gets a retry hint, not silence',
    (await page.getByText(/approximate figure/i).count()) > 0);

  await budgetField.fill('not known yet');
  await budgetField.press('Enter');
  await page.waitForTimeout(1200);
  check('a second "not known" gives up on the budget rather than re-asking it',
    (await page.getByText(/leave the budget open/i).count()) > 0);
  check('the conversation moves on — the next question is delivery date, not budget again',
    (await page.getByText(/When do you need this delivered or started by/i).count()) > 0);

  // 4. A material demand through the conversation to Review. This walked a
  //    "renew our vendor contract" demand through a separate form path; the
  //    renewal category and that form are gone (2026-09-25) — a renewal is a
  //    demand like any other, and every full request is captured by the
  //    conversation. €150k of software is procurement-led by the value rules,
  //    and material enough for the critical-service question.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#need-input').fill('an analytics software platform for the finance team');
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /^Start$/ }).last().click();
  await page.getByPlaceholder(/Type your answer/).waitFor({ timeout: 15000 });

  // Answer whatever is asked: the budget and the date by what the question
  // asks for, a yes/no risk question with Yes, anything else with prose —
  // until Next unlocks. The residual questions are criteria-driven (INT-10
  // stage 5), so reaching one proves the €150k answer was read.
  let sawRationale = false;
  {
    const next = page.getByRole('button', { name: /^Next$/ });
    for (let turn = 0; turn < 20; turn++) {
      if (await next.isEnabled().catch(() => false)) break;
      if (await page.getByText(/^Asked because/).count()) sawRationale = true;
      const yes = page.getByRole('button', { name: /^Yes$/ });
      if (await yes.count()) {
        await yes.last().click();
        await page.waitForTimeout(900);
        continue;
      }
      const field = page.getByPlaceholder(/Type your answer/);
      if (await field.isDisabled().catch(() => true)) break;
      const bubbles = await page.locator('main').innerText();
      const lastQuestion = bubbles.slice(bubbles.lastIndexOf('?') - 160, bubbles.lastIndexOf('?') + 1);
      const answer = /budget/i.test(lastQuestion) ? '150000'
        : /delivered or started by|need.*by/i.test(lastQuestion) ? '2027-03-31'
        : fillerAnswer;
      await field.fill(answer);
      await field.press('Enter');
      await page.waitForTimeout(1200);
    }
  }
  check('a residual risk question is asked, with its rationale', sawRationale);
  // Submit needs a cost centre; the profile supplies it on the chat path, and
  // Details still names it when it is missing.
  if (await page.getByText('Add a cost centre under Charged to.').count()) {
    await page.getByText('Charged to', { exact: true }).locator('xpath=..').getByRole('button', { name: /Change/ }).click();
    const centre = page.getByLabel('Cost centre', { exact: true });
    await centre.selectOption(await centre.evaluate((el) => [...el.options].map((o) => o.value).find(Boolean) ?? ''));
  }
  check('the conversation, a date and a cost centre open Next on the chat path',
    await page.getByRole('button', { name: /^Next$/ }).isEnabled().catch(() => false));

  // 5. The Channel page — how it will be bought, stage by stage, and what is
  //    being submitted (Intake Prototype, 2026-09-26). It replaced Review &
  //    submit, whose fifteen cards put the channel, three risk readings, two
  //    approval panels and every policy result at one weight.
  await page.getByRole('button', { name: /Next/ }).click();              // → your buying channel
  const channelPane = page.locator('section[aria-label="How it will be bought"]');
  const stageList = channelPane.getByRole('list', { name: 'Stages' });
  await stageList.waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await shot('channel-request');
  const stageRow = (stage) => stageList.locator(`li[data-stage="${stage}"]`);
  check('the channel leads in the words its template sets',
    (await channelPane.getByRole('heading', { name: 'Procurement runs a sourcing exercise' }).count()) === 1);
  const stageOrder = await stageList.locator('li').evaluateAll((items) => items.map((li) => li.dataset.stage));
  check('every stage of the channel\'s template is listed, in the order the graph reaches them',
    stageOrder.join(',') === 'intake,validation,risk,onboarding,approval,sourcing,contracting,po,receipt,invoice,payment', stageOrder.join(','));
  check('the requester is at intake, and the stage says what they do there',
    /You are here/.test(await stageRow('intake').innerText())
    && /You: Describe what you need and submit it\./.test(await stageRow('intake').innerText()));
  check('the risk assessment the determination asked for applies, and says why',
    (await stageRow('risk').getAttribute('data-applicability')) === 'applies'
    && /Applies · risk assessment required/.test(await stageRow('risk').innerText()));
  check('with no supplier chosen, onboarding depends on who is chosen — in the branch\'s own words',
    (await stageRow('onboarding').getAttribute('data-applicability')) === 'conditional'
    && /If the supplier is new/.test(await stageRow('onboarding').innerText()));
  check('each stage shows its owner and target days from the template',
    /Category Manager/.test(await stageRow('validation').innerText()) && /\b3d\b/.test(await stageRow('validation').innerText()));
  check('the band counts the stages that apply, with + for the one that may',
    /10\+ of 11/.test(await channelPane.innerText()));
  check('submit says where the request goes first, and who owns that',
    (await page.getByText('Submitting creates the request and sends it to Validation (Category Manager).').count()) === 1);

  const submitting = page.locator('aside[aria-label="What you are submitting"]');
  const checksList = submitting.getByRole('list', { name: 'Checks' });
  await checksList.getByText(/approval/i).first().waitFor({ timeout: 15000 }).catch(() => {});
  check('the request is summarised beside the stages',
    /The request/.test(await submitting.innerText()) && /Charged to/.test(await submitting.innerText()));
  check('the first check says why this channel',
    /Procurement-Led Sourcing/.test(await checksList.locator('li').first().innerText()));
  // The derivation submit writes, chain and all: the €150k band's VP step,
  // which nobody holds in these fixtures, so any holder of the role may act.
  // (The old screen's "Christine Dupont" matched its reviewer chips, not an
  // approver.)
  check('the approvers are the ones submit will ask (the same derivation)',
    /One approval/.test(await checksList.innerText()) && /Any VP Procurement/.test(await checksList.innerText()), await checksList.innerText());
  check('the risk read is a conclusion, not a tier',
    /Risk assessment needed|Risk assessment reused|No risk assessment needed/.test(await checksList.innerText()));
  check('Save as draft is still offered before submitting',
    (await page.getByRole('button', { name: /Save as draft/ }).count()) > 0);
  check('the controls that were collected and never saved are gone',
    (await page.getByText('Add Reviewers / Watchers').count()) === 0
    && (await page.getByText('Notes for Approvers').count()) === 0
    && (await page.getByText('Workflow Preview').count()) === 0);
  check('no workflow-template picker (item 8)',
    (await page.getByText('Which template should this request follow?').count()) === 0);

  // The workings: one click down, and all still there (DET-04/05/08, RSK-02, RSK-06).
  await submitting.getByText('How this was worked out').click();
  const workings = submitting.locator('details');
  // innerText is as rendered, and the row labels are set in capitals.
  const workingsText = await workings.innerText();
  const missingWorkings = ['Materiality', 'Inherent risk', 'Operational risk', 'Approval to source', 'Contract and sourcing', 'Policy checks', 'Next steps']
    .filter((label) => !new RegExp(label, 'i').test(workingsText));
  check('the workings are one click away: materiality, risk, approval to source, contract and sourcing, checks, next steps',
    missingWorkings.length === 0, missingWorkings.join(', '));
  check('the critical-service answer drove the cascade', /Supports a critical service/.test(workingsText));
  check('approval to source names its demand-validation gate', /Demand validation/.test(workingsText));
  check('the next steps route the detailed risk assessment', /Third-party risk register/.test(workingsText));
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    workings.getByRole('button', { name: /Export/ }).click(),
  ]);
  check('Export downloads the determination as markdown',
    Boolean(download) && /determination-.*\.md/.test(download.suggestedFilename()),
    download ? download.suggestedFilename() : 'no download');
  await shot('channel-request-workings');

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

  // 5b. The catalogue is its own door. "Browse the catalogue" used to open a
  //     catalogue step inside this wizard with a one-line cart; since
  //     2026-09-25 it opens the Catalogue page, whose basket is placed through
  //     the governed checkout (ADR-0009).
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Browse the catalogue/ }).click();
  await page.waitForURL((url) => url.pathname === '/catalogue', { timeout: 10000 });
  const basket = page.locator('aside[aria-label="Your order"]');
  await basket.waitFor({ timeout: 10000 });
  check('"Browse the catalogue" opens the Catalogue page, not a wizard step',
    new URL(page.url()).pathname === '/catalogue' && !/How you.ll buy/.test(await page.locator('main').innerText()));
  // The item "Order this" put there earlier is still in the basket: it is
  // the requester's until placed, across pages.
  check('the basket keeps what was added from the buy-route screen',
    (await basket.innerText()).includes('ThinkPad T14 Gen 5'));
  // A picker, and every option an active row of `cost_centres` — not the five
  // invented entries ("CC-1001 Marketing", …) a catalogue checkout once offered
  // with the authority of a dropdown and nothing behind it.
  const costCentreField = basket.getByLabel('Charged to');
  const offered = await costCentreField.evaluate(
    (el) => [...el.options].map((option) => option.value).filter(Boolean)).catch(() => []);
  check('every cost centre offered is a seeded row, not an invented one',
    offered.length > 0 && offered.every((id) => /^CC-/.test(id)), `offered=${offered.join(', ')}`);
  check('no invented or retired cost centre is offered',
    !offered.some((id) => /^CC-1001$|Marketing|RETIRED/.test(id)));
  // No silent default either: without a profile location the requester picks.
  const locationOptions = await basket.getByLabel('Deliver to').evaluate(
    (el) => [...el.options].map((option) => option.value).filter(Boolean)).catch(() => []);
  check('delivery locations come from the reference table, active only', locationOptions.length > 0 && !locationOptions.includes('closed-site'),
    `offered=${locationOptions.join(', ')}`);
  const place = basket.getByRole('button', { name: 'Place order' });
  check('an order waits for where, what it is charged to and why', !(await place.isEnabled()));
  await basket.getByLabel('Deliver to').selectOption(locationOptions[0]);
  await costCentreField.selectOption(offered[0]);
  await basket.getByLabel('What is it for?').fill('Standard equipment for a new starter');
  await place.click();
  await basket.getByText('Order placed').waitFor({ timeout: 15000 });
  const placedText = await basket.innerText();
  // The id is minted by the database, not by the page: the stub answers
  // next_request_id with REQ-2026-09001, so seeing it proves the RPC ran.
  check('the order is placed and named by the id the database minted', /REQ-2026-09001/.test(placedText), placedText.slice(0, 200));
  check('no client-generated REQ-2025 id is minted', !/REQ-2025-\d{4}\b/.test(placedText));

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
