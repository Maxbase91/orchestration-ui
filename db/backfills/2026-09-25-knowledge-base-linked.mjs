#!/usr/bin/env node
// Move the built-in knowledge base into the live table, linked to configuration.
//
// The live `knowledge_base` table was empty, so every policy answer came from
// the array in src/data/knowledge-base.ts — which no admin can edit, and which
// had drifted from the configuration it described (catalogue auto-approval
// under €500 vs the governed €1,000; approval bands matching no chain). The
// array is now rewritten so governed figures are references
// ({{policy:…}}, {{approval-chains}}, {{preferred-suppliers:…}}), and this
// copies it into the table so Admin → Knowledge base maintains it from here.
//
// Fill-only: an entry an admin has already stored is never overwritten. A
// second run reports nothing to change.
//
//   npm run backfill:knowledge-base-linked   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { knowledgeBase } from '../../src/data/knowledge-base.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('knowledge base linked'));
let changed = 0;

const existing = new Set((await sql`SELECT id FROM knowledge_base`).map((r) => r.id));
for (const entry of knowledgeBase) {
  if (existing.has(entry.id)) { console.log(`= ${entry.id} already stored — left as the admin has it`); continue; }
  console.log(`+ ${entry.id} ${entry.title}`);
  changed += 1;
  if (!DRY) {
    await sql`INSERT INTO knowledge_base (id, title, body, source, tags)
      VALUES (${entry.id}, ${entry.title}, ${entry.body}, ${entry.source}, ${entry.tags})
      ON CONFLICT (id) DO NOTHING`;
  }
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
