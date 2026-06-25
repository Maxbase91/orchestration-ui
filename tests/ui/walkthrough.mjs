#!/usr/bin/env node
// Hands-on walkthrough harness — drives the REAL app in a browser and captures
// a screenshot at every key screen so a human (or Claude) can eyeball behaviour.
// Front door is exercised across several distinct scenarios; the other tabs are
// visited under the admin role. Console/page errors are collected per step.
//
// Screenshots → /tmp/fd/NN-name.png. Run: node tests/ui/walkthrough.mjs

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const DIR = '/tmp/fd';
mkdirSync(DIR, { recursive: true });

let n = 0;
const log = (m) => console.log(m);
async function shot(page, name) {
  const file = `${DIR}/${String(++n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  log(`  📸 ${file}`);
  return file;
}

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
}

const errors = [];
function attachErrorCapture(page, tag) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url ?? '';
    if (/\/api\//.test(url) && /Failed to load resource/.test(m.text())) return; // expected in dev
    errors.push(`[${tag}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
}

// Drive the staged pre-check to the full-request step. Returns true if it reached it.
async function toFullRequest(page, demand, enrichment) {
  await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
  await page.locator('#need-input').fill(demand);
  await page.locator('#need-input').press('Enter');
  await page.getByRole('button', { name: /Accept & continue/ }).click();
  await page.getByText('Catalogue check', { exact: true }).waitFor({ timeout: 15000 });
  await page.locator('textarea').first().fill(enrichment);
  await page.getByRole('button', { name: /Check for a covering contract/ }).click();
  await page.getByText('Contract check', { exact: true }).waitFor({ timeout: 15000 }).catch(() => {});
  const proceed = page.getByRole('button', { name: /Proceed to full request/ });
  await proceed.first().waitFor({ timeout: 8000 });
  await proceed.first().click();
  return true;
}

// The full-request step is the dynamic demand CONVERSATION — answer each
// question (value first) until the wizard's Next button unlocks.
async function answerChat(page, answers) {
  const input = page.getByPlaceholder('Type your answer...');
  const next = page.getByRole('button', { name: /^Next$/ });
  for (const ans of answers) {
    if (await next.isEnabled().catch(() => false)) break;
    await input.waitFor({ timeout: 8000 });
    await input.fill(ans);
    await input.press('Enter');
    await new Promise((r) => setTimeout(r, 900));
  }
  await new Promise((r) => setTimeout(r, 500));
}

// Walk a full-request demand through conversation → risk → determination → routing.
async function fullScenario(page, { key, demand, enrichment, answers, toggleCritical }) {
  log(`\n▶ Front door — ${key}`);
  try {
    await toFullRequest(page, demand, enrichment);
    await page.getByText('Service description components').waitFor({ timeout: 15000 }).catch(() => {});
    await answerChat(page, answers);
    await shot(page, `${key}-1-conversation`);
    const next = page.getByRole('button', { name: /^Next$/ });
    await next.click();                                                      // → risk
    await page.getByText('Mini risk questionnaire').waitFor({ timeout: 15000 });
    if (toggleCritical) await page.locator('#mini-irq-critical').click();
    await shot(page, `${key}-2-risk`);
    await page.getByRole('button', { name: /^Next$/ }).click();              // → determination
    await page.getByText('Buying Channel Classification', { exact: true }).waitFor({ timeout: 15000 });
    await shot(page, `${key}-3-determination`);
    await page.getByRole('button', { name: /^Next$/ }).click();              // → routing
    await page.getByText('Workflow Preview', { exact: true }).waitFor({ timeout: 15000 });
    // Let the config queries (template + approval chains) resolve before the shot:
    // a base lifecycle stage proves the template loaded; a "Step N" badge proves
    // the approval chain resolved.
    await page.getByText('Validation', { exact: true }).waitFor({ timeout: 15000 })
      .catch(() => log('  ⚠ base lifecycle stages did NOT load (workflow template empty?)'));
    await page.getByText(/^Step 1$/).waitFor({ timeout: 10000 })
      .catch(() => log('  ⚠ approval chain did NOT resolve (no approvers shown)'));
    await new Promise((r) => setTimeout(r, 400));
    await shot(page, `${key}-4-routing`);
    log(`  ✓ ${key} reached routing`);
  } catch (e) {
    log(`  ✗ ${key} failed: ${e.message}`);
    await shot(page, `${key}-ERROR`);
  }
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin' }, version: 0 }));
  });
  const page = await context.newPage();
  attachErrorCapture(page, 'frontdoor');

  // ── FRONT DOOR ────────────────────────────────────────────────────────────
  // Scenario A: catalogue fast-track (single-click order, no risk/determination).
  log('\n▶ Front door — A: catalogue fast-track');
  try {
    await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Browse the catalogue/ }).click();
    await page.getByText('Browse Catalogues').waitFor({ timeout: 10000 });
    await shot(page, 'A-1-catalogue-grid');
    await page.getByRole('button', { name: /IT Equipment/ }).first().click();
    await page.getByRole('button', { name: /^Add$/ }).first().click();
    await shot(page, 'A-2-cart');
    await page.getByRole('button', { name: /Place Order/ }).first().click();
    await page.getByText('Request Submitted Successfully').waitFor({ timeout: 15000 });
    await shot(page, 'A-3-confirmation');
    log('  ✓ A placed a catalogue order in one click');
  } catch (e) { log(`  ✗ A failed: ${e.message}`); await shot(page, 'A-ERROR'); }

  // Scenario B: full request — consulting "promptathon", mid value (VP-Level band),
  // no supplier → dynamic Risk + Vendor onboarding steps on the routing lifecycle.
  await fullScenario(page, {
    key: 'B-promptathon', demand: 'I need consultants for a promptathon',
    enrichment: 'a 2-day facilitated promptathon to upskill ~40 staff on AI tooling',
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
    enrichment: '24x7 managed SOC covering EMEA, multi-year, supports a critical service',
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
    enrichment: 'a one-day advisory workshop, single facilitator, no data access',
    toggleCritical: false,
    answers: ['6000', 'a one-day advisory workshop on procurement strategy',
      'in: one facilitated workshop; out: implementation', 'workshop materials and a short summary',
      'a single facilitator', 'one day next month', 'sign-off on the summary', 'fixed fee'],
  });

  // Scenario E: the pre-check itself — what the contract check surfaces for a renewal.
  log('\n▶ Front door — E: pre-check (renewal → contract check screen)');
  try {
    await page.goto(`${BASE}/requests/new`, { waitUntil: 'networkidle' });
    await page.locator('#need-input').fill('renew our existing vendor contract for another year');
    await page.locator('#need-input').press('Enter');
    await page.getByRole('button', { name: /Accept & continue/ }).click();
    await page.getByText('Catalogue check', { exact: true }).waitFor({ timeout: 15000 });
    await shot(page, 'E-1-catalogue-check');
    await page.locator('textarea').first().fill('annual renewal of an existing vendor engagement, EMEA');
    await page.getByRole('button', { name: /Check for a covering contract/ }).click();
    await page.getByText('Contract check', { exact: true }).waitFor({ timeout: 15000 }).catch(() => {});
    await shot(page, 'E-2-contract-check');
    log('  ✓ E captured the staged pre-check');
  } catch (e) { log(`  ✗ E failed: ${e.message}`); await shot(page, 'E-ERROR'); }

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
    } catch (e) { log(`  ✗ ${name} failed: ${e.message}`); }
  }

  log('\n────────────────────────────────────');
  log(`Screenshots: ${n} in ${DIR}`);
  if (errors.length) {
    log(`\n⚠ Console/page errors (${errors.length}):`);
    for (const e of errors.slice(0, 20)) log(`   ${e}`);
  } else {
    log('\n✓ No console/page errors during the walkthrough.');
  }
} catch (err) {
  console.error('Walkthrough errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
