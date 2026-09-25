#!/usr/bin/env node
// Browser smoke for the mode contract: role defaults, visible switching, and persistence.
// The REST surface is stubbed so this test never writes request or production data.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub, FIXTURES, channelTemplate } from './db-stub.mjs';

const BASE = 'http://localhost:5179';
const USER = { id: 'u6', name: "James O'Brien", email: 'james.obrien@company.com', role: 'service-owner', department: 'Marketing', initials: 'JO' };
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}
async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Dev server not ready');
}

const server = spawn('npm', ['run', 'dev', '--', '--port', '5179', '--strictPort'], {
  stdio: 'ignore', env: {
    ...process.env,
    // Keep this browser suite deterministic and independent from a developer's
    // local Neon URL. The route handoff only needs the fixture REST surface.
  },
});
let browser;
try {
  await waitForServer();
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
  check('the describe screen renders', await page.getByText('Describe what you need', { exact: true }).isVisible().catch(() => false));
  // There is no experience switch to find any more: one UI, so nothing to pick
  // before the requester can start.
  check('no experience-view switch is offered',
    (await page.locator('button[aria-label*="Experience view"]').count()) === 0);

  // A demand entered on Home is already the first intake signal, and it lands on
  // the describe step with that text ALREADY CLASSIFIED — the commodity
  // assessment is the point of that screen, not a duplicate of the home box.
  // What must never happen is being asked for the text a second time.
  const homeDemand = 'I need a new laptop for a new starter';
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  // The home demand box moved: it was on the separate Simple home page, and the
  // one home carries the smart command bar instead. The handoff it has to make
  // is the same one — the text becomes `?q=` on intake, already classified.
  await page.getByRole('textbox', { name: 'What do you need?' }).fill(homeDemand);
  await page.getByRole('textbox', { name: 'What do you need?' }).press('Enter');
  await page.waitForURL(`${BASE}/requests/new?q=${encodeURIComponent(homeDemand)}`, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  const classified = await page.getByText(/suggested commodity or service family/i)
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('home demand lands on the commodity assessment, already classified', classified);
  check('the demand text is carried, not retyped',
    (await page.getByText(homeDemand).count()) > 0);
  check('the requester is not asked for the text a second time',
    (await page.locator('#need-input').inputValue().catch(() => '')) !== ''
    || (await page.getByText(homeDemand).count()) > 0);

  await page.getByRole('button', { name: /Accept & continue/ }).click();
  // The buy-route screen only resolves when the catalogue and contract sources
  // are reachable; this suite's dev server has no serverless handlers, so it
  // legitimately reports that neither could be checked. Accept either — what is
  // asserted here is that the demand reached the route decision at all.
  const reachedRouteScreen = await Promise.race([
    page.getByText("How you'll buy this", { exact: true }).waitFor({ timeout: 15000 }).then(() => true),
    page.getByText('We could not check what already exists', { exact: true }).waitFor({ timeout: 15000 }).then(() => true),
  ]).catch(() => false);
  check('accepting the classification reaches the buy-route decision', reachedRouteScreen);
  check('the catalogue option reads its wording from the workflow template',
    await page.getByText('Configured catalogue headline', { exact: true }).isVisible().catch(() => false));
  await page.getByRole('button', { name: /^Start$|^Continue$/ }).last().click();
  check('full-request escape opens the adaptive details path', await page.getByPlaceholder('Type your answer...').isVisible().catch(() => false));
  check('full-request escape does not open catalogue selection', (await page.getByText('Choose your items', { exact: true }).count()) === 0);

  // "Browse the catalogue", then change your mind. Two defects lived on this
  // path. The shortcut stored the catalogue ROUTE as the form's CATEGORY, so
  // a later switch to a full request reached a Details step that rendered
  // nothing. And How you'll buy, reached with nothing described, claimed
  // "No catalogue item covers what was described" and "We found possible
  // coverage" — the matcher ranks contracts against an empty string.
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Browse the catalogue/ }).click();
  await page.getByRole('button', { name: /^Back$/ }).click();
  await page.getByText('Nothing has been checked yet', { exact: true }).waitFor({ timeout: 15000 }).catch(() => {});
  const emptyRoute = await page.locator('main').innerText();
  check('with nothing described, How you\'ll buy says nothing was checked',
    emptyRoute.includes('Nothing has been checked yet'));
  check('…and makes no coverage claim about an empty description',
    !/We found possible coverage|covers what was described/.test(emptyRoute), emptyRoute.slice(0, 200));

  // The category is not left behind as "catalogue": describing the need from
  // here gets the conversation, not an empty Details step.
  await page.getByRole('button', { name: /^Back$/ }).click();
  check('Back from an empty route returns to Describe',
    await page.getByText('Describe what you need', { exact: true }).isVisible({ timeout: 10000 }).catch(() => false));

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
  await chatBox.fill('I want to buy 50 monitors for the trading floor');
  await chatBox.press('Enter');
  await page.getByRole('button', { name: /Start the request/ }).waitFor({ timeout: 15000 });
  check('a demand is offered as New Request with its words', (await page.getByText('I want to buy 50 monitors for the trading floor').count()) >= 2);

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // One home for every role. A requester's default widget layout is their own
  // requests rather than KPIs, so the simplification that used to come from
  // picking "Simple" now comes from the role — without asking them to choose.
  check('home has a clear start-request entry point',
    await page.getByRole('textbox', { name: 'What do you need?' }).isVisible().catch(() => false)
      || await page.getByRole('button', { name: /New Request/i }).first().isVisible().catch(() => false));
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
  server.kill('SIGTERM');
}
console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All requester-entry browser checks passed.');
process.exit(failures === 0 ? 0 : 1);
