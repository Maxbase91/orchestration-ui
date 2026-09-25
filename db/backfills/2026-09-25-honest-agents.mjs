#!/usr/bin/env node
// AI agents: only what is real, described as it is.
//
// - AI-006 "PR Compliance Reviewer" wrote a report per request whose checks
//   were mostly passes nobody ran (sanctions screening, contract coverage, the
//   supplier's risk assessment, a market benchmark) with made-up confidence
//   scores. The agent, its generator and its stored reports go — decided with
//   the product owner on 2026-09-25.
// - AI-003 "Document Extractor" only relabelled a disabled upload button.
// - The remaining agents get descriptions of what they actually do (from
//   src/data/ai-agents.ts); the seeded marketing text claimed a fine-tuned
//   model and accuracy figures nothing measured.
// - NOT-021 announced "model retrained, accuracy improved to 94.2%" — it was
//   not.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:honest-agents   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { aiAgents } from '../../src/data/ai-agents.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('honest agents'));
let changed = 0;

const [{ n: reports }] = await sql`SELECT count(*)::int AS n FROM compliance_reports`;
if (reports > 0) {
  console.log(`- ${reports} AI-006 compliance report(s)`);
  changed += reports;
  if (!DRY) await sql`DELETE FROM compliance_reports`;
} else console.log('= no compliance reports left');

for (const id of ['AI-003', 'AI-006']) {
  const [row] = await sql`SELECT id FROM ai_agents WHERE id = ${id}`;
  if (!row) { console.log(`= ${id} already gone`); continue; }
  console.log(`- agent ${id}`);
  changed += 1;
  if (!DRY) await sql`DELETE FROM ai_agents WHERE id = ${id}`;
}

for (const agent of aiAgents) {
  const [row] = await sql`SELECT name, description FROM ai_agents WHERE id = ${agent.id}`;
  if (!row) { console.log(`? ${agent.id} not in the table — seeded elsewhere`); continue; }
  if (row.name === agent.name && row.description === agent.description) { console.log(`= ${agent.id} already described as it is`); continue; }
  console.log(`~ ${agent.id}: ${agent.name}`);
  changed += 1;
  if (!DRY) await sql`UPDATE ai_agents SET name = ${agent.name}, description = ${agent.description} WHERE id = ${agent.id}`;
}

const [fake] = await sql`SELECT id FROM notifications WHERE id = 'NOT-021' AND description ILIKE '%retrained%'`;
if (fake) {
  console.log('- NOT-021 (an invented "model retrained" announcement)');
  changed += 1;
  if (!DRY) await sql`DELETE FROM notifications WHERE id = 'NOT-021'`;
} else console.log('= NOT-021 already gone');

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
