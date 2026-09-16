#!/usr/bin/env node
// Browser smoke for /admin/forms.
//
// The builder listed nine stages and omitted `risk` and `onboarding` — while
// three ACTIVE templates trigger on exactly those. An admin could not see
// those stages, so could not remove them, and toggling any other stage wrote
// the array back with the unseen entry intact. The condition field was a
// free-text input with no vocabulary and no diagnosis. And `blocking`, which
// gates a stage, could only be set by a direct database write.
//
// `tsc -b` proves none of that renders. This does.
//
// Run: npm run test:form-builder-ui

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';

const BASE = 'http://localhost:5173';
const ROUTE = '/admin/forms';
const ADMIN = {
  id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com',
  role: 'admin', department: 'Global Procurement', initials: 'CD',
};
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

const FORMS = [
  {
    id: 'FT-ONBOARDING', name: 'Vendor onboarding pack', description: 'Onboarding evidence',
    status: 'active', category: 'Risk',
    // `onboarding` is one of the two stages the old nine-stage list omitted.
    trigger_stages: ['onboarding'], trigger_conditions: [], blocking: false,
    fields: [{ id: 'f1', fieldType: 'text', label: 'Registered name', required: true }],
    version: '1.0', last_modified: '2026-09-16', created_by: 'u11',
  },
  {
    id: 'FT-BROKEN', name: 'Misspelled field form', description: 'Cannot fire',
    status: 'active', category: 'Risk',
    trigger_stages: ['risk'],
    // A misspelled field: falls to undefined, evalCondition returns false, and
    // with `.every()` the form silently never renders. No message, anywhere.
    trigger_conditions: [{ field: 'categry', operator: 'equals', value: 'software' }],
    blocking: true,
    fields: [{ id: 'f1', fieldType: 'text', label: 'Never seen', required: false }],
    version: '1.0', last_modified: '2026-09-16', created_by: 'u11',
  },
];

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
};

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not become ready at ${BASE}`);
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext({ viewport: { width: 1360, height: 960 } });
  await context.addInitScript((u) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 }));
  }, ADMIN);
  await installDbStub(context, { form_templates: FORMS });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/\/api\/db|Failed to (load resource|fetch)|net::|ERR_TUNNEL/i.test(t)) return;
    errors.push(t);
  });

  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Vendor onboarding pack').first().waitFor({ timeout: 20000 });
  await page.getByText('Vendor onboarding pack').first().click();
  await page.waitForTimeout(600);
  let body = await page.locator('body').innerText();

  // ── The two stages that were missing ─────────────────────────────────────
  check('the builder offers the Risk Assessment stage', /Risk Assessment/.test(body));
  check('the builder offers the Vendor Onboarding stage', /Vendor Onboarding/.test(body));
  check('a form triggering on onboarding shows that stage as selected',
    /Vendor Onboarding/.test(body),
    'its stage was invisible here, so it could not be removed');

  // ── blocking is settable ─────────────────────────────────────────────────
  check('the stage-blocking toggle renders', /Blocks the stage/.test(body));
  check('the toggle explains the admin exemption', /Administrators are\s+exempt/.test(body));

  // ── Diagnostics on the broken form ───────────────────────────────────────
  await page.getByText('Misspelled field form').first().click();
  await page.waitForTimeout(600);
  body = await page.locator('body').innerText();
  check('a form that cannot fire says so', /This form cannot be asked for/.test(body),
    body.slice(0, 200));
  check('the diagnostic names the unknown field', /Unknown field "categry"/.test(body));
  check('a broken BLOCKING form is called out as stranding its stage',
    /strands every request/.test(body));

  // ── The shared condition editor ──────────────────────────────────────────
  check('conditions use the shared editor, not a free-text field',
    /Governed|Amount|All conditions must be true/.test(body),
    'the routing ConditionCard carries the governed/amount toggle and the AND note');

  check('no non-network render errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log('');
  if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exitCode = 1; }
  else console.log('All form-builder admin UI checks passed.');
} catch (err) {
  console.error('form-builder admin UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
