#!/usr/bin/env node
// Interaction E2E — exercises the highest-value write/interaction paths in a real
// browser, then cleans up after itself:
//   1. New-request wizard → submit → a request is created (then deleted).
//   2. Admin category create → persists & shows in the table (then deleted).
//   3. AI assistant → send a message → a response renders (no hang).
//
// Run: npm run test:interactions-ui   (requires .env.local with Supabase creds)

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:5173';
const ADMIN = { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD' };

const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
for (const l of raw.split('\n')) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const sb = createClient(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
async function waitForServer(t = 40000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(BASE)).ok) return; } catch { /* */ } await new Promise(r => setTimeout(r, 500)); }
  throw new Error('server not ready');
}
async function deleteRequest(reqId) {
  const childTables = ['stage_history', 'workflow_instances', 'workflow_step_details', 'approval_entries',
    'comments', 'notifications', 'audit_entries', 'system_integrations', 'intake_compliance_records',
    'service_descriptions', 'compliance_reports', 'purchase_orders'];
  for (const t of childTables) { try { await sb.from(t).delete().eq('request_id', reqId); } catch { /* ignore */ } }
  try { await sb.from('requests').delete().eq('id', reqId); } catch { /* ignore */ }
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch();

  // Pre-clean any artifacts a prior interrupted run may have left behind, so
  // this test is self-healing and never accumulates test data.
  {
    const { data: orphans } = await sb.from('requests').select('id').ilike('title', '%E2E submit test%');
    for (const r of orphans ?? []) await deleteRequest(r.id);
    await sb.from('procurement_categories').delete().eq('label', 'E2E Test Category');
  }

  // ── Flow 1: wizard submit ───────────────────────────────────────────
  console.log('Flow 1 — new-request wizard → submit');
  let createdReqId = null;
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
    // Free text is the only commodity entry — no category tiles (INT-10).
    // Describe the need; the system derives the category.
    await page.locator('#need-input').fill('renew our existing vendor contract for another year');
    await page.locator('#need-input').press('Enter');
    await page.getByRole('button', { name: /Accept & continue/ }).click();
    // Staged funnel: catalogue (no match) → enrich → contract (no match) → proceed.
    await page.getByText('Catalogue check', { exact: true }).waitFor({ timeout: 15000 });
    await page.locator('textarea').first().fill('annual renewal of an existing vendor engagement');
    await page.getByRole('button', { name: /Check for a covering contract/ }).click();
    await page.getByRole('button', { name: /Proceed to full request/ }).click();
    await page.locator('#title').fill('E2E submit test');
    await page.locator('#value').fill('60000');
    await page.getByRole('button', { name: /Next/ }).click();          // → step 4 (risk)
    await page.getByText('Mini risk questionnaire').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /Next/ }).click();          // → step 5 (determination)
    await page.getByText('Buying Channel Classification', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /Next/ }).click();          // → step 6 (routing)
    await page.getByRole('button', { name: /Submit Request/ }).click();
    await page.getByRole('heading', { name: 'Request Submitted Successfully' }).waitFor({ timeout: 20000 });
    const body = await page.locator('body').innerText();
    const m = body.match(/REQ-\d{4}-\d+/);
    createdReqId = m ? m[0] : null;
    check('wizard reaches the confirmation screen', body.includes('Request Submitted Successfully'));
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

    // AST-P: the policy answer is grounded in the knowledge base, not generic.
    const grounded = await page.getByText(/delegated authority|€10,000/i).count().catch(() => 0);
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
  {
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

    // 2. Drive a €50k demand through the wizard to the determination.
    await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
    await page.locator('#need-input').fill('renew our existing vendor contract for another year');
    await page.locator('#need-input').press('Enter');
    await page.getByRole('button', { name: /Accept & continue/ }).click();
    await page.getByText('Catalogue check', { exact: true }).waitFor({ timeout: 15000 });
    await page.locator('textarea').first().fill('annual renewal of an existing vendor engagement');
    await page.getByRole('button', { name: /Check for a covering contract/ }).click();
    await page.getByRole('button', { name: /Proceed to full request/ }).click();
    await page.locator('#title').fill('Config wiring test');
    await page.locator('#value').fill('50000');
    await page.getByRole('button', { name: /Next/ }).click();   // → step 4 risk
    await page.getByRole('button', { name: /Next/ }).click();   // → step 5 determination
    await page.getByText('Approval to source', { exact: true }).waitFor({ timeout: 15000 });
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
    await page.getByText('Data Source', { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    check('System Health shows the real Data Source status (not a hardcoded API tile)',
      (await page.getByText(/Requests \(today/).count()) > 0);
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
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
