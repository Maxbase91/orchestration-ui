#!/usr/bin/env node
// What the requester does at each stage — the new `requesterAction` node field,
// shown on the Channel page before submit and on the request's Workflow tab.
//
// Copied from the seed (src/data/workflows.ts), node by node, and only where
// the seed sets one: submitting at Intake, and agreeing terms on a business-led
// buy. Every other node is left exactly as it is live, so an admin's edits in
// the Workflow Designer survive — the node is matched by id AND label, and a
// relabelled node is reported rather than written.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:stage-requester-actions   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { workflowTemplates } from '../../src/data/workflows.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('stage requester actions'));
let changed = 0;

for (const seed of workflowTemplates) {
  const wanted = seed.nodes.filter((node) => node.requesterAction);
  if (wanted.length === 0) continue;
  const [row] = await sql`SELECT nodes FROM workflow_templates WHERE id = ${seed.id}`;
  if (!row) { console.log(`? ${seed.id} not in the table`); continue; }
  let touched = false;
  const nodes = row.nodes.map((live) => {
    const want = wanted.find((node) => node.id === live.id);
    if (!want) return live;
    if (live.label !== want.label) {
      console.log(`? ${seed.id} ${live.id} is "${live.label}" live, "${want.label}" in the seed — left alone`);
      return live;
    }
    if (live.requesterAction === want.requesterAction) {
      console.log(`= ${seed.id} ${live.id} ${live.label}`);
      return live;
    }
    console.log(`~ ${seed.id} ${live.id} ${live.label}: ${want.requesterAction}`);
    touched = true;
    changed += 1;
    return { ...live, requesterAction: want.requesterAction };
  });
  if (touched && !DRY) {
    await sql`UPDATE workflow_templates SET nodes = ${JSON.stringify(nodes)}::jsonb WHERE id = ${seed.id}`;
  }
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} node(s)`);
