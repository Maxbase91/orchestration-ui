#!/usr/bin/env node
// Move the routing fallback out of code and into the rules table.
//
// `fallbackBuyingChannel` was a five-branch if-ladder in
// evaluate-routing-rules.ts that restated three governed thresholds — 25,000,
// 100,000 and 50,000 — where no admin could see them. It is also the reason
// RR-001 sat dead for months: the ladder happened to agree with it, so nothing
// looked wrong. Redundancy hid the outage rather than surviving it.
//
// RR-900…RR-905 reproduce it exactly, at priority 900+ so they run last. The
// `value <= 50000` step is written as `between 0,policy:businessLedCeiling`,
// because `between` is inclusive at both ends and there is no
// less_than_or_equal operator.
//
// Also sets `priority` on the existing twelve rules. They were ordered by id,
// so the catch-alls sort last only because they are named RR-9xx — one admin
// rule named later in the alphabet would have shadowed everything.
//
//   npm run backfill:routing-catch-alls   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { routingRules } from '../../src/data/routing-rules.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('routing catch-alls'));

const CATCH_ALLS = routingRules.filter((r) => (r.priority ?? 100) >= 900);
if (CATCH_ALLS.length === 0) throw new Error('No catch-all rules found in the seed.');

const existing = await sql`SELECT id, priority FROM routing_rules`;
const byId = new Map(existing.map((r) => [r.id, r]));
let changed = 0;

for (const rule of CATCH_ALLS) {
  if (byId.has(rule.id)) {
    console.log(`= ${rule.id} already present`);
    continue;
  }
  console.log(`+ ${rule.id} "${rule.name}" → ${rule.action.buyingChannel} (priority ${rule.priority})`);
  changed += 1;
  if (DRY) continue;
  await sql`
    INSERT INTO routing_rules (id, name, status, priority, conditions, action, description, match_count, last_modified, category)
    VALUES (${rule.id}, ${rule.name}, ${rule.status}, ${rule.priority},
            ${JSON.stringify(rule.conditions)}::jsonb, ${JSON.stringify(rule.action)}::jsonb,
            ${rule.description}, 0, ${rule.lastModified}, ${rule.category})`;
}

// Ordinary rules keep the default 100; this only repairs a row that somehow
// carries something else, and is a no-op on a fresh column.
for (const row of existing) {
  if (String(row.id).startsWith('RR-9')) continue;
  if (Number(row.priority) === 100) continue;
  console.log(`  ${row.id}: priority ${row.priority} → 100`);
  changed += 1;
  if (!DRY) await sql`UPDATE routing_rules SET priority = 100 WHERE id = ${row.id}`;
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} row(s)`);
