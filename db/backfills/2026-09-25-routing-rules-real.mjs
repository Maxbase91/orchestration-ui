#!/usr/bin/env node
// Routing rules: only rules that can change an outcome, on fields the runtime
// supplies.
//
// - RR-001 (software above the budget-approval threshold → procurement-led),
//   RR-006 (above materiality → procurement-led) and RR-011 (a draft: marketing
//   €50k–250k → procurement-led) can never change a channel: RR-902 already
//   sends everything above the budget-approval threshold procurement-led, and
//   RR-905 everything above the business-led ceiling. Deleted.
// - RR-010 tested `priority = urgent` AND `isUrgent = true` — one fact twice;
//   `priority` leaves the vocabulary. Now `isUrgent` only, and its description
//   no longer claims urgent requests "skip finance approval" (they do not).
// - RR-012 (high/critical-risk supplier → Compliance Escalation chain) tested
//   the supplier's *id* against the risk scale, so it could never match, and
//   was disabled. Now keyed on the supplier's own risk rating and switched on —
//   decided with the product owner on 2026-09-25.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:routing-rules-real   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { routingRules } from '../../src/data/routing-rules.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('routing rules real'));
let changed = 0;
// jsonb stores object keys in its own order, so compare with sorted keys.
const canonical = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

for (const id of ['RR-001', 'RR-006', 'RR-011']) {
  const [row] = await sql`SELECT id FROM routing_rules WHERE id = ${id}`;
  if (!row) { console.log(`= ${id} already gone`); continue; }
  console.log(`- ${id}`);
  changed += 1;
  if (!DRY) await sql`DELETE FROM routing_rules WHERE id = ${id}`;
}

for (const id of ['RR-010', 'RR-012']) {
  const seed = routingRules.find((r) => r.id === id);
  const [row] = await sql`SELECT status, conditions, description FROM routing_rules WHERE id = ${id}`;
  if (!row) { console.log(`? ${id} not in the table`); continue; }
  const same = row.status === seed.status && canonical(row.conditions) === canonical(seed.conditions) && row.description === seed.description;
  if (same) { console.log(`= ${id} already as seeded`); continue; }
  console.log(`~ ${id}: ${seed.status}, ${seed.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ')}`);
  changed += 1;
  if (!DRY) {
    await sql`UPDATE routing_rules SET status = ${seed.status}, conditions = ${JSON.stringify(seed.conditions)}::jsonb, description = ${seed.description} WHERE id = ${id}`;
  }
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
