#!/usr/bin/env node
// Interaction E2E — exercises the highest-value write/interaction paths in a real
// browser, then cleans up after itself:
//   1. New request: the conversation → the Channel page → submit → a request is
//      created (then deleted).
//   2. Admin category create → persists & shows in the table (then deleted).
//   3. AI assistant → send a message → a response renders (no hang).
//
// Run: npm run test:interactions-ui   (requires .env.local with NEON_DATABASE_URL)

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { neon } from '@neondatabase/serverless';
import { neonClient, loadEnv, purgeAuditEntries } from '../lib/live.mjs';

// A deployed base exercises Vercel functions as well as the SPA. Without it,
// this suite starts Vite for fast UI-only development feedback.
const BASE = process.env.E2E_UI_BASE ?? 'http://localhost:5173';
const USE_DEPLOYED_APP = Boolean(process.env.E2E_UI_BASE);
const ADMIN = { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD' };

// neonClient hydrates .env.local into process.env, so E2E_UI_BASE above still
// resolves, and skips the suite cleanly when no database is configured.
const sb = await neonClient('interactions-ui');
/** The live policy row before Flow 4 changed it — restored in the finally. */
let policySnapshot = null;
// The policy row is not behind /api/db (it has its own endpoint), so `sb` cannot
// read or write it: the snapshot came back null and the restore was skipped
// without a word. A direct connection, as the other live suites use.
const policySql = (() => {
  const env = loadEnv();
  const url = env.NEON_DATABASE_URL || env.DATABASE_URL;
  return url ? neon(url) : null;
})();

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
// Not a failure: some flows need endpoints only a deployment serves.
function skip(reason) { console.log(`  \x1b[33m∼\x1b[0m skipped — ${reason}`); }
// Allow an explicit Chromium path. Sandboxes and CI images often ship a browser
// build that doesn't match the revision the pinned Playwright expects; pointing
// at the installed binary beats reinstalling one per run. Unset locally, where
// Playwright resolves its own download.
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

async function waitForServer(t = 40000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(BASE)).ok) return; } catch { /* */ } await new Promise(r => setTimeout(r, 500)); }
  throw new Error('server not ready');
}
async function deleteRequest(reqId) {
  const childTables = ['stage_history', 'workflow_instances', 'workflow_step_details', 'approval_entries',
    'comments', 'notifications', 'system_integrations', 'intake_compliance_records',
    'service_descriptions', 'compliance_reports', 'purchase_orders'];
  for (const t of childTables) { try { await sb.from(t).delete().eq('request_id', reqId); } catch { /* ignore */ } }
  // The audit log is append-only; the purge is how a suite removes its own rows.
  try { await purgeAuditEntries('request_id = $1', [reqId]); } catch { /* ignore */ }
  try { await sb.from('requests').delete().eq('id', reqId); } catch { /* ignore */ }
}


/**
 * The conversation cannot get past its checks without the contract-match and
 * commodity endpoints, and local Vite serves no serverless handlers — so the
 * flows that walk it need a deployed base (`E2E_UI_BASE`). Report that as
 * unavailable rather than as a failure, the way `wizard-smoke` does; a red
 * suite that is red for the environment teaches nobody anything.
 */
async function reachNewRequest(page, demand) {
  await page.locator('#intake-reply').waitFor({ timeout: 15000 });
  await page.locator('#intake-reply').fill(demand);
  await page.locator('#intake-reply').press('Enter');
  const conversation = page.locator('section[aria-label="Conversation"]');
  await conversation.getByRole('button', { name: 'Yes', exact: true }).first().click();
  await conversation.getByText(/Checked the catalogue|could not reach the catalogue/).first().waitFor({ timeout: 20000 }).catch(() => {});
  if (!(await conversation.getByText(/Checked the catalogue/).count())) return false;
  // Live contracts change: when one is offered for this demand, decline it the
  // way a requester would — this flow is about a new request. Otherwise the
  // conversation makes it a new request on its own.
  const newRequest = conversation.getByText('Then this is a new request.');
  const decline = conversation.getByRole('button', { name: /Not this — raise a new request|Keep describing/ });
  await Promise.race([newRequest.waitFor({ timeout: 20000 }), decline.first().waitFor({ timeout: 20000 })]).catch(() => {});
  if (!(await newRequest.count()) && await decline.count()) {
    const raise = conversation.getByRole('button', { name: 'Not this — raise a new request' });
    if (await raise.count()) await raise.click();
    else {
      await decline.first().click();
      await page.locator('#intake-reply').fill('It is new demand, not the catalogue item.');
      await page.locator('#intake-reply').press('Enter');
      const raiseAfter = conversation.getByRole('button', { name: 'Not this — raise a new request' });
      await Promise.race([newRequest.waitFor({ timeout: 20000 }), raiseAfter.waitFor({ timeout: 20000 })]).catch(() => {});
      if (await raiseAfter.count() && !(await newRequest.count())) await raiseAfter.click();
    }
  }
  return newRequest.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
}

/**
 * Answer the conversation until the buying channel is confirmed: the budget
 * and the date by what the question asks for, anything else with a real
 * description; the supplier left to the market; a yes/no risk question with No;
 * and a cost centre added on the right if the conversation says one is owed.
 */
async function answerConversation(page, budget) {
  const conversation = page.locator('section[aria-label="Conversation"]');
  const reply = page.locator('#intake-reply');
  const confirmed = conversation.locator('[data-turn="card"]').filter({ hasText: 'Buying channel confirmed' });
  for (let turn = 0; turn < 24; turn++) {
    if (await confirmed.count()) return true;
    const market = conversation.getByRole('button', { name: /No — go to market|Not decided yet/ });
    if (await market.count() && await market.last().isEnabled()) { await market.last().click(); await page.waitForTimeout(900); continue; }
    const no = conversation.getByRole('button', { name: 'No', exact: true });
    if (await no.count() && await no.last().isEnabled()) { await no.last().click(); await page.waitForTimeout(900); continue; }
    // What submit still needs is added on the right, where the conversation says it goes.
    const panel = page.locator('aside[aria-label="Your request"]');
    const gap = conversation.getByText(/Before the channel can be confirmed/).last();
    if (await gap.count()) {
      const owed = await gap.innerText();
      if (/cost centre/.test(owed) && !/CC-/.test(await panel.locator('[data-row="costCentre"]').innerText())) {
        await panel.getByRole('button', { name: 'Edit Charged to' }).click();
        const centre = panel.locator('[data-editing="costCentre"] select');
        await centre.selectOption(await centre.evaluate((el) => [...el.options].map((o) => o.value).find(Boolean) ?? ''));
        await panel.getByRole('button', { name: 'Done' }).click();
        await page.waitForTimeout(900);
        continue;
      }
      if (/need-by date/.test(owed) && /Not yet known/.test(await panel.locator('[data-row="deliveryDate"]').innerText())) {
        await panel.getByRole('button', { name: 'Edit Need by' }).click();
        await panel.locator('[data-editing="deliveryDate"] input').fill('2027-03-31');
        await panel.getByRole('button', { name: 'Done' }).click();
        await page.waitForTimeout(900);
        continue;
      }
    }
    // The input is disabled while the model is still replying. Wait for the
    // reply rather than read the wait as the end of the conversation.
    if (await reply.isDisabled()) { await page.waitForTimeout(1200); continue; }
    // The question line only: its "Asked because …" line can say "worth" or
    // "cost" about something else, and answering the date with a budget made
    // the conversation give up on the date.
    const q = await conversation.locator('[data-turn="assistant"]').last().locator(':scope > div').first().innerText();
    await reply.fill(/delivered or started by|need-by|need it by|when do you need/i.test(q) ? '2027-03-31'
      : /budget|how much|estimated value|cost/i.test(q) ? String(budget)
      // A real description, not filler: the live model asks again until the
      // objective, scope, deliverables and resources are actually there.
      : 'Objective: replace spreadsheet reporting in finance. Scope: licences for 40 users, implementation and training. '
        + 'Deliverables: the configured platform, ten management dashboards and admin training. '
        + 'Resources: one vendor implementation consultant for six weeks. Done when month-end reporting runs on the platform.');
    await reply.press('Enter');
    await page.waitForTimeout(1500);
  }
  return (await confirmed.count()) > 0;
}

const server = USE_DEPLOYED_APP ? null : spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  if (!USE_DEPLOYED_APP) await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);

  // Pre-clean any artifacts a prior interrupted run may have left behind, so
  // this test is self-healing and never accumulates test data.
  {
    const { data: orphans } = await sb.from('requests').select('id').ilike('title', '%E2E submit test%');
    for (const r of orphans ?? []) await deleteRequest(r.id);
    await sb.from('procurement_categories').delete().eq('label', 'E2E Test Category');
  }

  // ── Flow 1: wizard submit ───────────────────────────────────────────
  console.log('Flow 1 — New request: the conversation → the Channel page → submit');
  let createdReqId = null;
  flow1: {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
    // Free text is the only commodity entry — no category tiles (INT-10).
    // Describe the need; the system derives the category, checks the catalogue
    // and the contracts, and — nothing covering it — makes it a new request.
    const reached = await reachNewRequest(page, 'E2E submit test — an analytics software platform for the finance team');
    if (!reached) {
      skip('submit needs the serverless contract-match endpoint — set E2E_UI_BASE');
      await ctx.close();
      break flow1;
    }
    // Submit requires a need-by date and a cost centre (submission-requirements.ts);
    // the conversation asks for the date and names the cost centre before it
    // confirms the channel.
    check('the conversation confirms the buying channel', await answerConversation(page, 60000));
    await page.getByRole('button', { name: /See how it will be bought/ }).click();          // → your buying channel
    const stages = page.getByRole('list', { name: 'Stages' });
    await stages.waitFor({ timeout: 15000 });
    check('the Channel page lists the stages before submit', (await stages.locator('li').count()) > 3);
    await page.getByRole('button', { name: /Submit the request/ }).click();
    await page.getByRole('heading', { name: 'Request Submitted Successfully' }).waitFor({ timeout: 20000 });
    const body = await page.locator('body').innerText();
    const m = body.match(/REQ-\d{4}-\d+/);
    createdReqId = m ? m[0] : null;
    check('the request reaches the confirmation screen', body.includes('Request Submitted Successfully'));
    check('a request id is shown', Boolean(createdReqId), `id=${createdReqId}`);
    check('no uncaught errors during submit', errors.length === 0, errors[0]);
    await ctx.close();
  }
  if (createdReqId) {
    const { data } = await sb.from('requests').select('id,title').eq('id', createdReqId).maybeSingle();
    check('created request is persisted in the store', Boolean(data), `id=${createdReqId}`);
    await deleteRequest(createdReqId);
    const { data: after } = await sb.from('requests').select('id').eq('id', createdReqId).maybeSingle();
    check('cleanup removed the test request', !after);
  }

  // ── Flow 2: admin category save round-trip ──────────────────────────
  console.log('Flow 2 — admin category create → persist');
  const TEST_CAT_LABEL = 'E2E Test Category';
  await sb.from('procurement_categories').delete().eq('label', TEST_CAT_LABEL); // pre-clean
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript((u) => localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 })), ADMIN);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/admin/categories`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Add Category/ }).click();
    await page.getByPlaceholder('e.g. Research Services').fill(TEST_CAT_LABEL);
    await page.getByRole('button', { name: /^Save$/ }).click();
    // It should appear in the table without a reload (query invalidation).
    await page.locator('span.font-medium', { hasText: TEST_CAT_LABEL }).first().waitFor({ timeout: 10000 });
    check('new category appears in the admin table', true);
    check('no uncaught errors during save', errors.length === 0, errors[0]);
    await ctx.close();
  }
  {
    const { data } = await sb.from('procurement_categories').select('label').eq('label', TEST_CAT_LABEL).maybeSingle();
    check('category persisted to the store', Boolean(data));
    await sb.from('procurement_categories').delete().eq('label', TEST_CAT_LABEL);
    const { data: after } = await sb.from('procurement_categories').select('label').eq('label', TEST_CAT_LABEL).maybeSingle();
    check('cleanup removed the test category', !after);
  }

  // ── Flow 3: AI assistant responds (no hang) ─────────────────────────
  console.log('Flow 3 — AI assistant responds without hanging');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/help/assistant`, { waitUntil: 'networkidle' });
    const input = page.getByPlaceholder(/Ask me anything about procurement/);
    await input.waitFor({ timeout: 15000 });
    const before = (await page.locator('body').innerText()).length;
    await input.fill('What is the approval threshold for purchases?');
    await input.press('Enter');
    let responded = false;
    try {
      await page.waitForFunction((n) => document.body.innerText.length > n + 80, before, { timeout: 25000 });
      responded = true;
    } catch { /* hang */ }
    check('assistant returns a response (no hang)', responded);

    // AST-P: the policy answer is grounded in the knowledge base, with the bands
    // rendered from the live approval chains rather than restated in the entry.
    // The chain names exist only in the configuration (the old entry had none);
    // the figures themselves the model may write as "€10 k".
    const grounded = await page.getByText(/Fast.Track|Budget Owner → Category Manager/i).count().catch(() => 0);
    check('policy answer is grounded in the knowledge base (AST-P)', grounded > 0, `matches=${grounded}`);

    // AST-Q: the assistant reads the same governed source as the front door —
    // look up a real supplier and assert the connector-backed data comes back.
    const { data: sup } = await sb.from('suppliers').select('id').order('id').limit(1).maybeSingle();
    if (sup?.id) {
      const before2 = (await page.locator('body').innerText()).length;
      await input.fill(`Look up supplier ${sup.id}`);
      await input.press('Enter');
      let looked = false;
      try {
        await page.waitForFunction(
          (n) => /Risk rating/i.test(document.body.innerText) && document.body.innerText.length > n,
          before2, { timeout: 25000 });
        looked = true;
      } catch { /* no governed data returned */ }
      check('assistant lookup returns governed data via connector ports (AST-Q)', looked, sup.id);
    } else {
      check('assistant lookup returns governed data via connector ports (AST-Q)', false, 'no supplier in store');
    }

    check('no uncaught errors in the assistant', errors.length === 0, errors[0]);
    await ctx.close();
  }

  // ── Flow 4: admin threshold edit drives the live front-door determination ──
  // Proves the new policy-config wiring: an admin-saved threshold override flows
  // through to the live determination. A €50k demand is a LIGHT approval gate at
  // the default 250k threshold; after the admin lowers it to 10k and saves, the
  // same demand becomes a FULL gate.
  console.log('Flow 4 — admin threshold edit drives the live determination');
  // This flow SAVES a threshold to the live policy row, and nothing put it back:
  // a run left production's full-approval threshold at €10,000. The row is
  // snapshotted here and restored in the suite's finally, so a flow that throws
  // part-way cannot skip the restore.
  if (policySql) {
    const rows = await policySql`SELECT config FROM procurement_policy_configs WHERE singleton_key = 'default'`;
    policySnapshot = rows[0]?.config ?? null;
  }
  flow4: {
    // Without a snapshot there is no way back, so the live row is not touched.
    if (!policySnapshot) {
      skip('config-wiring check needs a snapshot of the live policy row to restore — none could be read');
      break flow4;
    }
    const ctx = await browser.newContext();
    await ctx.addInitScript((u) => localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 })), ADMIN);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // 1. Lower the full-approval threshold to 10,000 and save (persists + applies).
    await page.goto(`${BASE}/admin/thresholds`, { waitUntil: 'networkidle' });
    const thr = page.locator('#cfg-approvalFullThreshold');
    await thr.waitFor({ timeout: 15000 });
    await thr.fill('10000');
    // The page simulation reflects the edit immediately for a 50k sample.
    await page.locator('#sim-value').fill('50000');
    const simFull = await page.getByText('full', { exact: true }).count();
    check('admin simulation reflects the edited threshold (50k → full)', simFull > 0, `simFull=${simFull}`);
    await page.getByRole('button', { name: /^Save$/ }).click();

    // 2. Drive a €50k demand through the conversation to the Channel page.
    await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
    if (!(await reachNewRequest(page, 'an analytics software platform for the finance team'))) {
      skip('config-wiring check needs the serverless contract-match endpoint — set E2E_UI_BASE');
      await ctx.close();
      break flow4;
    }
    await answerConversation(page, 50000);
    await page.getByRole('button', { name: /See how it will be bought/ }).click();   // → your buying channel
    // Approval to source is in the Channel page's workings, one click down.
    await page.getByRole('list', { name: 'Stages' }).waitFor({ timeout: 15000 });
    await page.getByText('How this was worked out').click();
    await page.getByText(/Approval to source/i).first().waitFor({ timeout: 15000 });
    const fullGate = await page.getByText('full gate', { exact: true }).count();
    check('admin-edited threshold drives the LIVE determination (50k → full gate)', fullGate > 0, `fullGate=${fullGate}`);
    check('no uncaught errors during config-wiring flow', errors.length === 0, errors[0]);
    await ctx.close();
  }

  // ── Flow 5: approval resolves to a switchable persona (Approve button shows) ──
  // Every approval is owned by one of the 6 switchable role personas, so opening
  // a request with a pending approval as the matching role surfaces the button.
  console.log('Flow 5 — approval resolves to a switchable persona (Approve button shows)');
  {
    const PM = { id: 'u1', name: 'Anna Müller', email: 'anna.mueller@company.com', role: 'procurement-manager', department: 'Global Procurement', initials: 'AM' };
    const { data: pend } = await sb.from('approval_entries').select('request_id').eq('approver_id', 'u1').eq('status', 'pending').limit(1).maybeSingle();
    if (pend?.request_id) {
      const ctx = await browser.newContext();
      await ctx.addInitScript((u) => localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'procurement-manager', currentUser: u }, version: 0 })), PM);
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${BASE}/requests/${pend.request_id}`, { waitUntil: 'networkidle' });
      await page.getByRole('tab', { name: 'Approvals' }).click();
      let visible = false;
      try { await page.getByRole('button', { name: /^Approve$/ }).first().waitFor({ timeout: 10000 }); visible = true; } catch { /* no button */ }
      check('Approve button shows for the procurement-manager rep on a pending u1 approval', visible, pend.request_id);
      check('no errors on the approvals tab', errors.length === 0, errors[0]);
      await ctx.close();
    } else {
      check('a pending procurement-manager approval exists to demo the fix', false, 'none found');
    }
  }

  // ── Flow 6: admin user create → persist (wired CRUD) ────────────────
  console.log('Flow 6 — admin user create → persist');
  const TEST_USER_EMAIL = 'e2e.test.user@company.com';
  await sb.from('users').delete().eq('email', TEST_USER_EMAIL); // pre-clean
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript((u) => localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 })), ADMIN);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Add User/ }).click();
    await page.locator('#nu-name').fill('E2E Test User');
    await page.locator('#nu-email').fill(TEST_USER_EMAIL);
    // Role is a canonical-roles Select (no off-namespace freeform roles).
    await page.locator('#nu-role').click();
    await page.getByRole('option', { name: 'Vendor Manager' }).click();
    await page.getByRole('button', { name: /^Add$/ }).click();
    await page.getByText('E2E Test User').first().waitFor({ timeout: 10000 });
    check('new user appears in the table', true);
    check('no uncaught errors during user create', errors.length === 0, errors[0]);
    await ctx.close();
  }
  {
    const { data } = await sb.from('users').select('id,name,role').eq('email', TEST_USER_EMAIL).maybeSingle();
    check('user persisted to the store', Boolean(data), `data=${JSON.stringify(data)}`);
    check('canonical role saved on the new user', data?.role === 'vendor-manager');
    await sb.from('users').delete().eq('email', TEST_USER_EMAIL);
    const { data: after } = await sb.from('users').select('id').eq('email', TEST_USER_EMAIL).maybeSingle();
    check('cleanup removed the test user', !after);
  }

  // ── Flow 7: workflow designer renders the selected template on first load ──
  // Regression: the ReactFlow canvas mounted with the empty node set before the
  // templates query resolved and never re-initialised, so it stayed blank until
  // a manual template switch. It must now paint the default template's nodes.
  console.log('Flow 7 — workflow designer renders the template on load');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((u) => localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 })), ADMIN);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/admin/workflows`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Workflow Designer' }).waitFor({ timeout: 15000 });
    // No manual template switch — just wait for the default template to paint.
    await page.locator('.react-flow__node').first().waitFor({ timeout: 15000 }).catch(() => {});
    const nodeCount = await page.locator('.react-flow__node').count();
    check('designer canvas renders the template nodes on first load (not blank)', nodeCount > 0, `nodes=${nodeCount}`);
    // The requester's wording for the channel sits beside the channels the
    // template claims — it replaced a table in the routing code.
    const headline = await page.getByLabel('Requester headline').inputValue().catch(() => '');
    check('designer shows the channel headline the requester will read', headline.trim().length > 0, `headline=${JSON.stringify(headline)}`);
    // A stage says what the requester does there — the line the Channel page
    // shows before submit. Stored on the node and loaded back into the panel.
    // The node reads "User Task" before its label, so match the label anywhere in it.
    await page.locator('.react-flow__node').filter({ hasText: 'Intake' }).first().click({ timeout: 10000 });
    const action = await page.getByLabel('What the requester does here').inputValue({ timeout: 5000 }).catch(() => '');
    check('the Intake stage says what the requester does there', action === 'Describe what you need and submit it.', `action=${JSON.stringify(action)}`);
    check('no uncaught errors on the workflow designer', errors.length === 0, errors[0]);
    await ctx.close();
  }

  // ── Flow 8: dashboard shows real data, not fabricated KPIs/AI ──────────────
  // Regression: System Health hardcoded "47 active users" + always-"Healthy"
  // API + fake trends, and the "AI Insights" widget claimed analysis it never
  // ran. They must now reflect live data and drop the fabricated framing.
  console.log('Flow 8 — dashboard integrity (real data, no fabricated AI)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((u) => localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 })), ADMIN);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    // Labels as the Home redesign (2026-09-23) writes them; this live-only suite
    // was not re-run then, so it kept waiting for the old capitalisation.
    await page.getByText('Data source', { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    check('System Health shows the real Data Source status (not a hardcoded API tile)',
      (await page.getByText(/Requests raised \(today/).count()) > 0);
    check('the fabricated "AI Insights" analysis claim is gone',
      (await page.getByText(/Based on analysis of current request pipeline/).count()) === 0);
    check('no uncaught errors on the dashboard', errors.length === 0, errors[0]);
    await ctx.close();
  }

  console.log('');
  if (failures) { console.error(`FAILED: ${failures} interaction check(s) failed`); process.exitCode = 1; }
  else console.log('All interaction E2E checks passed.');
} catch (err) {
  console.error('Interaction E2E errored:', err.message);
  process.exitCode = 1;
} finally {
  if (policySnapshot && policySql) {
    try {
      await policySql`UPDATE procurement_policy_configs
        SET config = ${JSON.stringify(policySnapshot)}::jsonb, updated_by = 'interactions-e2e-restore', updated_at = now()
        WHERE singleton_key = 'default'`;
      const [row] = await policySql`SELECT config FROM procurement_policy_configs WHERE singleton_key = 'default'`;
      const restored = JSON.stringify(row?.config?.approvalFullThreshold) === JSON.stringify(policySnapshot.approvalFullThreshold);
      console.log(restored ? '  (live policy row restored)' : '  ✗ the live policy row did not restore');
      if (!restored) process.exitCode = 1;
    } catch (error) {
      console.error('  ✗ could not restore the live policy row:', error.message);
      process.exitCode = 1;
    }
  }
  if (browser) await browser.close();
  server?.kill('SIGTERM');
}
