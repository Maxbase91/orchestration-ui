#!/usr/bin/env node
// The command bar's catalogue result hands off to the governed checkout.
//
// This used to simulate the old "Order Now" button's Supabase insert directly,
// asserting that it wrote a real request row rather than a client-side id. That
// path is gone twice over: the button was replaced by a hand-off to the
// catalogue item-detail screen, where governed checkout recomputes the decision
// server-side (api/governed-checkout.ts, ADR-0002), and Supabase was replaced by
// Neon. The suite kept its Supabase half behind a `DATABASE_PROVIDER === 'neon'`
// branch, so once the provider flag went away it fell through to a client it
// could no longer construct and failed every run.
//
// What remains is the part that still means something and needs no database:
// the command bar must route to the governed screen rather than ordering
// directly. The write itself is covered by test:governed-checkout-atomic, which
// exercises the real transaction against Neon.
//
// Run: node tests/integration/catalogue-order.mjs

import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(
  new URL('../../src/features/dashboard/components/smart-command-bar.tsx', import.meta.url),
  'utf8',
);

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};

console.log('\nA catalogue match goes to the governed checkout, not straight to an order');

check('the command bar navigates to the item-detail screen',
  SOURCE.includes('navigate(`/catalogue/items/${encodeURIComponent(primary.id)}`)'));

// The regression this guards against is the old behaviour returning: writing a
// request from the browser skips the server-side recompute, the policy gate and
// the idempotency fingerprint that make the order defensible.
check('it does not insert a request row directly from the command bar',
  !/\.from\(\s*['"]requests['"]\s*\)\s*\.insert/.test(SOURCE));

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All catalogue-order checks passed.');
process.exit(failures === 0 ? 0 : 1);
