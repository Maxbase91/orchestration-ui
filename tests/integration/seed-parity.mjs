#!/usr/bin/env node
// The checked-in seed matches what is live, so re-seeding cannot destroy an edit.
//
// `api/admin/seed.ts` upserts `workflowTemplates` by id. That is a full column
// overwrite, not a merge — so any node or edge an admin added in the Workflow
// Designer and never mirrored back into `src/data/workflows.ts` is silently
// destroyed the next time anyone seeds.
//
// This is not hypothetical. Live WF-001 carried a 15th node, "Vendor
// Onboarding", plus three edges routing through it, that the seed file did not
// have; and every stage node in WF-002/003/004 had an slaDays the seed file did
// not have. A seed run would have deleted an entire lifecycle stage and every
// SLA outside WF-001.
//
// The graph is the part worth guarding: labels and coordinates are cosmetic,
// but nodes, edges, types, roles, SLAs and gates are governance.
import { neon } from '@neondatabase/serverless';
import { requireConnection, skipIfUnreachable, SKIP_EXIT_CODE } from '../lib/live.mjs';
import { workflowTemplates } from '../../src/data/workflows.ts';

const SUITE = 'seed-parity';
const connection = requireConnection(SUITE);
if (!connection) process.exit(SKIP_EXIT_CODE);

let failures = 0;
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`);
const bad = (label, detail) => {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${label}`);
  if (detail) console.error(`      ${detail}`);
};

/** The governance-bearing shape of a node: what it is, who owns it, how long it
 *  gets, and whether it gates. Position and prose are deliberately excluded. */
const nodeShape = (n) => ({
  id: n.id,
  type: n.type,
  label: n.label,
  role: n.role ?? null,
  slaDays: n.slaDays ?? null,
  gate: n.gate ?? null,
});

/** Edge order matters, but only *within one source*: `getNextNodeIds` evaluates
 *  a node's outgoing edges in declaration order and falls back to the first, so
 *  swapping "Risk required" and "Skip risk" changes the workflow. The order of
 *  the array as a whole does not — live appends new edges at the end while the
 *  seed keeps them in graph order, and those are the same workflow. So compare
 *  per source, ordered within each group. */
const edgesBySource = (edges) => {
  const grouped = new Map();
  for (const e of edges) {
    const key = e.source;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(`${e.target}[${e.label ?? ''}]`);
  }
  return grouped;
};

let sql;
try {
  sql = neon(connection);
  const live = await sql`SELECT id, name, type, nodes, edges FROM workflow_templates ORDER BY id`;
  const liveById = new Map(live.map((t) => [t.id, t]));

  console.log('\nEvery seeded workflow template matches the live row');

  for (const seed of workflowTemplates) {
    const row = liveById.get(seed.id);
    if (!row) {
      bad(`${seed.id} exists live`, 'the seed defines a template the database does not have');
      continue;
    }

    const seedNodes = seed.nodes.map(nodeShape);
    const liveNodes = row.nodes.map(nodeShape);
    const seenLive = new Map(liveNodes.map((n) => [n.id, n]));

    for (const n of seedNodes) {
      const l = seenLive.get(n.id);
      if (!l) { bad(`${seed.id} ${n.id} exists live`, `the seed has "${n.label}", the database does not`); continue; }
      for (const key of ['type', 'label', 'role', 'slaDays', 'gate']) {
        if (n[key] !== l[key]) {
          bad(`${seed.id} ${n.id}.${key}`, `seed ${JSON.stringify(n[key])} vs live ${JSON.stringify(l[key])}`);
        }
      }
    }
    // The direction that actually loses data: live has something the seed lacks.
    for (const l of liveNodes) {
      if (!seedNodes.some((n) => n.id === l.id)) {
        bad(`${seed.id} ${l.id} is in the seed`,
          `live has "${l.label}" and the seed does not — seeding would DELETE it`);
      }
    }

    const seedEdges = edgesBySource(seed.edges);
    const liveEdges = edgesBySource(row.edges);
    for (const source of new Set([...seedEdges.keys(), ...liveEdges.keys()])) {
      const s = (seedEdges.get(source) ?? []).join(' ');
      const l = (liveEdges.get(source) ?? []).join(' ');
      if (s !== l) {
        bad(`${seed.id} ${source} outgoing edges match, in branch order`,
          `seed [${s}] vs live [${l}]`);
      }
    }
  }

  if (failures === 0) {
    const nodes = workflowTemplates.reduce((n, t) => n + t.nodes.length, 0);
    ok(`${workflowTemplates.length} templates, ${nodes} nodes and every edge match live`);
  }
} catch (error) {
  if (skipIfUnreachable(SUITE, error)) process.exit(SKIP_EXIT_CODE);
  throw error;
}

console.log(failures === 0 ? '\n\x1b[32mseed-parity passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
