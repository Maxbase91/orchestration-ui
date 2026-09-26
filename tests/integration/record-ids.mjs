#!/usr/bin/env node
// A new admin record never takes a live record's id (2026-09-26).
//
// Every admin list saves by upserting on id, so a taken id does not fail — it
// replaces that record. Add Form numbered the new form from the count of
// forms: with FORM-002…006 stored, "new" was FORM-006 and its edits and its
// save went to the live form. Add Agent had the same shape, one Add away from
// taking AI-007 (Status Answers); service-description criteria repeated ids
// after a removal. Routing rules and the knowledge base had each fixed it in a
// private copy. One helper now, and this suite holds every adder to it.
//
// Run: node --import tsx/esm tests/integration/record-ids.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { nextSequentialId } from '../../src/lib/next-id.ts';

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nOne past the highest id in use');
const forms = ['FORM-002', 'FORM-003', 'FORM-004', 'FORM-005', 'FORM-006'];
check('the reported case: five forms from FORM-002 give FORM-007, not the live FORM-006',
  nextSequentialId('FORM-', forms) === 'FORM-007' && `FORM-${String(forms.length + 1).padStart(3, '0')}` === 'FORM-006');
const agents = ['AI-001', 'AI-002', 'AI-004', 'AI-005', 'AI-007'];
check('agents with gaps: AI-008, where the count gave AI-006 and then the live AI-007',
  nextSequentialId('AI-', agents) === 'AI-008' && nextSequentialId('AI-', [...agents, 'AI-008']) === 'AI-009');
check('an empty list starts at 001', nextSequentialId('RR-', []) === 'RR-001');
check('ids off the pattern are ignored, not a break in the sequence',
  nextSequentialId('KB-', ['KB-004', 'KB-legacy', 'kb-099', 'KB-12a']) === 'KB-005');
check('an unpadded sequence stays unpadded', nextSequentialId('c', ['c1', 'c3'], 0) === 'c4');
check('a prefix is matched literally', nextSequentialId('A.B-', ['AXB-9', 'A.B-2']) === 'A.B-003');

console.log('\nEvery admin adder uses it');
const ROOT = new URL('../../', import.meta.url).pathname;
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}
const admin = files(join(ROOT, 'src/features/admin'));
const counted = admin.filter((f) => /id:\s*`[^`]*\$\{[^}]*\.length\s*\+\s*1/.test(readFileSync(f, 'utf8')));
check('no admin page builds an id from a count', counted.length === 0, counted.map((f) => f.replace(ROOT, '')).join(', '));
for (const [file, prefix] of [
  ['src/features/admin/forms/form-builder-page.tsx', 'FORM-'],
  ['src/features/admin/ai-agents/ai-agents-page.tsx', 'AI-'],
  ['src/features/admin/routing-rules/routing-rules-page.tsx', 'RR-'],
  ['src/features/admin/kb-admin-page.tsx', 'KB-'],
  ['src/features/admin/service-description-page.tsx', 'c'],
]) {
  check(`${file.split('/').pop()} numbers new records with nextSequentialId('${prefix}', …)`,
    readFileSync(join(ROOT, file), 'utf8').includes(`nextSequentialId('${prefix}'`));
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All record-id checks passed.');
