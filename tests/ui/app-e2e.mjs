#!/usr/bin/env node
// Full-app E2E sweep. Boots the dev server and visits every route under an
// appropriate role, capturing console errors, uncaught page errors, and
// white-screens (empty #root). Resolves :id detail routes from their lists.
//
// Reports a per-route summary. Fails on uncaught exceptions or white-screens
// (real bugs); console.errors are listed for assessment, not auto-failed.
//
// Run: npm run test:e2e-ui   (requires .env.local with Supabase creds)

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

const USERS = {
  admin: { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD' },
  supplier: { id: 'u13', name: 'David Schneider', email: 'david.schneider@accenture.com', role: 'supplier', department: 'Accenture (External)', initials: 'DS' },
};

// Static routes by role. :id detail routes resolved separately.
const ADMIN_ROUTES = [
  '/', '/requests', '/requests/my', '/requests/new', '/approvals', '/approvals/delegation',
  '/workflows', '/workflows/monitor', '/workflows/bottlenecks', '/pipeline/demand', '/pipeline/sourcing',
  '/sourcing', '/sourcing/new', '/sourcing/evaluation', '/sourcing/templates',
  '/suppliers', '/suppliers/risk', '/suppliers/messages', '/suppliers/onboarding', '/suppliers/portal-admin',
  '/contracts', '/contracts/renewals', '/contracts/templates',
  '/purchasing/orders', '/purchasing/invoices', '/purchasing/match', '/purchasing/receipt', '/purchasing/payments',
  '/analytics/spend', '/analytics/compliance', '/analytics/pipeline', '/analytics/suppliers',
  '/analytics/reports', '/analytics/reports/scheduled', '/analytics/exports',
  '/admin/rules', '/admin/thresholds', '/admin/workflows', '/admin/agents', '/admin/ai-analytics', '/admin/approvals',
  '/admin/categories', '/admin/sla-targets', '/admin/forms', '/admin/policies', '/admin/kb',
  '/admin/users', '/admin/audit', '/admin/health', '/admin/database',
  '/tasks', '/tasks/team', '/notifications', '/settings', '/help/kb', '/help/support', '/help/assistant',
];
const SUPPLIER_ROUTES = [
  '/portal', '/portal/onboarding', '/portal/invoices', '/portal/sourcing', '/portal/documents', '/portal/messages', '/portal/profile',
];
// Detail routes with a real id from each table (lists navigate via onClick, not
// anchors, so we visit detail pages directly).
const DETAIL_ROUTES = [
  '/requests/REQ-2025-0107',
  '/suppliers/SUP-001',
  '/contracts/CON-002',
  '/purchasing/orders/PO-006',
  '/sourcing/2ed9e6f4-71e1-4c9d-b5c7-13df98c40216',
];

const findings = []; // { route, pageErrors:[], consoleErrors:[], whiteScreen:bool }

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Dev server not ready');
}

async function visit(page, route) {
  const pageErrors = [];
  const consoleErrors = [];
  const onConsole = (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); };
  const onPageError = (e) => pageErrors.push(e.message.slice(0, 200));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  let whiteScreen = false;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.locator('#root *').first().waitFor({ timeout: 10000 });
    const childCount = await page.locator('#root *').count();
    whiteScreen = childCount < 3; // essentially empty
  } catch (e) {
    pageErrors.push(`navigation: ${e.message.slice(0, 150)}`);
  }
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  findings.push({ route, pageErrors, consoleErrors, whiteScreen });
}

async function sweep(browser, role, routes) {
  const context = await browser.newContext();
  await context.addInitScript(([r, u]) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: r, currentUser: u }, version: 0 }));
  }, [role, USERS[role]]);
  const page = await context.newPage();
  for (const route of routes) await visit(page, route);
  // Detail pages (admin context only) — direct navigation with real ids.
  if (role === 'admin') {
    for (const route of DETAIL_ROUTES) await visit(page, route);
  }
  await context.close();
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  await sweep(browser, 'admin', ADMIN_ROUTES);
  await sweep(browser, 'supplier', SUPPLIER_ROUTES);

  // ── Report ──
  const crashed = findings.filter((f) => f.pageErrors.length > 0);
  const white = findings.filter((f) => f.whiteScreen);
  const withConsole = findings.filter((f) => f.consoleErrors.length > 0 && f.pageErrors.length === 0);
  const skipped = findings.filter((f) => f.skipped);

  console.log(`\nRoutes visited: ${findings.length}`);
  console.log(`  clean: ${findings.length - crashed.length - white.length - withConsole.length}`);
  console.log(`  with console errors: ${withConsole.length}`);
  console.log(`  white-screen: ${white.length}`);
  console.log(`  uncaught page errors: ${crashed.length}`);
  if (skipped.length) console.log(`  skipped: ${skipped.map((s) => s.route).join(', ')}`);

  if (withConsole.length) {
    console.log('\n── Console errors (assess) ──');
    for (const f of withConsole) console.log(`  ${f.route}\n    ${f.consoleErrors.slice(0, 2).join('\n    ')}`);
  }
  if (white.length) {
    console.log('\n── WHITE SCREENS (BUG) ──');
    for (const f of white) console.log(`  ${f.route}`);
  }
  if (crashed.length) {
    console.log('\n── UNCAUGHT PAGE ERRORS (BUG) ──');
    for (const f of crashed) console.log(`  ${f.route}\n    ${f.pageErrors.slice(0, 2).join('\n    ')}`);
  }

  const bugCount = crashed.length + white.length;
  console.log(`\n${bugCount === 0 ? '✓ No crashes or white-screens.' : `✗ ${bugCount} route(s) with crashes/white-screens.`}`);
  process.exitCode = bugCount === 0 ? 0 : 1;
} catch (err) {
  console.error('E2E sweep errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
