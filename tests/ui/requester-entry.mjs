#!/usr/bin/env node
// Browser smoke for the mode contract: role defaults, visible switching, and persistence.
// The REST surface is stubbed so this test never writes request or production data.
import { chromium } from 'playwright';
import { installDbStub, FIXTURES, channelTemplate } from './db-stub.mjs';
import { devServer } from './dev-server.mjs';

const server = devServer('5179');
const BASE = server.base;
const USER = { id: 'u6', name: "James O'Brien", email: 'james.obrien@company.com', role: 'service-owner', department: 'Marketing', initials: 'JO' };
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}
let browser;
try {
  await server.start();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext();
  // The stub used to intercept `**/rest/v1/**`, the PostgREST path from before
  // the Neon cutover. The client posts to /api/db, so it caught nothing: every
  // data call 404'd and the pre-check screen rendered its heading over no
  // catalogue and no contracts. Two checks here failed for months on that.
  // A catalogue template carrying admin-written wording, so the buy-route
  // screen is checked to read it (Admin → Workflows) rather than a code table.
  await installDbStub(context, {
    workflow_templates: [
      ...FIXTURES.workflow_templates,
      channelTemplate('WF-002', 'catalogue', 'Configured catalogue headline', 'Configured catalogue description.'),
    ],
    // The Home intent step: the status agent at its defaults, one request of
    // this requester's and one of someone else's, and a linked policy entry.
    ai_agents: [{ id: 'AI-007', name: 'Status Answers', type: 'status', status: 'active', accuracy: 0, decisions_made: 0, last_updated: '2026-09-25', description: '', config: null }],
    requests: [
      ...FIXTURES.requests,
      { ...FIXTURES.requests[0], id: 'REQ-2026-00077', title: 'Team offsite venue', status: 'approval', requestor_id: 'u6', owner_id: 'u11' },
      { ...FIXTURES.requests[0], id: 'REQ-2026-00078', title: 'Someone else’s demand', status: 'validation', requestor_id: 'u02', owner_id: 'u11' },
    ],
    knowledge_base: [{ id: 'KB-014', title: 'Single Source Justification', body: 'Buying without competition from {{policy:competitiveSourcingThreshold}} needs a single-source justification.', source: 'Decisioning thresholds', tags: ['quotes', 'competitive', 'single source'] }],
    // Door 2: two catalogues, two suppliers, each with its contract and a
    // valid risk assessment — so a basket across them is two orders.
    suppliers: [
      ...FIXTURES.suppliers,
      { ...FIXTURES.suppliers[0], id: 'SUP-CAT-002', name: 'OfficeCo' },
    ],
    contracts: [
      ...FIXTURES.contracts,
      { ...FIXTURES.contracts[0], id: 'CON-CAT-002', title: 'Office Supplies Agreement', supplier_id: 'SUP-CAT-002', supplier_name: 'OfficeCo' },
    ],
    // The directory and the register are read through their derived views.
    suppliers_with_derived: [
      ...(FIXTURES.suppliers_with_derived ?? FIXTURES.suppliers),
      { ...(FIXTURES.suppliers_with_derived ?? FIXTURES.suppliers)[0], id: 'SUP-CAT-002', name: 'OfficeCo' },
    ],
    contracts_with_derived: [
      ...(FIXTURES.contracts_with_derived ?? FIXTURES.contracts),
      { ...(FIXTURES.contracts_with_derived ?? FIXTURES.contracts)[0], id: 'CON-CAT-002', title: 'Office Supplies Agreement', supplier_id: 'SUP-CAT-002', supplier_name: 'OfficeCo' },
    ],
    risk_assessments: [
      ...FIXTURES.risk_assessments,
      { ...FIXTURES.risk_assessments[0], id: 'RSK-CAT-002', supplier_id: 'SUP-CAT-002', contract_id: 'CON-CAT-002', title: 'OfficeCo assessment' },
    ],
    catalogue_items: [
      { id: 'IT-002', name: 'Monitor 27-inch', description: 'Business monitor', unit_price: 449, unit: 'each', catalogue_id: 'it-equipment', catalogue_name: 'IT Equipment', supplier_name: 'Lenovo', supplier_id: 'SUP-CAT-001', contract_id: 'CON-CAT-001', risk_assessment_id: 'RSK-CAT-001', lead_time: '3-5 days', available: true },
      { id: 'OS-001', name: 'Copier paper A4, 5 reams', description: 'Copier paper 80gsm', unit_price: 24, unit: 'box', catalogue_id: 'office-supplies', catalogue_name: 'Office Supplies', supplier_name: 'OfficeCo', supplier_id: 'SUP-CAT-002', contract_id: 'CON-CAT-002', risk_assessment_id: 'RSK-CAT-002', lead_time: '2-3 days', available: true },
    ],
  });
  // The basket goes to the governed checkout's basket mode; its real rules are
  // test:catalogue-basket's. Here the page's half: what it sends, and what it
  // shows when the orders come back.
  let placedBasket = null;
  await context.route('**/api/governed-checkout', async (route) => {
    placedBasket = JSON.parse(route.request().postData() ?? '{}').basket ?? null;
    const orders = (placedBasket?.orders ?? []).map((order, index) => ({
      requestId: `REQ-2026-0910${index}`, requisition: { id: order.requisitionId, status: 'pending-approval' }, lines: order.lines,
    }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ orders }) });
  });
  // The pre-check also calls the server matcher directly. "No contract covers
  // this" is a legitimate answer and is what sends the screen to its contract
  // stage — but it has to be the real ContractMatchResponse shape
  // (src/data/types.ts), because the screen maps `candidates` unguarded.
  await context.route('**/api/contract-match', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        sufficient: false, route: 'full-request',
        missingFields: [], questions: [], candidates: [],
      }),
    });
  });
  await context.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'service-owner', currentUser: user }, version: 0 }));
  }, USER);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // Vite serves the SPA but not Vercel serverless functions. Those expected
    // local API 404s are intentionally ignored; uncaught React/runtime errors
    // remain failures.
    if (/Failed to load resource|\/api\//i.test(message.text())) return;
    errors.push(message.text());
  });

  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  check('the conversation page renders, asking what is needed',
    await page.getByText(/What do you need\? Say it in your own words/).isVisible().catch(() => false));
  // There is no experience switch to find any more: one UI, so nothing to pick
  // before the requester can start.
  check('no experience-view switch is offered',
    (await page.locator('button[aria-label*="Experience view"]').count()) === 0);

  // A demand entered on Home is already the first intake signal: it arrives as
  // the conversation's first message, ALREADY CLASSIFIED — "That sounds like …
  // Is that right?" is the point of that turn, not a duplicate of the home box.
  // What must never happen is being asked for the text a second time.
  const homeDemand = 'I need a new laptop for a new starter';
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  // The home demand box moved: it was on the separate Simple home page, and the
  // one home carries the smart command bar instead. The handoff it has to make
  // is the same one — the text becomes `?q=` on intake, already classified.
  await page.getByRole('textbox', { name: 'What do you need?' }).fill(homeDemand);
  await page.getByRole('textbox', { name: 'What do you need?' }).press('Enter');
  // Every outcome is a card first — a demand too — so the requester sees how
  // it was read before anything opens (Intake Prototype).
  const understood = page.getByTestId('home-answer');
  await understood.getByText('Something to buy').waitFor({ timeout: 15000 });
  check('a demand is understood as something to buy, and nothing opens yet',
    new URL(page.url()).pathname === '/' && (await understood.getByText(/checks? the catalogue and existing contracts first/).count()) === 1);
  await understood.getByRole('button', { name: /Start the request/ }).click();
  await page.waitForURL(`${BASE}/requests/new?q=${encodeURIComponent(homeDemand)}`, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  const conversation = page.locator('section[aria-label="Conversation"]');
  const classified = await conversation.getByText(/That sounds like .* Is that right\?/)
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('the home demand arrives as the first message, already classified', classified);
  check('the demand text is carried, not retyped', (await conversation.getByText(homeDemand, { exact: true }).count()) === 1);
  check('the requester is not asked for the text a second time',
    (await page.locator('#intake-reply').inputValue()) === '' && (await conversation.getByText(/What do you need\? Say it in your own words/).count()) === 0);

  await conversation.getByRole('button', { name: 'Yes', exact: true }).first().click();
  // The server matcher answers "no contract covers this" here (the route above),
  // and no catalogue item is a laptop — so the demand becomes a new request on
  // its own, and the service description starts.
  const reachedNewRequest = await conversation.getByText('Then this is a new request.')
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('confirming the classification reaches the route decision', reachedNewRequest);
  check('the new request opens on the service description, not on catalogue selection',
    (await page.locator('#intake-reply').getAttribute('placeholder')) === 'Type your answer…'
    && (await page.getByText('Choose your items', { exact: true }).count()) === 0);

  // A catalogue offer is headed in the catalogue template's own words
  // (Admin → Workflows), not a line in code.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#intake-reply').fill('a 27-inch monitor for my desk');
  await page.locator('#intake-reply').press('Enter');
  await conversation.getByRole('button', { name: 'Yes', exact: true }).first().click();
  const catalogueCard = conversation.locator('[data-turn="card"]').filter({ hasText: 'This is in the catalogue' });
  await catalogueCard.waitFor({ timeout: 15000 }).catch(() => {});
  check('the catalogue offer reads its wording from the workflow template',
    (await catalogueCard.getByText('Configured catalogue headline', { exact: true }).count()) === 1
    && (await catalogueCard.getByText(/Configured catalogue description\./).count()) === 1);

  // The catalogue is its own door: the Catalogue page, where catalogue items
  // are ordered without a request (ADR-0009) — Home's second door, and the
  // navigation's Catalogue.
  // The navigation's entries are buttons, not links.
  await page.locator('aside, nav').getByRole('button', { name: 'Catalogue', exact: true }).first().click();
  await page.waitForURL((url) => url.pathname === '/catalogue', { timeout: 10000 });
  check('the navigation\u2019s Catalogue opens the Catalogue page', new URL(page.url()).pathname === '/catalogue');

  console.log('\nDoor 2 — the Catalogue page');
  const catalogues = page.getByRole('navigation', { name: 'Catalogues' });
  await catalogues.getByRole('button', { name: /IT Equipment/ }).waitFor({ timeout: 15000 });
  check('the catalogues are the ones the items belong to',
    (await catalogues.getByRole('button').allInnerTexts()).map((t) => t.split('\n')[0]).join(' | ') === 'IT Equipment | Office Supplies');
  await page.getByRole('button', { name: 'Add Monitor 27-inch' }).click();
  await catalogues.getByRole('button', { name: /Office Supplies/ }).click();
  await page.getByRole('button', { name: 'Add Copier paper A4, 5 reams' }).click();
  const order = page.locator('aside[aria-label="Your order"]');
  check('two suppliers are two orders, approved on the whole basket',
    (await order.getByText(/Placed as 2 orders — one per supplier/).count()) === 1, await order.innerText());
  check('under the threshold it becomes a purchase order straight away',
    (await order.getByText(/becomes a purchase order straight away — no approval needed/).count()) === 1, await order.innerText());
  await order.getByRole('button', { name: 'One more Monitor 27-inch' }).click();
  await order.getByRole('button', { name: 'One more Monitor 27-inch' }).click();
  check('over it, it is approved first — judged on the basket, €1,371',
    (await order.getByText(/Over €1,000, so it is approved before the purchase order is raised/).count()) === 1 && (await order.innerText()).includes('€1,371'));
  const place = order.getByRole('button', { name: 'Place order' });
  check('an order waits for its purpose', !(await place.isEnabled()));
  await order.getByLabel('Deliver to').selectOption('office');
  await order.getByLabel('Charged to').selectOption('CC-ENG-001');
  await order.getByLabel('What is it for?').fill('New starters, Berlin office');
  await place.click();
  await order.getByText('2 orders placed').waitFor({ timeout: 10000 });
  check('the basket is sent as one call with two orders, each decided on the total',
    placedBasket?.orders?.length === 2 && placedBasket.orders.every((o) => o.checkout.approvalBasisValue === 1371 && o.checkout.purpose === 'New starters, Berlin office'),
    JSON.stringify(placedBasket?.orders?.map((o) => o.checkout.approvalBasisValue)));
  check('each placed order is named, with what happens next',
    (await order.getByText('Waiting for approval').count()) === 2);
  check('the basket is emptied once placed', (await order.getByText(/Add items from the catalogue/).count()) === 1);

  console.log('\nHome answers policy and status questions in place');
  const homeBox = page.getByRole('textbox', { name: 'What do you need?' });
  const homeAnswer = page.getByTestId('home-answer');
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await homeBox.fill('do I need three quotes for a €40,000 order?');
  await homeBox.press('Enter');
  await homeAnswer.waitFor({ timeout: 15000 });
  check('a policy question is answered on Home, not sent to intake',
    page.url() === `${BASE}/` && (await homeAnswer.getByText('A policy question').count()) === 1);
  check('the answer is computed from the thresholds',
    (await homeAnswer.getByText(/^Yes\. At €40,000 you need at least 3 competitive quotes/).count()) === 1, await homeAnswer.innerText());
  check('it names where the figures came from', (await homeAnswer.getByText(/From: Decisioning thresholds — competitive sourcing €25,000, 3 quotes/).count()) === 1);
  await homeBox.fill('where is REQ-2026-00077?');
  await homeBox.press('Enter');
  await homeAnswer.getByText('A status question').waitFor({ timeout: 15000 });
  check('a status question about your own request is answered',
    (await homeAnswer.getByText('REQ-2026-00077 · Team offsite venue').count()) === 1 && (await homeAnswer.getByText('Stage', { exact: true }).count()) === 1,
    await homeAnswer.innerText());
  await homeBox.fill('where is REQ-2026-00078?');
  await homeBox.press('Enter');
  await homeAnswer.getByText(/that you can see/).waitFor({ timeout: 15000 });
  check('someone else’s request is not confirmed to exist',
    (await homeAnswer.getByText('No request REQ-2026-00078 that you can see.').count()) === 1);
  await page.getByRole('button', { name: 'Clear' }).click();
  check('clearing brings back the example questions', (await page.getByRole('button', { name: "what's waiting for me?" }).count()) === 1);
  await page.getByRole('button', { name: "what's waiting for me?" }).click();
  await homeAnswer.getByText(/Nothing is waiting on you|Approvals waiting on you/).waitFor({ timeout: 15000 });
  check('the example questions answer too', (await homeAnswer.getByText('A status question').count()) === 1);

  // The assistant takes the same route (lib/assistant/question-route.ts). It
  // had a router of its own, so the same question got a card on Home and the
  // model's paraphrase — or a guess — in the chat.
  console.log('\nThe assistant answers the way the Home box does');
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  const chatBox = page.getByRole('textbox', { name: 'Message the assistant' });
  await chatBox.waitFor({ timeout: 15000 });
  await chatBox.fill('where is REQ-2026-00077?');
  await chatBox.press('Enter');
  const chatStatus = page.getByTestId('chat-status-answer');
  await chatStatus.waitFor({ timeout: 15000 });
  check('a status question in the chat gets the status card',
    (await chatStatus.getByText('REQ-2026-00077 · Team offsite venue').count()) === 1, await chatStatus.innerText());
  // Every thread read "New conversation": the title was set only when the
  // conversation existed before the first message, which is what creates it.
  check('the conversation is named by the question that started it',
    (await page.getByRole('button', { name: 'where is REQ-2026-00077?' }).count()) === 1);
  await chatBox.fill('do I need three quotes for a €40,000 order?');
  await chatBox.press('Enter');
  const chatPolicy = page.getByTestId('chat-policy-answer');
  await chatPolicy.waitFor({ timeout: 15000 });
  check('a policy question gets the answer computed from the thresholds',
    (await chatPolicy.getByText(/^Yes\. At €40,000 you need at least 3 competitive quotes/).count()) === 1, await chatPolicy.innerText());
  // Something the catalogue cannot serve — a monitor would be offered from it.
  await chatBox.fill('I want to buy a market research study for the trading floor');
  await chatBox.press('Enter');
  await page.getByRole('button', { name: /Start the request/ }).waitFor({ timeout: 15000 });
  check('a demand is offered as New Request with its words', (await page.getByText('I want to buy a market research study for the trading floor').count()) >= 2);

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // One home for every role. A requester's default widget layout is their own
  // requests rather than KPIs, so the simplification that used to come from
  // picking "Simple" now comes from the role — without asking them to choose.
  check('home has a clear start-request entry point',
    await page.getByRole('textbox', { name: 'What do you need?' }).isVisible().catch(() => false)
      || await page.getByRole('button', { name: /New Request/i }).first().isVisible().catch(() => false));
  check('Home offers the catalogue as the second door',
    (await page.getByRole('region', { name: 'Catalogue' }).getByRole('link', { name: /Browse the catalogue/ }).count()) === 1);
  check('home shows the requester their own work',
    (await page.locator('main').innerText()).toLowerCase().includes('request'));
  await page.setViewportSize({ width: 320, height: 800 });
  // The dashboard starts background query refreshes, so networkidle is not a
  // stable readiness signal once the REST surface is stubbed.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const menuButton = page.getByRole('button', { name: 'Open navigation' });
  check('mobile navigation exposes a labelled menu button', await menuButton.isVisible().catch(() => false));
  // The half this suite never checked: the drawer must be SHUT until opened.
  // cn() merged `hidden` away, so the sidebar was always on screen and the
  // "opens the drawer" check below passed against a drawer that never closed.
  check('the sidebar is hidden until the menu is opened',
    (await page.locator('aside').evaluate((el) => getComputedStyle(el).display).catch(() => '')) === 'none');
  await menuButton.click({ force: true, timeout: 3000 });
  const drawerText = await page.locator('aside nav').innerText().catch(() => '');
  check('mobile navigation opens the drawer with labels', drawerText.includes('Requests'), drawerText.slice(0, 120));
  check('320px viewport has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('no uncaught browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await context.close();
} catch (error) {
  console.error(`requester-entry-ui errored: ${error.message}`);
  failures++;
} finally {
  if (browser) await browser.close();
  server.stop();
}
console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All requester-entry browser checks passed.');
process.exit(failures === 0 ? 0 : 1);
