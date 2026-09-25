#!/usr/bin/env node
// Functional roles as configuration, and chain descriptions that say what the
// chain is rather than restating its band.
//
// - functional_roles is seeded from src/data/functional-roles.ts: every role a
//   live chain or stage names, the three record-backed roles, and the historic
//   "Finance Approver". Fill-only — a role an admin has already configured is
//   left as it is. "Budget Owner" now acts as procurement manager when the cost
//   centre names nobody (it was "any requester"), and "Vendor management" gets
//   the mapping it never had.
// - approval_chains.description restated the band in words ("For requests
//   between EUR 100k and EUR 500k"), which does not follow the thresholds the
//   band is tied to. Rewritten only where it does that.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:functional-roles   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { functionalRoles } from '../../src/data/functional-roles.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('functional roles'));
let changed = 0;

const existing = new Set((await sql`SELECT name FROM functional_roles`).map((r) => r.name));
for (const role of functionalRoles) {
  if (existing.has(role.name)) { console.log(`= ${role.name} already configured`); continue; }
  console.log(`+ ${role.name} → ${role.actsAs}`);
  changed += 1;
  if (!DRY) {
    await sql`INSERT INTO functional_roles (name, acts_as, description, sort_order)
      VALUES (${role.name}, ${role.actsAs}, ${role.description}, ${role.sortOrder}) ON CONFLICT (name) DO NOTHING`;
  }
}

const DESCRIPTIONS = {
  'chain-1': 'Budget owner, category manager and finance.',
  'chain-2': 'Small purchases: the category manager alone.',
  'chain-3': 'Adds VP Procurement to the standard chain.',
  'chain-4': 'Adds CFO and Board to the VP-level chain.',
};
for (const [id, description] of Object.entries(DESCRIPTIONS)) {
  const [row] = await sql`SELECT description FROM approval_chains WHERE id = ${id}`;
  if (!row) { console.log(`? ${id} not present`); continue; }
  if (!/EUR|€|\d/.test(row.description ?? '')) { console.log(`= ${id} description does not restate the band`); continue; }
  console.log(`~ ${id}: "${row.description}" → "${description}"`);
  changed += 1;
  if (!DRY) await sql`UPDATE approval_chains SET description = ${description} WHERE id = ${id}`;
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
