#!/usr/bin/env node
// The Help page reads the knowledge base: topics, order, and its own articles.
//
// Help → Knowledge base was twelve articles in the page's code — a Direct PO
// channel, a supplier-onboarding request, email escalation after three days,
// round-robin assignment, none of which the platform has. Six of them already
// had a corrected knowledge-base entry; the other six are new entries here
// (KB-032…KB-037), rewritten against the rules, workflows and screens, with
// their figures linked to configuration.
//
// Every entry gets a topic and an order (the columns the page groups and sorts
// by). Fill-only: an entry an admin has given a topic keeps it, and an entry
// already stored is never rewritten.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:knowledge-base-topics   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { knowledgeBase } from '../../src/data/knowledge-base.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('knowledge base topics'));
let changed = 0;

const stored = new Map((await sql`SELECT id, topic FROM knowledge_base`).map((r) => [r.id, r.topic]));
for (const entry of knowledgeBase) {
  if (!stored.has(entry.id)) {
    console.log(`+ ${entry.id} ${entry.title} (${entry.topic})`);
    changed += 1;
    if (!DRY) {
      await sql`INSERT INTO knowledge_base (id, title, body, source, tags, topic, sort_order)
        VALUES (${entry.id}, ${entry.title}, ${entry.body}, ${entry.source}, ${entry.tags}, ${entry.topic}, ${entry.sortOrder})
        ON CONFLICT (id) DO NOTHING`;
    }
  } else if (!stored.get(entry.id)) {
    console.log(`~ ${entry.id} → ${entry.topic}, order ${entry.sortOrder}`);
    changed += 1;
    if (!DRY) {
      await sql`UPDATE knowledge_base SET topic = ${entry.topic}, sort_order = ${entry.sortOrder}
        WHERE id = ${entry.id} AND topic = ''`;
    }
  }
}

console.log(changed === 0 ? '\nNothing to change.' : `\n${changed} change(s)${DRY ? ' (dry run — nothing written)' : ''}.`);
