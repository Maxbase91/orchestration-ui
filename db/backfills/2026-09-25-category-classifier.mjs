#!/usr/bin/env node
// Categories carry the classifier: keywords, and an order that is precedence.
//
// The keyword classifier was a regex list in lib/procurement/classify.ts; it
// is each category's `classification_keywords` now, matched at the start of a
// word, and the category order (sort_order) is the precedence — the first
// category whose keywords match wins. The AI classifier's prompt is built from
// each category's label and description, so the seeded descriptions are the
// fuller ones the prompt used to carry in code.
//
// Only what an admin has not changed: keywords are filled where empty; a
// description is replaced only while it is still the original seeded text; the
// order is set only while it is still the original display order.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:category-classifier   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('category classifier'));
let changed = 0;

// The descriptions as first seeded, so an edited one is left alone.
const ORIGINAL_DESCRIPTIONS = {
  catalogue: 'Order from pre-approved catalogues — fast track, no sourcing needed',
  goods: 'Physical products, hardware, equipment, furniture',
  services: 'Facilities, catering, cleaning, travel management',
  software: 'Licences, SaaS platforms, cloud services, subscriptions',
  consulting: 'Strategy advisory, audits, assessments, transformation',
  'contingent-labour': 'Temporary staff, contractors, IT staffing, augmentation',
};
// A first keyword set, applied live the same day, matched inside words ("app"
// in "approval", "temp" in "template"). Replaced only while still unchanged.
const SUPERSEDED_KEYWORDS = {
  software: ['software', 'saas', 'licence', 'license', 'cloud', 'platform', 'subscription', 'app'],
  'contingent-labour': ['temp', 'contractor', 'staff', 'developer', 'freelance', 'hire', 'interim'],
};
const ORIGINAL_ORDER = ['catalogue', 'goods', 'services', 'software', 'consulting', 'contingent-labour', 'contract-renewal', 'supplier-onboarding'];

const rows = await sql`SELECT id, description, sort_order, classification_keywords FROM procurement_categories ORDER BY sort_order`;
const stillOriginalOrder = rows.map((r) => r.id).join() === ORIGINAL_ORDER.filter((id) => rows.some((r) => r.id === id)).join();

for (const seed of DEFAULT_CATEGORY_TAXONOMY) {
  const row = rows.find((r) => r.id === seed.id);
  if (!row) { console.log(`? ${seed.id} not in the table`); continue; }
  const patch = {};
  const live = row.classification_keywords ?? [];
  const superseded = SUPERSEDED_KEYWORDS[seed.id] && live.join() === SUPERSEDED_KEYWORDS[seed.id].join();
  if ((live.length === 0 && seed.keywords.length > 0) || superseded) patch.keywords = seed.keywords;
  if (row.description === ORIGINAL_DESCRIPTIONS[seed.id] && row.description !== seed.description) patch.description = seed.description;
  if (stillOriginalOrder && row.sort_order !== seed.sortOrder) patch.sortOrder = seed.sortOrder;
  if (Object.keys(patch).length === 0) { console.log(`= ${seed.id}`); continue; }
  console.log(`~ ${seed.id}: ${Object.keys(patch).join(', ')}`);
  changed += 1;
  if (!DRY) {
    await sql`UPDATE procurement_categories SET
      classification_keywords = ${patch.keywords ?? row.classification_keywords ?? []},
      description = ${patch.description ?? row.description},
      sort_order = ${patch.sortOrder ?? row.sort_order}
      WHERE id = ${seed.id}`;
  }
}
// The retired categories sort after every active one, out of the way.
if (stillOriginalOrder) {
  for (const [i, id] of ['contract-renewal', 'supplier-onboarding'].entries()) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.sort_order === 90 + i) continue;
    console.log(`~ ${id}: sortOrder → ${90 + i}`);
    changed += 1;
    if (!DRY) await sql`UPDATE procurement_categories SET sort_order = ${90 + i} WHERE id = ${id}`;
  }
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
