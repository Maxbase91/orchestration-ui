#!/usr/bin/env node
// Hands-on walkthrough harness — drives the REAL app in a browser and captures
// a screenshot at every key screen so a human (or Claude) can eyeball behaviour.
// Front door is exercised across several distinct scenarios; the other tabs are
// visited under the admin role. Console/page errors are collected per step.
//
// Screenshots → /tmp/fd/NN-name.png. Run: node tests/ui/walkthrough.mjs

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { devServer } from './dev-server.mjs';

const USE_DEPLOYED_APP = Boolean(process.env.E2E_UI_BASE);
const server = USE_DEPLOYED_APP ? null : devServer('5210');
const BASE = server ? server.base : process.env.E2E_UI_BASE;
const DIR = '/tmp/fd';
mkdirSync(DIR, { recursive: true });

let n = 0;
const log = (m) => console.log(m);
// Allow an explicit Chromium path. Sandboxes and CI images often ship a browser
// build that doesn't match the revision the pinned Playwright expects; pointing
// at the installed binary beats reinstalling one per run. Unset locally, where
// Playwright resolves its own download.
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

async function shot(page, name) {
  const file = `${DIR}/${String(++n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  log(`  📸 ${file}`);
  return file;
}

const errors = [];
let failures = 0;
function attachErrorCapture(page, tag) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url ?? '';
    if (/\/api\//.test(url) && /Failed to load resource/.test(m.text())) return; // expected in dev
    errors.push(`[${tag}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
}

// Say what is needed, confirm how it was read, and wait for the catalogue and
// contract checks — the conversation's first two phases.
async function describe(page, demand) {
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  const reply = page.locator('#intake-reply');
  await reply.fill(demand);
  await reply.press('Enter');
  const conversation = page.locator('section[aria-label="Conversation"]');
  await conversation.getByRole('button', { name: 'Yes', exact: true }).first().click();
  await conversation.getByText(/Checked the catalogue|could not reach the catalogue/).first().waitFor({ timeout: 15000 });
  return conversation;
}

// A new request's conversation, to "Buying channel confirmed": the value and a
// date where those are asked, the scenario's descriptions in order otherwise;
// the supplier left to the market; every risk question answered the same way;
// and what submit still needs added on the right.
async function toConfirmed(page, conversation, [value, ...descriptions], { answerRiskYes = false } = {}) {
  const reply = page.locator('#intake-reply');
  const panel = page.locator('aside[aria-label="Your request"]');
  const confirmed = conversation.locator('[data-turn="card"]').filter({ hasText: 'Buying channel confirmed' });
  const queue = [...descriptions];
  for (let turn = 0; turn < descriptions.length + 16; turn++) {
    if (await confirmed.count()) return true;
    const market = conversation.getByRole('button', { name: /No — go to market|Not decided yet/ });
    if (await market.count() && await market.last().isEnabled()) { await market.last().click(); await new Promise((r) => setTimeout(r, 900)); continue; }
    const choice = conversation.getByRole('button', { name: answerRiskYes ? 'Yes' : 'No', exact: true });
    if (await choice.count() && await choice.last().isEnabled()) { await choice.last().click(); await new Promise((r) => setTimeout(r, 900)); continue; }
    const gap = conversation.getByText(/Before the channel can be confirmed/).last();
    if (await gap.count()) {
      const owed = await gap.innerText();
      if (/cost centre/.test(owed) && !/CC-/.test(await panel.locator('[data-row="costCentre"]').innerText())) {
        await panel.getByRole('button', { name: 'Edit Charged to' }).click();
        const centre = panel.locator('[data-editing="costCentre"] select');
        await centre.selectOption(await centre.evaluate((el) => [...el.options].map((o) => o.value).find(Boolean) ?? ''));
        await panel.getByRole('button', { name: 'Done' }).click();
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      if (/need-by date/.test(owed) && /Not yet known/.test(await panel.locator('[data-row="deliveryDate"]').innerText())) {
        await panel.getByRole('button', { name: 'Edit Need by' }).click();
        await panel.locator('[data-editing="deliveryDate"] input').fill('2027-03-31');
        await panel.getByRole('button', { name: 'Done' }).click();
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
    }
    if (await reply.isDisabled()) { await new Promise((r) => setTimeout(r, 900)); continue; }
    // The question line only: its "Asked because …" line can mention a value
    // or a date while asking about something else.
    const q = await conversation.locator('[data-turn="assistant"]').last().locator(':scope > div').first().innerText();
    await reply.fill(/delivered or started by|need-by|need it by|when do you need/i.test(q) ? '2027-03-31'
      : /budget|how much|estimated value|cost/i.test(q) ? value
        : queue.shift() ?? descriptions[descriptions.length - 1]);
    await reply.press('Enter');
    await new Promise((r) => setTimeout(r, 1000));
  }
  return (await confirmed.count()) > 0;
}

// Walk a demand through the conversation to the Channel page. Nothing is
// submitted: this harness can run against the deployed app.
async function fullScenario(page, { key, demand, detail, answers, toggleCritical }) {
  log(`\n▶ Front door — ${key}`);
  try {
    const conversation = await describe(page, demand);
    // Until it is a new request: the one detail a contract match asks for, and
    // — this scenario being a new request — a live contract's offer declined.
    const newRequest = conversation.getByText('Then this is a new request.');
    for (let step = 0; step < 4 && !(await newRequest.count()); step++) {
      const raise = conversation.getByRole('button', { name: 'Not this — raise a new request' });
      const asked = conversation.getByText(/^One detail decides it/);
      await Promise.race([newRequest.waitFor({ timeout: 15000 }), raise.waitFor({ timeout: 15000 }), asked.waitFor({ timeout: 15000 })]).catch(() => {});
      if (await raise.count() && await raise.isEnabled()) { await raise.click(); continue; }
      if (await asked.count() && await page.locator('#intake-reply').isEnabled()) {
        await shot(page, `${key}-0-one-detail`);
        await page.locator('#intake-reply').fill(detail);
        await page.locator('#intake-reply').press('Enter');
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    await newRequest.waitFor({ timeout: 15000 });
    if (!(await toConfirmed(page, conversation, answers, { answerRiskYes: toggleCritical }))) throw new Error('the channel was never confirmed');
    await shot(page, `${key}-1-conversation`);
    await page.getByRole('button', { name: /See how it will be bought/ }).click();          // → your buying channel
    // Let the config queries resolve before the shot: the stage list proves the
    // template loaded; an approvals line in the checks proves the chain did.
    await page.getByRole('list', { name: 'Stages' }).waitFor({ timeout: 15000 })
      .catch(() => log('  ⚠ the stages did NOT load (no template claims the channel?)'));
    await page.getByRole('list', { name: 'Checks' }).getByText(/approval/i).first().waitFor({ timeout: 10000 })
      .catch(() => log('  ⚠ the approvers did NOT resolve'));
    await new Promise((r) => setTimeout(r, 400));
    await shot(page, `${key}-2-channel`);
    log(`  ✓ ${key} reached the Channel page`);
  } catch (e) {
    failures++;
    log(`  ✗ ${key} failed: ${e.message}`);
    await shot(page, `${key}-ERROR`);
  }
}

let browser;
try {
  await server?.start({ timeoutMs: 60000 });
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin' }, version: 0 }));
  });
  const page = await context.newPage();
  attachErrorCapture(page, 'frontdoor');

  // ── FRONT DOOR ────────────────────────────────────────────────────────────
  // Scenario A: a catalogue match — offered in the conversation, ordered on the
  // Catalogue page. Stops at the basket: placing it would write an order.
  log('\n▶ Front door — A: catalogue match');
  try {
    const conversation = await describe(page, 'printer paper and toner for the office');
    const card = conversation.locator('[data-turn="card"]').filter({ hasText: 'This is in the catalogue' });
    await card.waitFor({ timeout: 15000 });
    await shot(page, 'A-1-catalogue-offer');
    await card.getByRole('button', { name: /Order it/ }).first().click();
    await page.locator('aside[aria-label="Your order"]').waitFor({ timeout: 10000 });
    await shot(page, 'A-2-basket');
    log('  ✓ A offered the catalogue item and put it in the basket');
  } catch (e) { failures++; log(`  ✗ A failed: ${e.message}`); await shot(page, 'A-ERROR'); }

  // Scenario B: full request — consulting "promptathon", mid value (VP-Level band),
  // no supplier → dynamic Risk + Vendor onboarding steps on the routing lifecycle.
  await fullScenario(page, {
    key: 'B-promptathon', demand: 'I need consultants for a promptathon',
    detail: 'a 2-day facilitated promptathon to upskill ~40 staff on AI tooling, in September',

    toggleCritical: false,
    answers: ['120000', 'run a 2-day promptathon to upskill 40 staff on AI tooling',
      'in: facilitation, materials and coaching; out: tooling licences',
      'agenda, facilitated sessions and a written-up set of prototypes',
      'a lead facilitator and two AI specialists', 'a 2-day event in September, prep 3 weeks before',
      '40 staff trained, >80% satisfaction, 3 prototypes built', 'fixed price'],
  });

  // Scenario C: full request — high value + critical service → Board-Level band,
  // full approval-to-source gate, critical inherent risk.
  await fullScenario(page, {
    key: 'C-highvalue-critical', demand: 'managed security operations service for the EMEA region',
    detail: '24x7 managed SOC covering EMEA, multi-year, about €600k, supports a critical service',

    toggleCritical: true,
    answers: ['600000', 'stand up a 24x7 managed SOC for the EMEA region',
      'in: monitoring, triage and response; out: remediation tooling',
      'SOC runbooks, monthly reporting and incident response', 'a SOC lead and tiered analysts',
      'multi-year engagement, onboarding over 8 weeks', '99.9% availability, MTTR targets met',
      'monthly subscription', 'depends on the SIEM and log sources'],
  });

  // Scenario D: full request — low value → Fast-Track band (single approver).
  await fullScenario(page, {
    key: 'D-lowvalue', demand: 'a short advisory workshop on procurement strategy',
    detail: 'a one-day advisory workshop for the procurement team next month, about €6k',

    toggleCritical: false,
    answers: ['6000', 'a one-day advisory workshop on procurement strategy',
      'in: one facilitated workshop; out: implementation', 'workshop materials and a short summary',
      'a single facilitator', 'one day next month', 'sign-off on the summary', 'fixed fee'],
  });

  // Scenario E: the checks themselves — what the catalogue and contract checks
  // say for a renewal.
  log('\n▶ Front door — E: the checks for a renewal');
  try {
    await describe(page, 'renew our existing vendor contract for another year');
    await new Promise((r) => setTimeout(r, 800));
    await shot(page, 'E-1-checks');
    log('  ✓ E captured the catalogue and contract checks');
  } catch (e) { failures++; log(`  ✗ E failed: ${e.message}`); await shot(page, 'E-ERROR'); }

  // ── OTHER TABS (admin role) ─────────────────────────────────────────────────
  const TABS = [
    ['dashboard', '/'],
    ['requests', '/requests'],
    ['approvals', '/approvals'],
    ['workflows', '/workflows'],
    ['workflows-monitor', '/workflows/monitor'],
    ['suppliers', '/suppliers'],
    ['suppliers-risk', '/suppliers/risk'],
    ['contracts', '/contracts'],
    ['purchasing-orders', '/purchasing/orders'],
    ['analytics-spend', '/analytics/spend'],
    ['admin-thresholds', '/admin/thresholds'],
    ['admin-workflows', '/admin/workflows'],
    ['admin-categories', '/admin/categories'],
    ['admin-approvals', '/admin/approvals'],
    ['admin-agents', '/admin/agents'],
    ['admin-forms', '/admin/forms'],
    ['admin-kb', '/admin/kb'],
    ['admin-users', '/admin/users'],
    ['admin-database', '/admin/database'],
  ];
  for (const [name, route] of TABS) {
    log(`\n▶ Tab — ${name} (${route})`);
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.locator('#root *').first().waitFor({ timeout: 10000 });
      await new Promise((r) => setTimeout(r, 800)); // settle async data
      await shot(page, `tab-${name}`);
    } catch (e) { failures++; log(`  ✗ ${name} failed: ${e.message}`); }
  }

  log('\n────────────────────────────────────');
  log(`Screenshots: ${n} in ${DIR}`);
  if (errors.length) {
    log(`\n⚠ Console/page errors (${errors.length}):`);
    for (const e of errors.slice(0, 20)) log(`   ${e}`);
  } else {
    log('\n✓ No console/page errors during the walkthrough.');
  }
  if (failures) process.exitCode = 1;
} catch (err) {
  console.error('Walkthrough errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server?.stop();
}
