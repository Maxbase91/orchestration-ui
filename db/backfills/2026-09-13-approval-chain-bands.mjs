#!/usr/bin/env node
// Turn approval-chain bands from parsed English into structured bounds.
//
// `threshold` held "< 10,000" / "100,000 - 500,000" / "> 500,000" and was
// regex-parsed at read time. A string with no number in it parsed as
// [0, Infinity), so it matched every value and — being found first — shadowed
// every properly banded chain behind it. That was reachable two ways without
// anyone typing anything strange: the column defaults to '' and the admin page
// created new chains at 'TBD'.
//
// Bounds are `min_value`/`max_value` now, each a literal or a `policy:<key>`
// token. Two of the four live boundaries are governed thresholds under another
// name — 100,000 is budgetApprovalThreshold and 500,000 is
// delegatedAuthorityThreshold — so those become tokens and follow the policy.
// 10,000 has no governed home and stays a literal.
//
// `threshold` survives as a display label, rewritten from the bounds, and is
// never parsed again.
//
//   npm run backfill:approval-bands   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import { bandLabel, resolveBand, diagnoseChains } from '../../src/lib/workflow/approval-bands.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('approval chain bands'));

/** Only tokenise where the number AND the meaning match. */
const BOUNDS = {
  'chain-2': { minValue: null, maxValue: '10000' },
  'chain-1': { minValue: '10000', maxValue: 'policy:budgetApprovalThreshold' },
  'chain-3': { minValue: 'policy:budgetApprovalThreshold', maxValue: 'policy:delegatedAuthorityThreshold' },
  'chain-4': { minValue: 'policy:delegatedAuthorityThreshold', maxValue: null },
  // Reachable only by a routing rule naming it — no band, deliberately.
  'chain-compliance': { minValue: null, maxValue: null },
};

const rows = await sql`SELECT id, name, threshold, min_value, max_value FROM approval_chains ORDER BY id`;
let changed = 0;
const after = [];

for (const row of rows) {
  const want = BOUNDS[row.id];
  if (!want) {
    console.log(`? ${row.id} "${row.name}" has no mapping — left alone with threshold "${row.threshold}"`);
    after.push({ id: row.id, name: row.name, minValue: row.min_value, maxValue: row.max_value });
    continue;
  }
  const label = bandLabel(want, DEFAULT_POLICY_CONFIG);
  after.push({ id: row.id, name: row.name, ...want });

  if (row.min_value === want.minValue && row.max_value === want.maxValue && row.threshold === label) {
    console.log(`= ${row.id} already structured (${label})`);
    continue;
  }
  const band = resolveBand(want, DEFAULT_POLICY_CONFIG);
  console.log(`  ${row.id} "${row.threshold}" → [${want.minValue ?? 'open'}, ${want.maxValue ?? 'open'}) = ${band ? `[${band.min}, ${band.max})` : 'not selectable by value'}`);
  console.log(`      label: "${label}"`);
  changed += 1;
  if (DRY) continue;
  await sql`
    UPDATE approval_chains
       SET min_value = ${want.minValue}, max_value = ${want.maxValue}, threshold = ${label},
           updated_at = now()
     WHERE id = ${row.id}`;
}

// A gap or an overlap here means a request can reach the approval stage with
// nobody able to approve it, so refuse to leave the bands in that state.
const problems = diagnoseChains(after, DEFAULT_POLICY_CONFIG);
if (problems.length) {
  console.error('\nBands are not coherent:');
  for (const p of problems) console.error(`  ${p.chainId} ${p.chainName}: ${p.problems.join(' ')}`);
  process.exit(1);
}
console.log(`\nBands cover [0, ∞) with no gap or overlap.`);
console.log(`${DRY ? 'would change' : 'changed'} ${changed} row(s)`);
