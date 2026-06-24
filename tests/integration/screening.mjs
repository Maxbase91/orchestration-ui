#!/usr/bin/env node
// Verifies supplier screening evaluation (SUP-03).
//
// Self-contained — mirrors src/lib/procurement/screening.ts. Keep in sync.
// Run: node tests/integration/screening.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

function evaluateScreening(status) {
  switch (status) {
    case 'clear': return { status: 'clear', cleared: true, blocking: false };
    case 'flagged': return { status: 'flagged', cleared: false, blocking: true };
    case 'pending': return { status: 'pending', cleared: false, blocking: false };
    default: return { status: 'unknown', cleared: false, blocking: false };
  }
}

console.log('Screening status');
check('clear → cleared, not blocking', (() => { const r = evaluateScreening('clear'); return r.cleared && !r.blocking; })());
check('flagged → blocking, not cleared', (() => { const r = evaluateScreening('flagged'); return r.blocking && !r.cleared; })());
check('pending → not cleared, not blocking', (() => { const r = evaluateScreening('pending'); return !r.cleared && !r.blocking; })());
check('undefined → unknown, not blocking', (() => { const r = evaluateScreening(undefined); return r.status === 'unknown' && !r.blocking; })());
check('unrecognised → unknown', evaluateScreening('weird').status === 'unknown');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All screening checks passed.');
