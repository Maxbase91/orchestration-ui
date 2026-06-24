#!/usr/bin/env node
// Verifies approver resolution — approval step role → switchable persona.
//
// Self-contained — mirrors src/lib/workflow/approver-resolution.ts. Keep in sync.
// Run: node tests/integration/approver-resolution.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const CHAIN_ROLE_TO_SYSTEM_ROLE = {
  'Budget Owner': 'service-owner', 'Business Requestor': 'service-owner',
  'Category Manager': 'procurement-manager', 'Procurement Manager': 'procurement-manager',
  'Procurement Lead': 'procurement-manager', Finance: 'procurement-manager',
  'Finance Approver': 'procurement-manager', 'VP Procurement': 'admin', CFO: 'admin', Board: 'admin',
  Approver: 'procurement-manager', 'New Approver': 'procurement-manager',
  'Supplier Manager': 'vendor-manager', 'Operations Lead': 'operations-lead',
};
// One identity namespace: each role's rep is a real `users` directory row.
const PERSONA_BY_ROLE = {
  'service-owner': { id: 'u6', name: "James O'Brien" },
  'procurement-manager': { id: 'u1', name: 'Anna Müller' },
  'vendor-manager': { id: 'u3', name: 'Sarah Chen' },
  'operations-lead': { id: 'u4', name: 'Marcus Johnson' },
  supplier: { id: 'u13', name: 'David Schneider' },
  admin: { id: 'u11', name: 'Christine Dupont' },
};
// The switchable role reps (must match src/stores/auth-store.ts defaultUsers).
const SWITCHABLE = new Set(['u6', 'u1', 'u3', 'u4', 'u13', 'u11']);
function resolveApprover(chainRole) {
  const systemRole = (chainRole && CHAIN_ROLE_TO_SYSTEM_ROLE[chainRole]) || 'procurement-manager';
  const p = PERSONA_BY_ROLE[systemRole];
  return { systemRole, id: p.id, name: p.name };
}

console.log('Role → switchable directory rep');
check('Finance Approver → procurement-manager rep (u1)', resolveApprover('Finance Approver').id === 'u1');
check('VP Procurement → admin rep (u11)', resolveApprover('VP Procurement').id === 'u11');
check('Budget Owner → service-owner rep (u6)', resolveApprover('Budget Owner').id === 'u6');
check('Supplier Manager → vendor-manager rep (u3)', resolveApprover('Supplier Manager').id === 'u3');
check('Operations Lead → operations-lead rep (u4)', resolveApprover('Operations Lead').id === 'u4');
check('unknown role → procurement-manager fallback (u1)', resolveApprover('Mystery Role').id === 'u1');
check('undefined role → fallback (u1)', resolveApprover(undefined).id === 'u1');

console.log('Every approval resolves to a SWITCHABLE directory user (the bug fix)');
const ALL_ROLES = [...Object.keys(CHAIN_ROLE_TO_SYSTEM_ROLE), 'Mystery Role', undefined];
check('no role ever resolves to a non-switchable user', ALL_ROLES.every((r) => SWITCHABLE.has(resolveApprover(r).id)));
check('resolved name matches the rep', resolveApprover('Finance Approver').name === 'Anna Müller');
check('all 6 system roles have a distinct rep', new Set(Object.values(PERSONA_BY_ROLE).map((p) => p.id)).size === 6);

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All approver-resolution checks passed.');
