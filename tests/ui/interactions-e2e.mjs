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
const ADMIN = { id: 'u6', name: 'Elena Popov', email: 'elena.popov@company.com', role: 'admin', department: 'Platform Administration', initials: 'EP' };

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
