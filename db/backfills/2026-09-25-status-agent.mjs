#!/usr/bin/env node
// Seed the Status Answers agent (AI-007) with its default configuration.
//
// Status questions on Home and in the assistant are answered through this
// agent: which attributes of a request, PO, invoice, contract or supplier may
// be stated, and whose records each role may ask about. Fill-only — an agent
// an admin has already configured is left exactly as it is. A second run
// reports nothing to change.
//
//   npm run backfill:status-agent   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { aiAgents } from '../../src/data/ai-agents.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('status agent'));
const agent = aiAgents.find((a) => a.type === 'status');
let changed = 0;

const [existing] = await sql`SELECT id, config FROM ai_agents WHERE type = 'status' LIMIT 1`;
if (!existing) {
  console.log(`+ ${agent.id} ${agent.name}`);
  changed += 1;
  if (!DRY) {
    await sql`INSERT INTO ai_agents (id, name, type, status, accuracy, decisions_made, last_updated, description, config)
      VALUES (${agent.id}, ${agent.name}, ${agent.type}, ${agent.status}, 0, 0, ${agent.lastUpdated}, ${agent.description}, ${JSON.stringify(agent.config)}::jsonb)
      ON CONFLICT (id) DO NOTHING`;
  }
} else if (!existing.config) {
  console.log(`~ ${existing.id}: default configuration`);
  changed += 1;
  if (!DRY) await sql`UPDATE ai_agents SET config = ${JSON.stringify(agent.config)}::jsonb WHERE id = ${existing.id}`;
} else {
  console.log(`= ${existing.id} already configured — left as the admin has it`);
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
