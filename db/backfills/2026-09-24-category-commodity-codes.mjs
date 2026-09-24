#!/usr/bin/env node
// Each category's commodity codes and default code, moved from code to the
// category (Admin → Categories).
//
// They were two tables in src/lib/procurement/category-code.ts — a keyword →
// code list and a category → default map — read by intake classification and
// the commodity-match endpoint. The seed taxonomy now carries them per
// category (src/data/category-taxonomy.ts); this fills the live rows from it.
//
// Fill-only: a category whose codes or default an admin has already set is
// left alone. Idempotent: a second run reports nothing to change.
//
//   npm run backfill:category-commodity-codes   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('category commodity codes'));

const live = new Map((await sql`SELECT id, commodity_codes, default_code FROM procurement_categories`)
  .map((r) => [r.id, r]));
let changed = 0;
for (const seed of DEFAULT_CATEGORY_TAXONOMY) {
  const row = live.get(seed.id);
  if (!row) { console.log(`! ${seed.id} is not live — nothing to fill`); continue; }
  const fillCodes = (row.commodity_codes ?? []).length === 0 && (seed.commodityCodes ?? []).length > 0;
  const fillDefault = !row.default_code?.trim() && Boolean(seed.defaultCode?.code);
  if (!fillCodes && !fillDefault) { console.log(`= ${seed.id} already configured`); continue; }
  changed += 1;
  console.log(`+ ${seed.id}: ${[fillCodes && `${seed.commodityCodes.length} code(s)`, fillDefault && `default ${seed.defaultCode.code}`].filter(Boolean).join(' + ')}`);
  if (DRY) continue;
  if (fillCodes) {
    await sql`UPDATE procurement_categories SET commodity_codes = ${JSON.stringify(seed.commodityCodes)}::jsonb
               WHERE id = ${seed.id} AND jsonb_array_length(commodity_codes) = 0`;
  }
  if (fillDefault) {
    await sql`UPDATE procurement_categories SET default_code = ${seed.defaultCode.code}, default_code_label = ${seed.defaultCode.label}
               WHERE id = ${seed.id} AND COALESCE(TRIM(default_code), '') = ''`;
  }
}
if (changed === 0) console.log('= every category has its commodity codes');
console.log(DRY ? '\n(dry run — nothing written)' : '\nCategory commodity codes are in the store.');
