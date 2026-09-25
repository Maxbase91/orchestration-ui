#!/usr/bin/env node
// Two Admin items that ran on something other than stored configuration.
//
// 1. Service description. `service_description_templates` was empty, so the
//    intake questions, generation and the sourcing seeds all ran on the
//    built-in template in code: the admin page showed it, and nothing in the
//    database did. The built-in is stored as the `default` row. Fill-only — a
//    default row an admin has already saved is left alone. From here on the
//    stored row is what runs; a later change to the built-in reaches a
//    deployment through an admin edit or a backfill, not by being in the code.
//
// 2. Forms. FORM-001 Risk Assessment Triage and FORM-007 Goods Receipt
//    Confirmation (both disabled on 2026-09-12: the intake triage and the
//    goods-receipt record do their jobs) and FORM-008 Change Request (a draft
//    on seven stages that never rendered) are deleted with their seeded
//    submissions. `form_submissions` has no foreign key to `form_templates`,
//    so the submissions go first, by template id. Only while each is still
//    switched off: a form an admin has made active since is left alone.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:service-description-and-forms   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { DEFAULT_TEMPLATE } from '../../src/lib/procurement/service-description-defaults.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('service description and forms'));
let changed = 0;

// ── 1. The built-in template as the stored default ─────────────────────────
// A function or undefined in the template would vanish in JSON and store a
// different template than the one that runs; refuse rather than store it.
const serialised = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
if (JSON.stringify(serialised) !== JSON.stringify(DEFAULT_TEMPLATE)) {
  console.error('The built-in template does not survive JSON — not storing it.');
  process.exit(1);
}
const [existing] = await sql`SELECT category FROM service_description_templates WHERE category = 'default'`;
if (existing) {
  console.log('Service description: a default row is stored already — left alone.');
} else {
  console.log('Service description: storing the built-in template as the default row.');
  changed += 1;
  if (!DRY) {
    const t = DEFAULT_TEMPLATE;
    await sql`
      INSERT INTO service_description_templates
        (category, label, active, system_prompt, category_guidance, temperature, max_tokens,
         slots, sections, narrative_sections, sourcing_requirement_sections, default_criteria,
         risk_question_wording, updated_by)
      VALUES
        ('default', ${t.label}, ${t.active}, ${t.systemPrompt}, ${t.categoryGuidance}, ${t.temperature}, ${t.maxTokens},
         ${JSON.stringify(t.slots)}::jsonb, ${JSON.stringify(t.sections)}::jsonb, ${t.narrativeSections},
         ${t.sourcingRequirementSections}, ${JSON.stringify(t.defaultCriteria)}::jsonb,
         ${JSON.stringify(t.riskQuestionWording ?? {})}::jsonb, 'backfill:2026-09-25')
      ON CONFLICT (category) DO NOTHING`;
  }
}

// ── 2. The three forms nothing renders ─────────────────────────────────────
const RETIRED = ['FORM-001', 'FORM-007', 'FORM-008'];
const forms = await sql`SELECT id, name, status FROM form_templates WHERE id = ANY(${RETIRED})`;
for (const form of forms) {
  if (form.status === 'active') {
    console.log(`Forms: ${form.id} ${form.name} is active — an admin switched it on; left alone.`);
    continue;
  }
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM form_submissions WHERE form_template_id = ${form.id}`;
  console.log(`Forms: deleting ${form.id} ${form.name} (${form.status}) and its ${count} submission(s).`);
  changed += 1;
  if (!DRY) {
    await sql`DELETE FROM form_submissions WHERE form_template_id = ${form.id}`;
    await sql`DELETE FROM form_templates WHERE id = ${form.id} AND status <> 'active'`;
  }
}

console.log(changed === 0 ? '\nNothing to change.' : `\n${changed} change(s)${DRY ? ' (dry run — nothing written)' : ''}.`);
