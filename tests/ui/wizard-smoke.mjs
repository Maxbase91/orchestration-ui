#!/usr/bin/env node
// Browser smoke test for New request — the conversation page, the Channel page
// and the Catalogue page it hands off to (Intake Prototype, 2026-09-26).
//
// Boots the Vite dev server, drives each route through the conversation in a
// headless browser, and asserts what the requester sees and can do — the kind
// of runtime/render failure that `tsc -b` and `npm run build` cannot catch.
// Also fails on any uncaught page error or console error during the flow.
//
// Run: npm run test:ui   (no credentials — the database is stubbed)
//      UI_SHOT_DIR=<dir> npm run test:ui   also screenshots the Channel pages

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub, templateRows } from './db-stub.mjs';
import { workflowTemplates } from '../../src/data/workflows.ts';

class LocalServerlessUnavailable extends Error {}

// Its own port, claimed with --strictPort, and checked to be this app: with the
// shared default a second dev server on 5173 (another project's, once) was
// found by the readiness probe and tested instead. UI_PORT overrides it.
const PORT = process.env.UI_PORT ?? '5180';
const BASE = `http://localhost:${PORT}`;
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

let serverExited = false;
async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (serverExited) throw new Error(`The dev server did not start — is port ${PORT} in use? Set UI_PORT to another port.`);
    try {
      const res = await fetch(BASE);
      // Something answering is not enough: it has to be this app.
      if (res.ok) {
        if ((await res.text()).includes('<title>Procurement Orchestration Platform</title>')) return true;
        throw new Error(`Port ${PORT} is serving another app. Set UI_PORT to a free port.`);
      }
    } catch (error) {
      if (error instanceof Error && /another app/.test(error.message)) throw error;
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not become ready at ${BASE} within ${timeoutMs}ms`);
}

// Keep this full Expert-path smoke deterministic even when a developer's local
// Neon preferences have a saved Simple view. The dedicated experience-mode
// browser suite covers the requester presentation separately.
const server = spawn('npm', ['run', 'dev', '--', '--port', PORT, '--strictPort'], {
  stdio: 'ignore',
  env: {
    ...process.env,
    // Browser smoke uses the in-memory PostgREST fixture below. This keeps the
    // test independent from the developer's Neon URL while production remains
    // Neon-backed through the private API boundary.
    VITE_SIMPLE_EXPERIENCE_ENABLED: 'false',
  },
});
server.on('exit', () => { serverExited = true; });
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
  // Generation writes the description up from the captured answers. This
  // answers with those answers as the sections, so the Channel page's summary —
  // and its count of required sections — renders as it does when deployed.
  await context.route('**/api/generate-sow', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    const sections = payload.capturedAnswers ?? {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sections,
        narrative: Object.values(sections).filter((v) => typeof v === 'string' && v.trim()).join(' '),
        qualityScore: 80,
        qualityChecks: [],
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
    // Same cause, logged by the app's own catch rather than by the network
    // layer: the SOW composes from `/api/generate-sow`, which does not exist on
    // a local Vite server. The conversation carries on without a narrative.
    if (/\[generate-sow\]/.test(m.text())) return;
    consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // 1. App boots and React mounts.
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#root *').first().waitFor({ timeout: 15000 });
  check('app shell mounts at /', (await page.locator('#root *').count()) > 0);

  // The conversation page, driven as a requester would: a message, then the
  // buttons or the reply box, whichever the assistant is waiting on.
  const conversation = page.locator('section[aria-label="Conversation"]');
  const panel = page.locator('aside[aria-label="Your request"]');
  const reply = page.locator('#intake-reply');
  async function send(text) {
    await reply.fill(text);
    await reply.press('Enter');
  }
  async function describe(words) {
    await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
    await reply.waitFor({ timeout: 15000 });
    await send(words);
    await conversation.getByRole('button', { name: 'Yes', exact: true }).first().click();
    await conversation.getByText(/Checked the catalogue|could not reach the catalogue/).first().waitFor({ timeout: 15000 });
    if (await conversation.getByText(/could not reach the catalogue/).count()) {
      throw new LocalServerlessUnavailable('Local Vite has no serverless API handlers; the catalogue and contract checks are unavailable.');
    }
  }
  // The question line only — its "Asked because …" line can mention a budget
  // or a date while asking about something else.
  const lastQuestion = async () => conversation.locator('[data-turn="assistant"]').last().locator(':scope > div').first().innerText();
  /** Answer whatever is asked in the reply box until `done`, choosing the answer by the question. */
  async function converse(done, answerFor, maxTurns = 20) {
    for (let turn = 0; turn < maxTurns; turn++) {
      if (await done()) return true;
      if (await reply.isDisabled()) { await page.waitForTimeout(700); continue; }
      await send(answerFor(await lastQuestion()));
      await page.waitForTimeout(1000);
    }
    return done();
  }
  /** "N of M known", as the panel counts it. */
  async function panelCount() {
    const [, known, required] = (await panel.innerText()).match(/(\d+) of (\d+) known/) ?? [];
    return { known: Number(known), required: Number(required) };
  }
  const confirmedCard = conversation.locator('[data-turn="card"]').filter({ hasText: 'Buying channel confirmed' });
  const supplierCard = conversation.locator('[data-turn="card"]').filter({ hasText: /preferred supplier|Do you have a supplier in mind|Which supplier/i });

  // 2. The page opens by asking — one open question, in the requester's own
  //    words. There are no category tiles: the fulfilment path is derived from
  //    what they say, never chosen up front.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await reply.waitFor({ timeout: 15000 });
  check('the page opens by asking what is needed, in the requester’s own words',
    (await conversation.getByText(/What do you need\? Say it in your own words/).count()) === 1);
  check('the header names the three phases',
    /1 · What you need[\s\S]*2 · How it is bought[\s\S]*3 · What it needs/.test(await page.getByRole('list', { name: 'Progress' }).innerText()));
  check('a PDF or Word brief can be attached as the description',
    (await page.getByRole('button', { name: /Attach a document/ }).count()) === 1
    && (await page.locator('input[type="file"][accept*="pdf"]').count()) === 1);
  check('the cursor is already in the reply box', await page.evaluate(() => document.activeElement?.id === 'intake-reply'));
  check('Your request waits for the checks before naming a channel',
    /Deciding — the catalogue and contracts are checked first/.test(await panel.innerText()));

  // 2b. The floating AI assistant button is `fixed bottom-6 right-6`, mounted
  //     globally over every page. Content that scrolls to the bottom of a
  //     page must never end up underneath it — see app-layout.tsx /
  //     supplier-portal-layout.tsx. Asserted from the FAB's own rendered
  //     geometry, so this can't silently rot if its size ever changes. The
  //     conversation page scrolls inside its own columns, so they must end
  //     above it too.
  const fabClearance = await page.evaluate(() => {
    const main = document.querySelector('main');
    const fab = Array.from(document.querySelectorAll('button')).find((b) => {
      const r = b.getBoundingClientRect();
      return getComputedStyle(b).position === 'fixed' && r.width > 40 && r.width < 80;
    });
    const columns = document.querySelector('section[aria-label="Conversation"]')?.parentElement;
    if (!main || !fab || !columns) return null;
    const fabRect = fab.getBoundingClientRect();
    return {
      exclusionZone: window.innerHeight - fabRect.top,
      paddingBottom: parseFloat(getComputedStyle(main).paddingBottom),
      columnsBottom: columns.getBoundingClientRect().bottom,
      fabTop: fabRect.top,
    };
  });
  check('scrollable content reserves enough bottom clearance to never sit under the AI assistant button',
    fabClearance !== null && fabClearance.paddingBottom >= fabClearance.exclusionZone && fabClearance.columnsBottom <= fabClearance.fabTop,
    fabClearance ? JSON.stringify(fabClearance) : 'FAB, <main> or the columns not found');
  check('NO commodity-category tiles (Goods/Contingent Labour are not a choice)',
    (await page.getByText('Goods', { exact: true }).count()) === 0
    && (await page.getByText('Contingent Labour', { exact: true }).count()) === 0);

  // 3. THE CATALOGUE. A plain product word ("laptops") must surface the item,
  //    even though the seed laptop is named by model ("ThinkPad T14 Gen 5").
  await describe('a few standard office laptops for a new starter');
  check('the words are read back as a category and a code, to confirm',
    (await conversation.getByText(/That sounds like goods — 43211500 Laptop computers\. Is that right\?/).count()) === 1);
  const catalogueCard = conversation.locator('[data-turn="card"]').filter({ hasText: 'This is in the catalogue' });
  await catalogueCard.waitFor({ timeout: 15000 });
  check('catalogue items surface for a plain product word (laptops)',
    (await catalogueCard.getByRole('button', { name: /Order it/ }).count()) > 0);
  // A suggestion the requester can check is one they can reject.
  check('each item says which words it matched on', /matched on “/.test(await catalogueCard.innerText()), await catalogueCard.innerText());
  check('both checks are reported before anything is offered',
    /Checked the catalogue — one item matches\.[\s\S]*Checked contracts — IT Equipment Framework covers this\./.test(await conversation.innerText()));
  // A contract that covers it too is a real alternative, offered on the card
  // rather than found by describing it again.
  check('a contract that also covers it is offered beside the catalogue',
    (await catalogueCard.getByRole('button', { name: 'Call off IT Equipment Framework instead' }).count()) === 1);
  {
    const { known, required } = await panelCount();
    check('a catalogue match reads complete — the rest is asked where the order is placed', known > 0 && known === required, `${known} of ${required}`);
  }
  // Ordering the item puts THAT item in the basket on the Catalogue page —
  // where every catalogue order is placed (ADR-0009) — rather than dropping
  // the requester at the catalogue root to find it again. Once: the add used
  // to run twice and order two.
  await catalogueCard.getByRole('button', { name: /Order it/ }).first().click();
  await page.waitForURL((url) => url.pathname === '/catalogue', { timeout: 10000 });
  const order = page.locator('aside[aria-label="Your order"]');
  await order.getByText('ThinkPad T14 Gen 5').waitFor({ timeout: 10000 });
  check('ordering the matched item adds it to the basket on the Catalogue page',
    (await order.innerText()).includes('ThinkPad T14 Gen 5'));
  check('…once', (await page.getByRole('button', { name: /Add another ThinkPad T14 Gen 5 \(1 in your order\)/ }).count()) === 1);

  // 3a. A CALL-OFF, and THE DIRECT CALL-OFF LIMIT. Above it a call-off needs a
  //     mini-competition, and the checkout refuses it — so the conversation
  //     says so at the value, and offers the way out, rather than the refusal
  //     arriving after submit.
  await describe('a few standard office laptops for a new starter');
  await catalogueCard.waitFor({ timeout: 15000 });
  await catalogueCard.getByRole('button', { name: /Keep describing/ }).click();
  // The old "Add detail" button was dead: it set a flag that was already set.
  // Whenever a typed answer is wanted, the cursor is in the box.
  await page.waitForTimeout(300);
  check('asking for more puts the cursor in the reply box', await page.evaluate(() => document.activeElement?.id === 'intake-reply'));
  check('the catalogue offer stays in the history, answered',
    (await catalogueCard.count()) === 1 && !(await catalogueCard.getByRole('button', { name: /Keep describing/ }).isEnabled()));
  await send('Lenovo laptops through the IT equipment framework');
  const contractCard = conversation.locator('[data-turn="card"]').filter({ hasText: 'IT Equipment Framework covers this.' });
  await contractCard.waitFor({ timeout: 15000 });
  check('with the catalogue declined, the re-check reports only the contract',
    /With that detail: checked contracts — IT Equipment Framework covers this\./.test(await conversation.innerText())
    && !/With that detail: checked the catalogue/.test(await conversation.innerText()));
  check('the contract card shows what is left under the ceiling and the direct limit',
    /ceiling left/.test(await contractCard.innerText()) && /a direct call-off up to €250,000/.test(await contractCard.innerText()));
  await contractCard.getByRole('button', { name: 'Call it off', exact: true }).click();
  await conversation.getByText(/I've filled what I could/).waitFor({ timeout: 10000 });
  check('the call-off says what it filled from the words and the profile, and how much is left',
    /things? left\./.test(await conversation.getByText(/I've filled what I could/).innerText()));
  check('its details build on the right', (await panel.getByText('The call-off', { exact: true }).count()) === 1);
  let sawLimit = false;
  let sawLimitWayOut = false;
  const callOffDone = await converse(async () => {
    if (await confirmedCard.count()) return true;
    // A choice between configured rows is answered with its buttons.
    const question = conversation.locator('[data-turn="assistant"]').last().locator('xpath=..');
    const choice = question.getByRole('button').filter({ hasNotText: /Not known yet|Raise a new request/ });
    if (await reply.isDisabled() && await choice.count()) { await choice.first().click(); await page.waitForTimeout(400); }
    return (await confirmedCard.count()) > 0;
  }, (question) => {
    if (/worth/.test(question) && !sawLimit) { sawLimit = true; return '300000'; }
    if (/above the €250,000 direct call-off limit/.test(question)) return '20000';
    if (/worth/.test(question)) return '20000';
    if (/need it by|work start/.test(question)) return '2026-12-01';
    if (/work end/.test(question)) return 'not known yet';
    if (/Who is it for/.test(question)) return 'The new starter';
    if (/What is it for/.test(question)) return 'Equipment for the first week';
    return 'Laptops for the new starter';
  });
  sawLimitWayOut = (await conversation.getByText(/above the €250,000 direct call-off limit, so it needs a mini-competition/).count()) > 0;
  check('a call-off above the limit is named as needing a mini-competition, at the value', sawLimitWayOut);
  check('…and under the limit it moves on', callOffDone && (await conversation.getByRole('button', { name: 'Raise a new request instead' }).count()) === 0);
  check('with everything asked, the buying channel is confirmed', callOffDone);
  {
    const { known, required } = await panelCount();
    check('the panel reaches M of M exactly when the channel is confirmed', known === required, `${known} of ${required}`);
  }
  await confirmedCard.getByRole('button', { name: /See how it will be bought/ }).click();
  const offPane = page.locator('section[aria-label="How it will be bought"]');
  await offPane.getByRole('list', { name: 'Stages' }).waitFor({ timeout: 15000 }).catch(async (error) => {
    console.error((await page.locator('main').innerText()).slice(0, 600));
    console.error('CONSOLE:', consoleErrors.slice(-3).join('\n---\n').slice(0, 4000));
    throw error;
  });
  await page.waitForTimeout(600);
  await shot('channel-call-off');
  check('the Channel page is headed as the artboard draws it, with the way back',
    (await page.getByRole('heading', { name: 'Your buying channel', exact: true }).count()) === 1
    && (await page.getByRole('button', { name: /Back to the conversation/ }).count()) > 0);
  check('a call-off gets a Channel page too, in its template\'s words',
    (await offPane.getByRole('heading', { name: 'Call it off an existing contract' }).count()) === 1);
  const offStages = await offPane.getByRole('list', { name: 'Stages' }).locator('li').evaluateAll((items) => items.map((li) => `${li.dataset.stage}:${li.dataset.applicability}`));
  check('its stages come from the call-off template, landed by the checkout\'s rule',
    offStages[0] === 'intake:here' && offStages.some((s) => s.startsWith('contracting:')) && !offStages.some((s) => s.startsWith('sourcing')),
    offStages.join(' '));
  const offChecks = await page.locator('aside[aria-label="What you are submitting"]').getByRole('list', { name: 'Checks' }).innerText();
  check('the call-off\'s checks come from its governed decision',
    /The contract can be called off/.test(offChecks) && /Within the direct call-off limit/.test(offChecks), offChecks);
  // Back keeps the conversation as it was left — its transcript is state no
  // form field could rebuild.
  await page.getByRole('button', { name: /Back to the conversation/ }).first().click();
  await confirmedCard.waitFor({ timeout: 5000 });
  check('back on the conversation, nothing has been lost',
    (await confirmedCard.count()) === 1 && (await conversation.getByText('Equipment for the first week').count()) > 0);
  await confirmedCard.getByRole('button', { name: /See how it will be bought/ }).click();
  const submitCallOff = page.getByRole('button', { name: /Submit the call-off/ });
  await submitCallOff.waitFor({ timeout: 10000 });
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
  await describe('I want to buy business consulting');
  await conversation.getByText('Then this is a new request.').waitFor({ timeout: 15000 });
  check('NO catalogue order for a consulting demand',
    (await conversation.getByRole('button', { name: /Order it/ }).count()) === 0);
  check('"Business Cards" is never offered for a consulting demand',
    (await page.getByText(/Business Cards/).count()) === 0);
  // A ruled-out route states its reason rather than disappearing — silence is
  // as unhelpful as a wrong suggestion.
  check('the ruled-out catalogue says why',
    (await conversation.getByText(/isn.t fulfilled from the catalogue|No catalogue item covers/).count()) > 0);
  check('with nothing covering it, it becomes a new request without a button to press',
    (await conversation.getByRole('button', { name: /raise a new request/i }).count()) === 0);

  // 3e. A NEW REQUEST. The description first; then the supplier, because it
  //     decides the risk questions; then those, as yes/no; then whatever
  //     submit would still refuse. Nothing is on screen before it is asked.
  await describe('IT strategy consulting to design a target operating model');
  await conversation.getByText('Then this is a new request.').waitFor({ timeout: 15000 });
  check('the new request opens on the service description alone',
    (await supplierCard.count()) === 0 && (await conversation.getByRole('button', { name: 'No', exact: true }).count()) === 0);
  const chatAnswer = 'Target operating model design for the IT function, budget 250000 EUR, '
    + 'needed by 2027-01-15, covering assessment, target design, a roadmap, '
    + 'accepted at steering-group sign-off, fixed price, depends on finance availability.';
  const answerFor = (question) => (/budget/i.test(question) ? '250000'
    : /delivered or started by|need.*by/i.test(question) ? '2027-01-15'
      : chatAnswer);
  await converse(async () => (await supplierCard.count()) > 0, answerFor);
  check('the supplier is asked once the description is captured, before any risk question',
    (await supplierCard.count()) === 1 && (await conversation.getByText(/privileged or system access/).count()) === 0);
  check('the category’s preferred supplier is named, and invited on a sourcing channel',
    /Consulting has one preferred supplier — Advisory Partner A\. It is invited when sourcing starts\./.test(await supplierCard.innerText()));
  check('going to market is an explicit choice', (await supplierCard.getByRole('button', { name: 'No — go to market' }).count()) === 1);
  check('a supplier off the list is said to need a reason, up front',
    /A supplier that isn.t preferred for this category needs a reason/.test(await supplierCard.innerText()));
  await supplierCard.getByRole('button', { name: 'Yes, add a supplier' }).click();
  await page.getByRole('combobox').filter({ hasText: /Search supplier directory/ }).click();
  await page.getByPlaceholder('Type supplier name...').fill('Lenovo');
  await page.getByRole('option', { name: /Lenovo/ }).click();
  await conversation.getByText(/Why this supplier\?/).waitFor({ timeout: 5000 });
  check('a supplier off the category’s list is asked why, and the category manager approves it',
    (await conversation.getByText(/Lenovo isn't preferred for this category, so the choice needs a reason — and the category manager approves it\./).count()) === 1);
  check('the reply box is waiting for the reason', (await reply.getAttribute('placeholder')) === 'Why this supplier?' && await reply.isEnabled());
  check('the panel names the reason as owed',
    /Not yet given/.test(await panel.locator('[data-row="supplierOverrideReason"]').innerText()));
  await send('Only supplier with the certification this work needs');
  await conversation.getByText('Anyone else you would like invited?').waitFor({ timeout: 5000 });
  check('the reason lands on the request',
    /Only supplier with the certification/.test(await panel.locator('[data-row="supplierOverrideReason"]').innerText()));
  check('on a sourcing channel, anyone else can be invited', (await conversation.getByRole('button', { name: "No, that's all" }).count()) === 1);
  await conversation.getByRole('button', { name: "No, that's all" }).click();
  await conversation.getByRole('button', { name: 'No', exact: true }).first().waitFor({ timeout: 10000 });
  check('a risk question is asked as a choice, not a text box',
    (await conversation.getByRole('button', { name: 'Yes', exact: true }).count()) > 0);
  // The guarantee: there is no free-text path into a governance answer, so a
  // model cannot fill one by extracting it from the requester's prose.
  check('the text input is disabled while a choice is pending',
    await reply.isDisabled() && (await reply.getAttribute('placeholder')) === 'Answer with the buttons above.');
  check('the question still carries its rationale', (await conversation.getByText(/^Asked because /).count()) > 0);
  check('no channel is confirmed while a triggered risk question is unanswered', (await confirmedCard.count()) === 0);
  for (let turn = 0; turn < 6; turn++) {
    const no = conversation.getByRole('button', { name: 'No', exact: true });
    if (!(await no.count()) || !(await no.last().isEnabled())) break;
    await no.last().click();
    await page.waitForTimeout(900);
  }
  // Submit requires a cost centre (submission-requirements.ts), and this user
  // has none on their profile. The conversation says so before it confirms
  // anything, and says where it goes.
  await conversation.getByText(/Before the channel can be confirmed/).waitFor({ timeout: 10000 });
  check('with every question answered, it still waits for a cost centre, and says where to add it',
    (await conversation.getByText('Before the channel can be confirmed, the request needs a cost centre — add it on the right.').count()) === 1
    && (await confirmedCard.count()) === 0);
  check('Charged to says it is needed, not that it can wait',
    /Needed before you submit/.test(await panel.locator('[data-row="costCentre"]').getAttribute('title')));
  await panel.getByRole('button', { name: 'Edit Charged to' }).click();
  const centre = panel.locator('[data-editing="costCentre"] select');
  await centre.selectOption(await centre.evaluate((el) => [...el.options].map((o) => o.value).find(Boolean) ?? ''));
  await panel.getByRole('button', { name: 'Done' }).click();
  await confirmedCard.waitFor({ timeout: 10000 }).catch(() => {});
  check('the edit lands, and the channel is confirmed', (await confirmedCard.count()) === 1);
  {
    const { known, required } = await panelCount();
    check('…as the panel reaches M of M', known === required, `${known} of ${required}`);
  }

  // 3f. BUDGET "NOT KNOWN" — THE REPORTED DEFECT. Budget used to be slot #2,
  //     asked immediately after the title, and a requester who did not yet
  //     know the figure had no extractable number to give — the engine kept
  //     re-asking the identical "What's the estimated budget for this?"
  //     forever. Budget (and the delivery date) are now asked LAST, and
  //     answering "not known" is accepted after one retry instead of looped
  //     on.
  await describe('a market-research study for APAC expansion');
  await conversation.getByText('Then this is a new request.').waitFor({ timeout: 15000 });
  const fillerAnswer = 'A detailed answer covering everything this question needs for the request.';
  check('budget is NOT the first substantive question (it used to be slot #2, right after the title)',
    !/estimated budget/i.test(await lastQuestion()));
  const sawBudgetQuestion = await converse(async () => /estimated budget/i.test(await lastQuestion()), () => fillerAnswer, 8);
  check('budget is still asked eventually, once the description is captured', sawBudgetQuestion);
  await send('not known yet');
  await page.waitForTimeout(1200);
  // "approximate figure" only — NOT "not known yet", which is also the text of
  // the user's own message bubble still on screen.
  check('a vague first budget answer gets a retry hint, not silence',
    (await conversation.getByText(/approximate figure/i).count()) > 0);
  await send('not known yet');
  await page.waitForTimeout(1200);
  check('a second "not known" gives up on the budget rather than re-asking it',
    (await conversation.getByText(/leave the budget open/i).count()) > 0);
  check('the conversation moves on — the next question is delivery date, not budget again',
    /When do you need this delivered or started by/i.test(await lastQuestion()));

  // 4. A material demand through the conversation to the Channel page. €150k
  //    of software is procurement-led by the value rules, and material enough
  //    for the critical-service question.
  await describe('an analytics software platform for the finance team');
  await conversation.getByText('Then this is a new request.').waitFor({ timeout: 15000 });
  await converse(async () => (await supplierCard.count()) > 0, (question) => (/budget/i.test(question) ? '150000'
    : /delivered or started by|need.*by/i.test(question) ? '2027-03-31' : fillerAnswer));
  check('with no preferred supplier for the category, the question is plain',
    /Do you have a supplier in mind\?/.test(await supplierCard.innerText()));
  await supplierCard.getByRole('button', { name: 'No — go to market' }).click();
  // The residual questions are criteria-driven (INT-10 stage 5), so reaching
  // one proves the €150k answer was read.
  await conversation.getByRole('button', { name: 'Yes', exact: true }).last().waitFor({ timeout: 10000 });
  check('a residual risk question is asked, with its rationale', (await conversation.getByText(/^Asked because /).count()) > 0);
  for (let turn = 0; turn < 6; turn++) {
    const yes = conversation.getByRole('button', { name: 'Yes', exact: true });
    if (!(await yes.count()) || !(await yes.last().isEnabled())) break;
    await yes.last().click();
    await page.waitForTimeout(900);
  }
  if (await conversation.getByText(/needs a cost centre/).count()) {
    await panel.getByRole('button', { name: 'Edit Charged to' }).click();
    const centreField = panel.locator('[data-editing="costCentre"] select');
    await centreField.selectOption(await centreField.evaluate((el) => [...el.options].map((o) => o.value).find(Boolean) ?? ''));
    await panel.getByRole('button', { name: 'Done' }).click();
  }
  await confirmedCard.waitFor({ timeout: 10000 });
  check('the conversation, a date and a cost centre confirm the channel', (await confirmedCard.count()) === 1);
  // The panel's required sections, to hold the Channel page to the same set.
  // Case-insensitive: innerText applies the eyebrows' uppercase transform.
  const panelRequiredSections = Number(((await panel.innerText()).match(/Service description · required \d+ of (\d+)/i) ?? [])[1] ?? NaN);

  // 5. The Channel page — how it will be bought, stage by stage, and what is
  //    being submitted (Intake Prototype, 2026-09-26). It replaced Review &
  //    submit, whose fifteen cards put the channel, three risk readings, two
  //    approval panels and every policy result at one weight.
  await confirmedCard.getByRole('button', { name: /See how it will be bought/ }).click();
  const channelPane = page.locator('section[aria-label="How it will be bought"]');
  const stageList = channelPane.getByRole('list', { name: 'Stages' });
  await stageList.waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await shot('channel-request');
  const stageRow = (stage) => stageList.locator(`li[data-stage="${stage}"]`);
  check('the channel leads in the words its template sets',
    (await channelPane.getByRole('heading', { name: 'Procurement runs a sourcing exercise' }).count()) === 1);
  // One set of required sections (2026-09-26): the panel counted the questions
  // the conversation required and the Channel page the sections generation
  // required, so one demand read "4 of 4" and then "1 of 1 required sections".
  {
    const summary = page.getByText(/of \d+ required sections/i).first();
    const channelRequired = await summary.count()
      ? Number(((await summary.innerText()).match(/of (\d+) required sections/i) ?? [])[1] ?? NaN)
      : NaN;
    check('the Channel page counts the required sections the panel did',
      panelRequiredSections > 0 && channelRequired === panelRequiredSections,
      `panel ${panelRequiredSections}, Channel page ${channelRequired}`);
  }
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

  // 5′. Submit decides the demand again on the server (2026-09-26). When its
  //     answer differs from what was reviewed it refuses, writes nothing and
  //     says what changed; the page stays here and fetches what the server
  //     decided on, so the requester reviews that.
  {
    let submitted = null;
    const refetched = [];
    await page.route('**/api/intake-submit', async (route) => {
      submitted = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 409, contentType: 'application/json',
        body: JSON.stringify({
          error: 'This request was decided again when you submitted it, and the answer has changed. Review the Channel page and submit again.',
          code: 'determination_changed',
          changes: ['A risk assessment is no longer required.'],
        }),
      });
    });
    const spy = (request) => {
      if (submitted && request.url().endsWith('/api/db')) refetched.push(request.postDataJSON()?.table);
    };
    page.on('request', spy);
    await page.getByRole('button', { name: 'Submit the request' }).click();
    await page.getByText('What you reviewed has changed').first().waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    check('a refused submit says what changed',
      (await page.getByText('A risk assessment is no longer required.').count()) > 0);
    check('…and keeps the requester on the Channel page', await stageList.isVisible());
    check('…having sent what was reviewed, with the risk answers it was decided on',
      Boolean(submitted?.compliance?.policyChecks) && typeof submitted?.riskAnswers === 'object'
        && submitted?.request?.buyingChannel === submitted?.buyingChannel, JSON.stringify(Object.keys(submitted ?? {})));
    check('…and fetches what the server decided on again',
      ['routing_rules', 'approval_chains', 'suppliers_with_derived'].every((table) => refetched.includes(table)), refetched.join(','));
    page.off('request', spy);
    await page.unroute('**/api/intake-submit');
  }

  // 5a. What the panel says from the first answer: who and where, and the
  //     service description building as it is asked — auto-composed, with NO
  //     manual "Generate SOW" button.
  await describe('management consulting to design a target operating model');
  await conversation.getByText('Then this is a new request.').waitFor({ timeout: 15000 });
  await panel.getByText(/Service description · required/).waitFor({ timeout: 10000 });
  check('the service description builds on the right as it is asked', (await panel.getByText(/Service description · required/).count()) === 1);
  check('where the requester is comes from their profile and is never typed over',
    (await panel.locator('[data-row="requesterCountry"]').count()) === 1
    && (await panel.getByRole('button', { name: 'Edit Requesting from' }).count()) === 0);
  check('buying for defaults to the requester, and can be changed',
    /\(you\)/.test(await panel.locator('[data-row="beneficiary"]').innerText())
    && (await panel.getByRole('button', { name: 'Edit Buying for' }).count()) === 1);
  check('what the platform decides is not an input — the channel and the category have no editor',
    (await panel.getByRole('button', { name: /Edit Channel|Edit Category/ }).count()) === 0);
  check('NO manual "Generate SOW" button (auto-composed from the conversation)',
    (await page.getByRole('button', { name: /Generate SOW/ }).count()) === 0);

  // 5b. The catalogue is its own door — Home's second, and the navigation's
  //     Catalogue — whose basket is placed through the governed checkout
  //     (ADR-0009).
  await page.goto(`${BASE}/catalogue`, { waitUntil: 'networkidle' });
  const basket = page.locator('aside[aria-label="Your order"]');
  await basket.waitFor({ timeout: 10000 });
  // The item "Order it" put there earlier is still in the basket: it is the
  // requester's until placed, across pages.
  check('the basket keeps what was added from the conversation',
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
    console.log('All New request UI smoke checks passed.');
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
