#!/usr/bin/env node
// Browser smoke for /admin/service-description.
//
// The service description config is the one admin surface that four different
// runtimes read — the generation route, the intake conversation, the sourcing
// seed and the risk form pre-populate — so a screen that fails to render is a
// governance hole, not a cosmetic one. `tsc -b` and `npm run build` cannot
// catch that; this can.
//
// Deliberately narrow and offline-tolerant: it asserts the four configuration
// areas mount and the editor stands in with the built-in template when the
// stored row cannot be read. That last case is the normal one in a sandbox
// where the database is unreachable, and it is exactly the behaviour the page
// promises — resolution falls back to the built-in everywhere else, so the
// editor must show what would actually run rather than a spinner.
//
// Run: npm run test:service-description-ui

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const ROUTE = '/admin/service-description';

// Only an admin may reach /admin/*; the route guard redirects everyone else to
// the dashboard. Seed the same auth store shape tests/ui/app-e2e.mjs uses.
const ADMIN = {
  id: 'u11',
  name: 'Christine Dupont',
  email: 'christine.dupont@company.com',
  role: 'admin',
  department: 'Global Procurement',
  initials: 'CD',
};

const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures++;
    console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not become ready at ${BASE} within ${timeoutMs}ms`);
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext();
  await context.addInitScript((u) => {
    localStorage.setItem(
      'auth',
      JSON.stringify({ state: { currentRole: 'admin', currentUser: u }, version: 0 }),
    );
  }, ADMIN);
  const page = await context.newPage();

  // Network errors are expected and ignored: the database is unreachable from the
  // sandbox. Anything else is a real render fault.
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/\/api\/db|Failed to (load resource|fetch)|net::|ERR_TUNNEL/i.test(text)) return;
    pageErrors.push(text);
  });

  // domcontentloaded, not networkidle: with the database unreachable the network
  // never settles, so a networkidle wait can only ever time out here.
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Service Description', { exact: true }).first().waitFor({ timeout: 20000 });

  check('admin reaches the route (not bounced by the role guard)', page.url().endsWith(ROUTE));

  // The four things the screen configures, in the order the page presents them.
  check('generation prompt section renders',
    (await page.getByText('Generation prompt', { exact: true }).count()) > 0);
  check('components-asked section renders',
    (await page.getByText('Components asked at intake', { exact: true }).count()) > 0);
  check('generated-output section renders',
    (await page.getByText('What is generated', { exact: true }).count()) > 0);
  check('downstream-reuse section renders',
    (await page.getByText('Reuse in later steps', { exact: true }).count()) > 0);

  // The editor must not block on the read — see the header comment.
  check('editor stands in with the built-in rather than a spinner',
    (await page.getByText(/Loading configuration/).count()) === 0);

  // The assembled prompt is what actually reaches the model; a config screen
  // that hides it makes the admin guess at the effect of their edits.
  const preview = page.getByText('Preview the assembled prompt');
  check('assembled prompt is previewable', (await preview.count()) > 0);
  await preview.first().click();
  const previewText = await page.locator('pre').first().innerText();
  check('preview resolves the placeholders (no raw {{guidance}} left)',
    previewText.length > 100 && !previewText.includes('{{guidance}}'),
    previewText.slice(0, 80));

  // Weights that do not total 100 block publishing in the sourcing wizard, so
  // the total is shown here where it is edited rather than discovered later.
  check('criteria weights show a running total',
    (await page.getByText(/Total/).count()) > 0);

  check('no non-network render errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  console.log('');
  if (failures) {
    console.error(`FAILED: ${failures} check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('All service-description admin UI checks passed.');
  }
} catch (err) {
  console.error('service-description admin UI smoke errored:', err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
