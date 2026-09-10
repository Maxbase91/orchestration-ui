#!/usr/bin/env node
// Seed the category → manager assignments.
//
// Who owns demand in a category was previously nobody: every functional role
// collapsed to one of six switchable personas, so an approval step naming
// "Category Manager" resolved to the same person regardless of what was being
// bought. category_managers makes it real data, maintained in admin.
//
// The assignments below follow the directory's own departments rather than
// being spread for variety — IT procurement takes software, supplier relations
// takes onboarding, finance takes the categories where the commitment is
// financial rather than technical. Anna Müller is added to every category as a
// second holder because she is the switchable procurement-manager persona, so
// every approval stays actionable in a demo without reassigning anything.
//
//   npm run backfill:category-managers   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('category manager seed'));

// user_id → the categories that user is responsible for.
const ASSIGNMENTS = {
  u3:  ['software'],                                  // Sarah Chen, IT Procurement
  u4:  ['services', 'contingent-labour'],             // Marcus Johnson, Professional Services
  u7:  ['consulting'],                                // Dr. Katrin Bauer, Finance
  u8:  ['contract-renewal'],                          // Robert Fischer, Finance
  u9:  ['supplier-onboarding'],                       // Lisa Nakamura, Supplier Relations
  u2:  ['goods', 'catalogue'],                        // Thomas Weber, Global Procurement
};

const categories = new Set((await sql.query('SELECT id FROM procurement_categories')).map((r) => r.id));
const users = new Set((await sql.query('SELECT id FROM users')).map((r) => r.id));

const rows = [];
for (const [userId, cats] of Object.entries(ASSIGNMENTS)) {
  for (const categoryId of cats) rows.push([categoryId, userId]);
}
// Anna Müller holds every category alongside the specialist above.
for (const categoryId of categories) rows.push([categoryId, 'u1']);

const skipped = rows.filter(([c, u]) => !categories.has(c) || !users.has(u));
const valid = rows.filter(([c, u]) => categories.has(c) && users.has(u));

for (const [c, u] of skipped) console.log(`  SKIPPED ${c} → ${u} (not in the directory or taxonomy)`);
console.log(`${valid.length} assignment(s) across ${categories.size} categories.`);

if (DRY) {
  for (const [c, u] of valid) console.log(`  ${c} → ${u}`);
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

await sql.transaction(valid.map(([categoryId, userId]) => sql.query(
  `INSERT INTO category_managers (category_id, user_id) VALUES ($1, $2)
   ON CONFLICT (category_id, user_id) DO NOTHING`, [categoryId, userId])));

const stored = await sql.query(`
  SELECT c.label, string_agg(u.name, ', ' ORDER BY u.name) AS managers
  FROM category_managers m
  JOIN procurement_categories c ON c.id = m.category_id
  JOIN users u ON u.id = m.user_id
  GROUP BY c.label, c.sort_order ORDER BY c.sort_order`);
for (const row of stored) console.log(`  ${row.label}: ${row.managers}`);
console.log(`\n${stored.length} categories have a manager.`);
