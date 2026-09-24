#!/usr/bin/env node
// The requester's wording for each buying channel, moved onto the workflow
// template that claims the channel.
//
// "How this will be bought" used to come from a table in
// src/lib/routing/evaluate-routing-rules.ts, so an admin could rename every
// stage of a lifecycle and the requester still read the old promise. The
// headline and description now live on the template (Admin → Workflows) and
// this fills them in from the seed.
//
// Fill-only: a template whose wording an admin has already written is left
// alone. Idempotent: a second run reports nothing to change.
//
//   npm run backfill:channel-wording   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { workflowTemplates } from '../../src/data/workflows.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('channel wording'));

const live = new Map((await sql`SELECT id, requester_headline, requester_description FROM workflow_templates`)
  .map((r) => [r.id, r]));
let changed = 0;
for (const seed of workflowTemplates) {
  if (!seed.requesterHeadline && !seed.requesterDescription) continue;
  const row = live.get(seed.id);
  if (!row) {
    console.log(`! ${seed.id} is not live — run backfill:workflow-graph-fixes first`);
    continue;
  }
  const headline = row.requester_headline?.trim() ? null : seed.requesterHeadline ?? null;
  const description = row.requester_description?.trim() ? null : seed.requesterDescription ?? null;
  if (!headline && !description) {
    console.log(`= ${seed.id} already has its wording`);
    continue;
  }
  changed += 1;
  console.log(`+ ${seed.id}: ${[headline && 'headline', description && 'description'].filter(Boolean).join(' + ')}`);
  if (DRY) continue;
  // COALESCE keeps whichever half an admin already wrote.
  await sql`
    UPDATE workflow_templates
       SET requester_headline = COALESCE(NULLIF(TRIM(requester_headline), ''), ${headline}),
           requester_description = COALESCE(NULLIF(TRIM(requester_description), ''), ${description})
     WHERE id = ${seed.id}`;
}
if (changed === 0) console.log('= every channel template has its wording');
console.log(DRY ? '\n(dry run — nothing written)' : '\nChannel wording is on the templates.');
