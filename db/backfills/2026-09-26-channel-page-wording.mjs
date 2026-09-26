#!/usr/bin/env node
// The Channel page replaced Review & submit (2026-09-26); two stored texts
// still sent people to the step that no longer exists:
//   - AI-002's description ("Runs the policy checks on the Review step"),
//     shown on Admin → AI Agents;
//   - KB-031's step 5 ("Review and submit"), shown on the Help page and quoted
//     by the assistant.
//
// Only the stale sentence is replaced, and only where it is still there, so an
// admin's edits to the rest of either text survive. Idempotent: a second run
// reports nothing to change.
//
//   npm run backfill:channel-page-wording   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('channel page wording'));
let changed = 0;

const EDITS = [
  {
    table: 'ai_agents', id: 'AI-002', column: 'description',
    from: 'Runs the policy checks on the Review step:',
    to: 'Runs the policy checks shown on the Channel page before submit:',
  },
  {
    table: 'knowledge_base', id: 'KB-031', column: 'body',
    from: '\n5. Review and submit. Approvals follow the value bands:',
    to: '\n5. See how it will be bought — every stage it goes through, who approves it and what you do at each — then submit. Approvals follow the value bands:',
  },
];

for (const edit of EDITS) {
  const [row] = await sql.query(`SELECT ${edit.column} AS text FROM ${edit.table} WHERE id = $1`, [edit.id]);
  if (!row) { console.log(`? ${edit.table} ${edit.id} not in the table`); continue; }
  if (!row.text.includes(edit.from)) {
    console.log(row.text.includes(edit.to) ? `= ${edit.table} ${edit.id} already updated` : `? ${edit.table} ${edit.id} was edited — left alone`);
    continue;
  }
  console.log(`~ ${edit.table} ${edit.id}`);
  changed += 1;
  if (!DRY) {
    await sql.query(`UPDATE ${edit.table} SET ${edit.column} = $1 WHERE id = $2`, [row.text.replace(edit.from, edit.to), edit.id]);
  }
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} text(s)`);
