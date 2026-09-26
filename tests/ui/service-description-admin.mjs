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

import { chromium } from 'playwright';
import { devServer } from './dev-server.mjs';

const server = devServer('5209');
const BASE = server.base;
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

let browser;
try {
  await server.start();
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

  // The built-in guidance was invisible here while the help said empty "uses the
  // built-in"; it is shown in the empty field and can be taken to edit.
  const guidance = page.locator('#sd-category-guidance');
  check('an empty guidance field shows the built-in text',
    ((await guidance.getAttribute('placeholder')) ?? '').includes('Deliverables'));
  await page.getByRole('button', { name: 'Edit the built-in text' }).click();
  check('…and "Edit the built-in text" puts it in the field',
    (await guidance.inputValue()).includes('Deliverables'));

  // The residual risk questions were literals in code; each category can word them.
  check('the risk questions can be worded, with the standard text shown',
    ((await page.locator('#sd-risk-privileged-access').getAttribute('placeholder')) ?? '').includes('privileged or system access'));

  // Weights that do not total 100 block publishing in the sourcing wizard, so
  // the total is shown here where it is edited rather than discovered later.
  check('criteria weights show a running total',
    (await page.getByText(/Total/).count()) > 0);

  // A condition the evaluator cannot act on must LOOK broken.
  //
  // Both failure modes are silent on screen: an unimplemented operator returns
  // false, so the slot is simply never asked, and a field nothing supplies
  // compares against undefined, so it is never asked either. Neither renders
  // differently from a question that legitimately does not apply. The built-in
  // template is healthy, so a stored row carrying the defect is stubbed in.
  check('a healthy template shows no diagnostics banner',
    (await page.getByText(/can never hold/).count()) === 0);

  await page.route('**/api/db', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    if (body.table !== 'service_description_templates' || body.operation !== 'select') {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{
        category: 'default',
        label: 'Default',
        active: true,
        // `greater_than` is the routing vocabulary's operator, not this
        // evaluator's — exactly the mistake an admin moving between the two
        // config screens would make.
        slots: [{
          id: 'timeline', targetKind: 'sow', targetField: 'timeline', required: false,
          prompt: 'When?',
          conditions: [{ field: 'value', operator: 'greater_than', value: '1000' }],
        }],
        sections: [{ id: 'objective', label: 'Objective', asked: true }],
        narrative_sections: ['objective'],
        sourcing_requirement_sections: [],
        default_criteria: [],
      }], error: null }),
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Service Description', { exact: true }).first().waitFor({ timeout: 20000 });
  const banner = page.getByText(/can never hold/);
  check('an unusable condition is reported on the screen that collects it',
    (await banner.count()) > 0);
  check('the banner names the operator rather than saying "invalid"',
    /greater_than/.test(await page.locator('body').innerText()));

  // A category with no row of its own runs the STORED default, so that is what
  // its editor must show. It showed the built-in from code — which stopped
  // being what ran once the default row was stored (2026-09-25) and edited.
  await page.route('**/api/db', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    if (body.table !== 'procurement_categories' || body.operation !== 'select') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [
      { id: 'consulting', label: 'Consulting', description: '', active: true, sort_order: 1, catalogue_eligible: false },
    ], error: null }) });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Service Description', { exact: true }).first().waitFor({ timeout: 20000 });
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Consulting — inherits default/ }).click();
  await page.getByText(/Consulting has no configuration of its own/).waitFor({ timeout: 10000 });
  const values = await page.locator('input, textarea').evaluateAll((els) => els.map((el) => el.value));
  check('a category without a row shows the stored default it inherits',
    values.includes('When?'), values.filter(Boolean).slice(0, 5).join(' | '));

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
  server.stop();
}
