#!/usr/bin/env node
// Name every assistant conversation after the question that started it.
//
// The history lists showed "New conversation" for every thread: the title was
// set only when the conversation existed before its first message, and the
// first message is what creates it (fixed in use-assistant.ts). This names the
// threads already stored, from their first user message, with the same
// conversationTitle() the assistant now uses.
//
// Only conversations still titled "New conversation" and holding a user
// message; a thread with no messages keeps the default, which is true of it.
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:conversation-titles   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { conversationTitle, NEW_CONVERSATION_TITLE } from '../../src/lib/assistant/conversation-title.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('conversation titles'));
let changed = 0;

const rows = await sql`SELECT id, messages FROM assistant_conversations WHERE title = ${NEW_CONVERSATION_TITLE}`;
for (const row of rows) {
  const first = (Array.isArray(row.messages) ? row.messages : []).find((m) => m?.role === 'user' && typeof m.content === 'string' && m.content.trim());
  if (!first) continue;
  const title = conversationTitle(first.content);
  changed += 1;
  if (DRY) { if (changed <= 5) console.log(`~ ${row.id}: ${title}`); continue; }
  await sql`UPDATE assistant_conversations SET title = ${title} WHERE id = ${row.id} AND title = ${NEW_CONVERSATION_TITLE}`;
}

console.log(changed === 0 ? 'Nothing to change.' : `${changed} conversation(s) named${DRY ? ' (dry run — nothing written)' : ''}.`);
