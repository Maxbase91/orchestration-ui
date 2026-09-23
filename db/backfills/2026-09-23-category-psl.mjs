#!/usr/bin/env node
// Category supplier tags and preferred-supplier lists, seeded from what decided
// them until now — so the switch to configuration changes no answer on day one.
//
//  1. `procurement_categories.supplier_tags` ← the supplier recommender's old
//     hard-coded category → keyword map (now in the category seed). Only where a
//     category has none, so an admin's edit is never overwritten.
//  2. `category_preferred_suppliers` ← the heuristic that answered "preferred"
//     while no list existed: the supplier covers the category (by its tags),
//     has an active contract, is not critical risk, and performs at or above the
//     governed `preferredMinPerformance`. Only for a category with no list yet.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:category-psl   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { DEFAULT_CATEGORY_TAXONOMY } from '../../src/data/category-taxonomy.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('category PSL'));

// ── 1. Supplier tags ─────────────────────────────────────────────────────────
const cats = await sql`SELECT id, supplier_tags FROM procurement_categories`;
for (const cat of cats) {
  const seed = DEFAULT_CATEGORY_TAXONOMY.find((c) => c.id === cat.id);
  if ((cat.supplier_tags ?? []).length > 0 || !seed?.supplierTags?.length) continue;
  console.log(`~ ${cat.id}: supplier tags ← ${seed.supplierTags.join(', ')}`);
  if (!DRY) await sql`UPDATE procurement_categories SET supplier_tags = ${seed.supplierTags} WHERE id = ${cat.id}`;
}

// ── 2. Preferred-supplier lists ──────────────────────────────────────────────
const [policyRow] = await sql`SELECT config FROM procurement_policy_configs LIMIT 1`.catch(() => [undefined]);
const floor = Number(policyRow?.config?.preferredMinPerformance ?? DEFAULT_POLICY_CONFIG.preferredMinPerformance);
const suppliers = await sql`SELECT id, name, categories, active_contracts, risk_rating, performance_score FROM suppliers`;
const current = await sql`SELECT category_id, supplier_id FROM category_preferred_suppliers`;
const listed = new Set(current.map((r) => r.category_id));
const fresh = await sql`SELECT id, supplier_tags FROM procurement_categories`;
let added = 0;
for (const cat of fresh) {
  if (listed.has(cat.id)) continue;
  const tags = (cat.supplier_tags ?? []).map((t) => t.toLowerCase());
  if (tags.length === 0) continue;
  const preferred = suppliers.filter((s) =>
    (s.categories ?? []).some((c) => tags.some((t) => c.toLowerCase().includes(t)))
    && Number(s.active_contracts ?? 0) > 0
    && s.risk_rating !== 'critical'
    && Number(s.performance_score ?? 0) >= floor);
  if (preferred.length === 0) { console.log(`= ${cat.id}: no supplier meets the old rule — list left empty`); continue; }
  console.log(`+ ${cat.id}: ${preferred.map((s) => s.name).join(', ')}`);
  added += preferred.length;
  if (!DRY) {
    for (const s of preferred) {
      await sql`INSERT INTO category_preferred_suppliers (category_id, supplier_id) VALUES (${cat.id}, ${s.id}) ON CONFLICT DO NOTHING`;
    }
  }
}
if (added === 0) console.log('= every category already has its list, or none qualifies');
console.log(DRY ? '\n(dry run — nothing written)' : '\nCategory supplier tags and preferred suppliers are set.');
