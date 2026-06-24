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
const PERSONA_BY_ROLE = {
  'service-owner': { id: 'u1', name: 'Sarah Mitchell' },
  'procurement-manager': { id: 'u2', name: 'James Chen' },
  'vendor-manager': { id: 'u3', name: 'Anna Kowalski' },
  'operations-lead': { id: 'u4', name: 'Michael Torres' },
  supplier: { id: 'u5', name: 'David Schneider' },
  admin: { id: 'u6', name: 'Elena Popov' },
};
const PERSONAS = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6']);
function resolveApprover(chainRole) {
  const systemRole = (chainRole && CHAIN_ROLE_TO_SYSTEM_ROLE[chainRole]) || 'procurement-manager';
  const p = PERSONA_BY_ROLE[systemRole];
  return { systemRole, id: p.id, name: p.name };
}

console.log('Role → persona resolution');
check('Finance Approver → procurement-manager persona (u2)', resolveApprover('Finance Approver').id === 'u2');
check('VP Procurement → admin persona (u6)', resolveApprover('VP Procurement').id === 'u6');
check('Budget Owner → service-owner persona (u1)', resolveApprover('Budget Owner').id === 'u1');
check('Supplier Manager → vendor-manager persona (u3)', resolveApprover('Supplier Manager').id === 'u3');
check('Operations Lead → operations-lead persona (u4)', resolveApprover('Operations Lead').id === 'u4');
check('unknown role → procurement-manager fallback (u2)', resolveApprover('Mystery Role').id === 'u2');
check('undefined role → fallback (u2)', resolveApprover(undefined).id === 'u2');

console.log('Every approval resolves to a SWITCHABLE persona (the bug fix)');
const ALL_ROLES = [...Object.keys(CHAIN_ROLE_TO_SYSTEM_ROLE), 'Mystery Role', undefined];
check('no role ever resolves to a non-switchable user (u7+)', ALL_ROLES.every((r) => PERSONAS.has(resolveApprover(r).id)));
check('resolved name matches the persona', resolveApprover('Finance Approver').name === 'James Chen');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All approver-resolution checks passed.');
