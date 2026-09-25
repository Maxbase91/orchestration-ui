#!/usr/bin/env node
// Routing decides one thing for a Door 1 demand: business-led or
// procurement-led.
//
// Rules sent demands to channels that need a real match: anything under the
// competitive-sourcing threshold to "catalogue" with no catalogue item behind
// it (RR-900, and RR-002 / RR-007 by category), contingent labour to
// "call-off" with no contract (RR-004, RR-903), facilities services to Direct
// PO (RR-009), and the renewal and onboarding "categories" to a channel
// (RR-005, RR-008). RR-901 duplicated RR-003. The catalogue and a call-off now
// come only from a real item or a transactable contract on How you'll buy.
//
// Removes those rules (their definitions are printed first, and remain in git
// history in src/data/routing-rules.ts) and adds RR-013, contingent labour →
// procurement-led, from the seed.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:door1-routing   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { routingRules } from '../../src/data/routing-rules.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('door 1 routing'));
const REMOVED = ['RR-002', 'RR-004', 'RR-005', 'RR-007', 'RR-008', 'RR-009', 'RR-900', 'RR-901', 'RR-903'];
const ADDED = routingRules.filter((r) => r.id === 'RR-013');
if (ADDED.length !== 1) throw new Error('RR-013 is not in the seed.');

let changed = 0;
const present = await sql`SELECT id, name, status, conditions, action FROM routing_rules WHERE id = ANY(${REMOVED})`;
for (const row of present) {
  console.log(`- ${row.id} "${row.name}" [${row.status}] ${JSON.stringify(row.conditions)} → ${row.action?.buyingChannel}`);
  changed += 1;
  if (!DRY) await sql`DELETE FROM routing_rules WHERE id = ${row.id}`;
}
for (const rule of ADDED) {
  const [exists] = await sql`SELECT id FROM routing_rules WHERE id = ${rule.id}`;
  if (exists) { console.log(`= ${rule.id} already present`); continue; }
  console.log(`+ ${rule.id} "${rule.name}" → ${rule.action.buyingChannel}`);
  changed += 1;
  if (DRY) continue;
  await sql`
    INSERT INTO routing_rules (id, name, status, priority, conditions, action, description, last_modified, category)
    VALUES (${rule.id}, ${rule.name}, ${rule.status}, ${rule.priority ?? 100},
            ${JSON.stringify(rule.conditions)}::jsonb, ${JSON.stringify(rule.action)}::jsonb,
            ${rule.description}, ${rule.lastModified}, ${rule.category})`;
}
console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} row(s)`);
