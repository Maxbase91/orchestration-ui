#!/usr/bin/env node
// Retire the side processes and the renewal / onboarding categories.
//
// WF-003 (supplier onboarding) and WF-004 (contract renewal) never ran — no
// request or instance ever named either. Onboarding is the Vendor Onboarding
// stage inside a request when the supplier is new; a renewal comes in through
// Door 1 and the contract check finds the expiring contract.
//
// "Contract renewal" and "Supplier onboarding" were demand categories. They
// are set INACTIVE, not deleted: four requests carry them, and an inactive row
// keeps their label and managers while no longer being offered at intake.
// The category option in the Full Risk Questionnaire (FORM-002) goes.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:retire-side-processes   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('retire side processes'));
const RETIRED = ['contract-renewal', 'supplier-onboarding'];
let changed = 0;

for (const wf of ['WF-003', 'WF-004']) {
  const [t] = await sql`SELECT id FROM workflow_templates WHERE id = ${wf}`;
  if (!t) { console.log(`= ${wf} already gone`); continue; }
  const [{ n }] = await sql`SELECT (SELECT count(*) FROM requests WHERE workflow_template_id = ${wf}) + (SELECT count(*) FROM workflow_instances WHERE template_id = ${wf}) AS n`;
  if (Number(n) > 0) throw new Error(`${wf} is referenced by ${n} row(s); not deleting`);
  console.log(`- ${wf}`);
  changed += 1;
  if (!DRY) await sql`DELETE FROM workflow_templates WHERE id = ${wf}`;
}

for (const id of RETIRED) {
  const [c] = await sql`SELECT active FROM procurement_categories WHERE id = ${id}`;
  if (!c) { console.log(`= category ${id} not present`); continue; }
  if (c.active === false) { console.log(`= category ${id} already inactive`); continue; }
  console.log(`~ category ${id} → inactive`);
  changed += 1;
  if (!DRY) await sql`UPDATE procurement_categories SET active = false WHERE id = ${id}`;
}

const forms = await sql`SELECT id, fields FROM form_templates WHERE fields::text ~ 'contract-renewal|supplier-onboarding'`;
for (const f of forms) {
  const fields = (f.fields ?? []).map((field) => (Array.isArray(field.options)
    ? { ...field, options: field.options.filter((o) => !RETIRED.includes(o?.value)) }
    : field));
  console.log(`~ ${f.id}: retired categories removed from its options`);
  changed += 1;
  if (!DRY) await sql`UPDATE form_templates SET fields = ${JSON.stringify(fields)}::jsonb WHERE id = ${f.id}`;
}
if (forms.length === 0) console.log('= no form offers a retired category');

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
