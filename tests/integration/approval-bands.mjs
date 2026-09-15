#!/usr/bin/env node
// A chain with no band never shadows a chain that has one.
//
// `approval_chains.threshold` was a free-text English string parsed by regex at
// read time, and a string with no number in it parsed as [0, Infinity). So an
// unbanded chain matched EVERY value and, being found first, silently shadowed
// every properly banded chain behind it. Two ways to reach that without typing
// anything odd: the column defaults to '' and the admin page created new chains
// at 'TBD'.
//
// Bands are structured bounds now, each a literal or a `policy:` token, and
// "no band" means not selectable by value — which is what lets the compliance
// chain be reachable by a routing rule naming it and by nothing else.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import { FIXTURES } from '../ui/db-stub.mjs';
import {
  resolveBand, bandLabel, selectChainForValue, diagnoseChains, governedBounds,
} from '../../src/lib/workflow/approval-bands.ts';
import { DEFAULT_POLICY_CONFIG, resolvePolicyConfig } from '../../src/lib/procurement/policy-config.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };
const CONFIG = DEFAULT_POLICY_CONFIG;

// ── Absence is not an open band ────────────────────────────────────────────
console.log('\nA chain with no band is not selectable by value');
for (const [label, spec] of [
  ['both ends absent', {}],
  ['both ends null', { minValue: null, maxValue: null }],
  ["both ends empty (the column's own default)", { minValue: '', maxValue: '' }],
]) {
  if (resolveBand(spec, CONFIG) !== null) bad(`${label} → no band`, JSON.stringify(resolveBand(spec, CONFIG)));
  else ok(label);
}
if (resolveBand({ minValue: '100', maxValue: '100' }, CONFIG) !== null) bad('an empty range is no band');
else ok('max <= min is no band, not a range that matches nothing');
if (resolveBand({ minValue: 'policy:notAKey', maxValue: '500' }, CONFIG) !== null) {
  bad('a bound naming a missing threshold is no band', 'it would compare against NaN');
} else ok('a bound naming a missing threshold is no band');

// ── The shadowing bug, reconstructed ───────────────────────────────────────
console.log('\nThe shadowing bug cannot come back');
const shadow = [
  { id: 'brand-new', name: 'New Chain', minValue: null, maxValue: null },
  { id: 'banded', name: 'VP-Level', minValue: '100000', maxValue: '500000' },
];
const picked = selectChainForValue(shadow, 250_000, CONFIG);
if (picked?.id !== 'banded') {
  bad('a freshly created chain does not capture every request',
    `€250k selected ${picked?.id ?? 'nothing'} — the unbanded chain is listed first, as a new one would be`);
} else ok('an unbanded chain listed first is skipped, and the banded one wins');

// ── Bounds follow governed thresholds ──────────────────────────────────────
console.log('\nA band bound can follow a governed threshold');
const governed = { id: 'g', name: 'g', minValue: 'policy:budgetApprovalThreshold', maxValue: 'policy:delegatedAuthorityThreshold' };
const atDefault = resolveBand(governed, CONFIG);
if (atDefault?.min !== 100_000 || atDefault?.max !== 500_000) bad('resolves to the governed numbers', JSON.stringify(atDefault));
else ok('policy:budgetApprovalThreshold → policy:delegatedAuthorityThreshold = [100000, 500000)');

const moved = resolveBand(governed, resolvePolicyConfig({ budgetApprovalThreshold: 150_000 }));
if (moved?.min !== 150_000) bad('the band moves when the threshold moves', JSON.stringify(moved));
else ok('raising budgetApprovalThreshold to €150k moves the band with it');

const named = governedBounds(governed, CONFIG);
if (!named.min || !named.max) bad('the editor can say which bounds are governed', JSON.stringify(named));
else ok('governed bounds are nameable for the editor');

// ── Boundaries are half-open, so adjacent bands do not both claim a value ──
console.log('\nAdjacent bands meet without overlapping');
const ladder = [
  { id: 'c2', name: 'Fast-Track', minValue: null, maxValue: '10000' },
  { id: 'c1', name: 'Standard', minValue: '10000', maxValue: 'policy:budgetApprovalThreshold' },
  { id: 'c3', name: 'VP-Level', minValue: 'policy:budgetApprovalThreshold', maxValue: 'policy:delegatedAuthorityThreshold' },
  { id: 'c4', name: 'Board-Level', minValue: 'policy:delegatedAuthorityThreshold', maxValue: null },
];
for (const [value, expected] of [[0, 'c2'], [9_999, 'c2'], [10_000, 'c1'], [99_999, 'c1'], [100_000, 'c3'], [499_999, 'c3'], [500_000, 'c4'], [9_000_000, 'c4']]) {
  const got = selectChainForValue(ladder, value, CONFIG)?.id;
  if (got !== expected) bad(`€${value.toLocaleString()} → ${expected}`, `got ${got ?? 'nothing'}`);
}
if (failures === 0) ok('every boundary value lands in exactly one band');
if (diagnoseChains(ladder, CONFIG).length !== 0) {
  bad('a coherent ladder reports no problems', JSON.stringify(diagnoseChains(ladder, CONFIG)));
} else ok('a coherent ladder reports no problems');

// ── Gaps and overlaps are reported ─────────────────────────────────────────
console.log('\nGaps and overlaps are visible to the admin');
const gapped = [
  { id: 'a', name: 'Low', minValue: null, maxValue: '10000' },
  { id: 'b', name: 'High', minValue: '50000', maxValue: null },
];
const gapProblems = diagnoseChains(gapped, CONFIG).flatMap((d) => d.problems).join(' ');
if (!/between €10,000 and €50,000/.test(gapProblems)) bad('a gap is reported with its range', gapProblems);
else ok('a gap names the values nobody would approve');

const overlapped = [
  { id: 'a', name: 'Low', minValue: null, maxValue: '100000' },
  { id: 'b', name: 'High', minValue: '50000', maxValue: null },
];
const overlapProblems = diagnoseChains(overlapped, CONFIG).flatMap((d) => d.problems).join(' ');
if (!/Overlaps/.test(overlapProblems)) bad('an overlap is reported', overlapProblems);
else ok('an overlap names the other chain and says the first found wins');

// An unbanded chain is NOT a problem — that is how it says "by rule only".
if (diagnoseChains([...ladder, { id: 'x', name: 'Compliance', minValue: null, maxValue: null }], CONFIG).length !== 0) {
  bad('an unbanded chain is not reported as broken', 'it is the legitimate way to be rule-only');
} else ok('an unbanded chain is not reported as broken');

// ── The regex parser is gone, everywhere ───────────────────────────────────
console.log('\nNothing parses the display label any more');
const steps = read('src/lib/workflow/workflow-steps.ts');
if (/export function parseThresholdBand/.test(steps)) bad('parseThresholdBand is deleted', 'still exported');
else ok('parseThresholdBand is deleted');
for (const f of ['tests/integration/workflow-steps.mjs', 'tests/integration/approval-chain-persistence.mjs']) {
  if (/function parseThresholdBand/.test(read(f))) {
    bad(`${f} does not carry its own copy`, 'a mirror of a deleted parser passes against nothing');
  } else ok(`${f} does not mirror the parser`);
}
const page = read('src/features/admin/approval-chains-page.tsx');
if (/threshold: 'TBD'/.test(page)) bad("new chains no longer default to 'TBD'", "'TBD' parsed as [0, Infinity)");
else ok("new chains no longer default to 'TBD'");
if (!/bandLabel\(edited, policyConfig\)/.test(page)) {
  bad('the stored label is written from the bounds on save', 'a label that can disagree with its band is the original bug');
} else ok('the stored label is derived from the bounds, never typed');

// ── The browser stub models the columns the app reads ──────────────────────
// This is how C4 shipped a regression: the live rows and the new suite's own
// fixtures gained structured bounds, and the SHARED stub fixture kept only the
// old display label. resolveBand returned null, no chain was selected, and the
// wizard's review step rendered no approvers — caught only because the wizard
// smoke waits for the chain by name.
console.log('\nThe browser stub can still select a chain by value');
const stubChains = FIXTURES.approval_chains.map((c) => ({
  id: c.id, name: c.name, minValue: c.min_value ?? null, maxValue: c.max_value ?? null,
}));
// Not "every chain has bounds": one is deliberately unbanded, because a
// rule-only chain is exactly what must not shadow a banded one. The invariant
// is that SOME chain is selectable, or the wizard's review step shows no
// approvers at all — which is how C4 shipped a regression that only the
// wizard smoke caught, by waiting for the chain by name.
const selectable = [1_000, 50_000, 250_000].map((v) => selectChainForValue(stubChains, v, CONFIG)?.id);
if (selectable.every((id) => id === undefined)) {
  bad('the stub selects a chain for at least one value',
    'every fixture chain carries only a display label, so resolveBand returns null for all of them');
} else ok(`the stub selects a chain by value (${selectable.filter(Boolean).join(', ')})`);
if (!stubChains.some((c) => !c.minValue && !c.maxValue)) {
  bad('the stub keeps an unbanded chain', 'the shadowing case has no fixture to exercise it');
} else ok('the stub keeps an unbanded chain, so the shadowing case stays covered');

// ── Live ───────────────────────────────────────────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nLive bands are coherent');
  const sql = neon(connection);
  const rows = await sql`SELECT id, name, threshold, min_value, max_value FROM approval_chains ORDER BY id`;
  const chains = rows.map((r) => ({ id: r.id, name: r.name, minValue: r.min_value, maxValue: r.max_value }));
  const problems = diagnoseChains(chains, CONFIG);
  if (problems.length) {
    bad('no gap or overlap between the live bands',
      problems.map((p) => `${p.chainId}: ${p.problems.join(' ')}`).join(' | '));
  } else ok(`${chains.length} live chains, no gap and no overlap`);

  // Every value must reach exactly one chain, or a request can arrive at the
  // approval stage with nobody able to approve it.
  const uncovered = [0, 1, 9_999, 10_000, 100_000, 500_000, 5_000_000]
    .filter((v) => !selectChainForValue(chains, v, CONFIG));
  if (uncovered.length) bad('every value selects a chain', `no chain for ${uncovered.join(', ')}`);
  else ok('every probe value selects exactly one chain');

  for (const row of rows) {
    const expected = bandLabel({ minValue: row.min_value, maxValue: row.max_value }, CONFIG);
    if (row.threshold !== expected) {
      bad(`${row.id}'s stored label matches its band`, `stored "${row.threshold}" vs derived "${expected}"`);
    }
  }
  if (failures === 0) ok('every stored label matches the band it describes');
}

console.log(failures === 0 ? '\n\x1b[32mapproval-bands passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
