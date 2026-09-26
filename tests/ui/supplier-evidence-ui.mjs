#!/usr/bin/env node
// Browser check: a supplier's screening, risk assessment and onboarding are
// recorded only on evidence (2026-09-26), run against the stubbed database.
//
// The Risk tab's "Approve risk" wrote screening clear and the SRA valid with
// nothing behind either, and reset a completed supplier's onboarding; the
// onboarding pipeline completed a supplier nobody had screened and dropped the
// note it asked for. This drives both screens and reads what they wrote.
//
// Run: npm run test:supplier-evidence-ui   (no credentials, no network)

import { chromium } from 'playwright';
import { installDbStub } from './db-stub.mjs';
import { devServer } from './dev-server.mjs';

const server = devServer('5186');
const BASE = server.base;
const LAUNCH_OPTS = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const ADMIN = { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD' };

let failures = 0;
let ran = false;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}

const iso = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const supplierRow = (id, name, over) => ({
  id, name, country: 'Ireland', country_code: 'IE', risk_rating: 'medium', onboarding_status: 'in-progress',
  sra_status: 'not-assessed', screening_status: 'pending', categories: ['services'], tier: 2,
  duns: '', address: '', primary_contact: '', primary_contact_email: '', certifications: [], spend_history: [],
  performance_score: 70, ...over,
});
// Written to `suppliers`, read from `suppliers_with_derived`: the stub keeps the
// two apart, so each fixture is in both.
const SUPPLIERS = [
  supplierRow('SUP-EVD-1', 'Evidence Supplier One', {}),
  supplierRow('SUP-EVD-2', 'Screened Supplier', { screening_status: 'clear', screening_reference: 'Case 12', screening_date: iso(-10) }),
  supplierRow('SUP-EVD-3', 'Unscreened Supplier', {}),
];
const assessment = (id, over) => ({
  id, title: `${id} assessment`, subject_type: 'supplier', supplier_id: 'SUP-EVD-1', category: 'operational',
  risk_level: 'low', score: 12, status: 'completed', assessor_id: 'u11', assessor_name: 'Christine Dupont',
  assessed_at: iso(-30), valid_until: iso(300), summary: '', mitigations: [], reusable: true, linked_request_ids: [], ...over,
});
const OVERRIDES = {
  suppliers: SUPPLIERS,
  suppliers_with_derived: SUPPLIERS.map((s) => ({ ...s, active_contracts_live: 0, total_spend_12m_live: 0 })),
  risk_assessments: [
    assessment('RSK-EVD-1', {}),
    assessment('RSK-EVD-2', { valid_until: iso(-2) }),
    assessment('RSK-EVD-3', { status: 'draft' }),
    assessment('RSK-EVD-4', { supplier_id: 'SUP-OTHER' }),
  ],
  audit_entries: [],
};

let browser;
try {
  await server.start({ timeoutMs: 45000 });
  browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const stub = await installDbStub(context, OVERRIDES);
  await context.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ state: { currentRole: 'admin', currentUser: user }, version: 0 }));
  }, ADMIN);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const supplier = (id) => stub.tables.suppliers.find((s) => s.id === id);
  const audits = (action) => stub.tables.audit_entries.filter((a) => a.action === action);

  console.log('\nThe Risk tab records a screening only with its reference');
  await page.goto(`${BASE}/suppliers/SUP-EVD-1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Risk & Compliance' }).click();
  const screeningCard = page.getByTestId('record-screening');
  await screeningCard.waitFor({ timeout: 20000 });
  check('there is no "Approve risk" any more', (await page.getByRole('button', { name: /Approve risk|Refer back/ }).count()) === 0);
  const recordButton = screeningCard.getByRole('button', { name: 'Record screening' });
  check('recording waits for a reference', await recordButton.isDisabled());
  await screeningCard.getByLabel('Reference').fill('Screening provider · case 4471');
  await recordButton.click();
  await page.waitForTimeout(900);
  const afterScreening = supplier('SUP-EVD-1');
  check('the result and its evidence are written',
    afterScreening.screening_status === 'clear' && afterScreening.screening_reference === 'Screening provider · case 4471'
      && /^\d{4}-\d{2}-\d{2}$/.test(afterScreening.screening_date ?? ''), JSON.stringify(afterScreening));
  check('…and onboarding is left as it was', afterScreening.onboarding_status === 'in-progress');
  check('…and the SRA is left as it was', afterScreening.sra_status === 'not-assessed');
  check('the record is in the audit log, with who and on what',
    audits('supplier.screening-recorded').length === 1 && /case 4471/.test(audits('supplier.screening-recorded')[0]?.detail ?? '')
      && audits('supplier.screening-recorded')[0]?.user_id === ADMIN.id);

  console.log('\nThe SRA stands on a completed, in-date assessment of this supplier');
  const linkCard = page.getByTestId('link-assessment');
  const options = await linkCard.locator('select option').allInnerTexts();
  check('only the completed, in-date assessment of this supplier is offered',
    options.some((o) => o.startsWith('RSK-EVD-1')) && !options.some((o) => /RSK-EVD-[234]/.test(o)), options.join(' | '));
  await linkCard.locator('select').selectOption('RSK-EVD-1');
  await linkCard.getByRole('button', { name: 'Link assessment' }).click();
  await page.waitForTimeout(900);
  const afterLink = supplier('SUP-EVD-1');
  check('the SRA takes the assessment’s validity and id',
    afterLink.sra_status === 'valid' && afterLink.sra_assessment_id === 'RSK-EVD-1' && afterLink.sra_expiry_date === iso(300),
    JSON.stringify(afterLink));
  check('the link is in the audit log', audits('supplier.sra-linked').length === 1);

  console.log('\nOnboarding completes on a clear screening, and keeps its note');
  await page.goto(`${BASE}/suppliers/onboarding`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Screened Supplier').first().waitFor({ timeout: 20000 });
  const unscreened = page.locator('div.rounded-md').filter({ hasText: 'Unscreened Supplier' }).last();
  check('an unscreened supplier cannot be completed, and says why',
    /Needs a clear screening on record/.test(await unscreened.innerText())
      && (await unscreened.getByRole('button', { name: 'Complete' }).count()) === 0);
  const screened = page.locator('div.rounded-md').filter({ hasText: 'Screened Supplier' }).filter({ hasNotText: 'Unscreened' }).last();
  await screened.getByLabel('Completion note for Screened Supplier').fill('Bank details and insurance verified');
  await screened.getByRole('button', { name: 'Complete' }).click();
  await page.waitForTimeout(900);
  check('a screened supplier completes', supplier('SUP-EVD-2').onboarding_status === 'completed');
  check('the note is kept in the audit log',
    audits('supplier.onboarding-completed').some((a) => a.detail === 'Bank details and insurance verified' && a.object_id === 'SUP-EVD-2'));
  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  ran = true;
} catch (error) {
  console.error('supplier evidence UI smoke errored:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.stop();
}

console.log('');
if (!ran) {
  console.error('FAILED: the suite did not reach its assertions.');
  process.exitCode = 1;
} else if (failures) {
  console.error(`FAILED: ${failures} check(s)`);
  process.exitCode = 1;
} else {
  console.log('All supplier-evidence UI checks passed.');
}
