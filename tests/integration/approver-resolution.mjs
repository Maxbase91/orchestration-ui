#!/usr/bin/env node
// Who acts as each functional role — configuration, and complete.
//
// This suite used to carry its own copy of CHAIN_ROLE_TO_SYSTEM_ROLE and of
// resolveApprover, and passed against the copy. Both are gone from the code
// (2026-09-25): the map is `functional_roles` (Approval Chains → Roles), and an
// unknown role no longer defaults to the procurement manager. What matters now
// is that every role a chain or a stage names is configured — "Vendor
// management", a live stage owner, never was, so its stage had no owner.
//
// Run: npm run test:approver-resolution
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import { functionalRoles } from '../../src/data/functional-roles.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';
import { roles as systemRoles } from '../../src/config/roles.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

console.log('The seed configures every role the seeded stages name');
const configured = new Set(functionalRoles.map((r) => r.name));
const stageRoles = [...new Set(workflowTemplates.flatMap((t) => t.nodes.map((n) => n.role).filter(Boolean)))];
const missing = stageRoles.filter((r) => !configured.has(r));
check(`every stage owner role is configured (${stageRoles.length})`, missing.length === 0, missing.join(', '));
check('each acts as a real system role', functionalRoles.every((r) => systemRoles.some((s) => s.id === r.actsAs)));
check('the external supplier role acts as nothing', functionalRoles.every((r) => r.actsAs !== 'supplier'));
check('an ownerless Budget Owner step goes to procurement managers', functionalRoles.find((r) => r.name === 'Budget Owner')?.actsAs === 'procurement-manager');
check('the record-backed roles are all configured', ['Budget Owner', 'Category Manager', 'Contract Owner'].every((n) => configured.has(n)));

console.log('\nNo copy of the table is left in code');
check('approval-derivation has no role table', !/CHAIN_ROLE_TO_SYSTEM_ROLE/.test(read('src/lib/procurement/approval-derivation.ts')));
const resolution = read('src/lib/workflow/approver-resolution.ts');
check('stage owners resolve through the configured map', /resolveStageOwnerRole\(chainRole: string \| undefined, roles: RoleMap\)/.test(resolution));
check('personas have one home (the auth store), not a copy here', !/PERSONA_BY_ROLE\s*[:=]/.test(resolution) && /personaForRole/.test(resolution));
check('transitions read the configured map', /loadRoleMap\(\)/.test(read('src/lib/workflow/transition.ts')));

const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nLive');
  const sql = neon(connection);
  const liveRoles = new Set((await sql`SELECT name FROM functional_roles`).map((r) => r.name));
  const named = [
    ...(await sql`SELECT DISTINCT s->>'role' AS role FROM approval_chains, jsonb_array_elements(steps) s`).map((r) => r.role),
    ...(await sql`SELECT DISTINCT n->>'role' AS role FROM workflow_templates, jsonb_array_elements(nodes) n WHERE n->>'role' IS NOT NULL`).map((r) => r.role),
    ...(await sql`SELECT DISTINCT approver_role AS role FROM approval_entries WHERE status = 'pending'`).map((r) => r.role),
  ].filter(Boolean);
  const unconfigured = [...new Set(named)].filter((r) => !liveRoles.has(r));
  check('every role a live chain, stage or pending approval names is configured', unconfigured.length === 0, unconfigured.join(', '));
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s) failed`); process.exit(1); }
console.log('All approver-resolution checks passed.');
