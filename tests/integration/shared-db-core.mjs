#!/usr/bin/env node
// Browser and server write tickets and preferences through ONE implementation.
//
// They did not. src/lib/db/tickets.ts imports the '@/'-aliased browser client,
// which Vercel cannot resolve at runtime, so api/chat.ts carried its own copy
// of the ticket insert. The copy had drifted: it set no due_at, so every
// assistant-raised ticket was created with no SLA while form-raised ones had
// one — the exact class of defect a second copy produces, and the reason the
// duplication is worth removing rather than tolerating.
//
// This runs the SERVER path (getDbAdmin, in-process executor) against live Neon
// and asserts the ticket comes out with the SLA the shared core computes.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireConnection, skipIfUnreachable } from '../lib/live.mjs';

loadEnv();
const connectionString = requireConnection('shared-db-core');
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);

const { getDbAdmin } = await import('../../api/_db-admin.ts');
const { createTicketWith, loadTicketSlaTargetsWith } = await import('../../src/lib/db/tickets-core.ts');
const { mergePreferences, readPreferences } = await import('../../src/lib/db/user-preferences-core.ts');

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

const suffix = Date.now().toString(36);
const userId = `TEST-CORE-U-${suffix}`;
let ticketId = null;

async function cleanup() {
  if (ticketId) await sql.query('DELETE FROM tickets WHERE id = $1', [ticketId]);
  await sql.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
}

try {
  const client = getDbAdmin();

  console.log('\nThe server path creates a ticket with an SLA');

  let row;
  try {
    row = await createTicketWith(client, {
      summary: `Shared core check ${suffix}`,
      context: 'Automated verification that the assistant path shares the ticket writer.',
      createdBy: userId,
      source: 'assistant',
      priority: 'high',
    });
  } catch (error) {
    skipIfUnreachable('shared-db-core', error);
    throw error;
  }
  ticketId = String(row.id);

  check('the ticket got a sequence id, not a timestamp fallback', () => {
    if (!/^TKT-\d{4,}$/.test(ticketId)) throw new Error(`id is ${ticketId}`);
  });
  check('the assistant-raised ticket has an SLA due date', () => {
    // The whole point: api/chat.ts's old copy never set this.
    if (!row.due_at) throw new Error('due_at is null — the SLA divergence is back');
  });
  check('the due date is in the future', () => {
    if (new Date(row.due_at).getTime() <= Date.now()) throw new Error(`due_at ${row.due_at} is not ahead of now`);
  });
  check('it is recorded as assistant-sourced', () => {
    if (row.source !== 'assistant') throw new Error(`source is ${row.source}`);
  });

  const stored = await sql.query('SELECT due_at, priority FROM tickets WHERE id = $1', [ticketId]);
  check('the row really is in the database with its due date', () => {
    if (!stored[0]) throw new Error('no row');
    if (!stored[0].due_at) throw new Error('stored due_at is null');
  });

  const targets = await loadTicketSlaTargetsWith(client);
  check('the SLA targets came from the shared table', () => {
    if (!Array.isArray(targets)) throw new Error('not an array');
  });

  console.log('\nThe server path merges preferences rather than replacing them');

  await mergePreferences(client, userId, { currency: 'EUR' });
  await mergePreferences(client, userId, { approvalDelegate: 'u2' });
  const prefs = await readPreferences(client, userId);
  check('an earlier key survives a later merge', () => {
    if (prefs.currency !== 'EUR') throw new Error(`currency is ${prefs.currency}`);
    if (prefs.approvalDelegate !== 'u2') throw new Error(`delegate is ${prefs.approvalDelegate}`);
  });

  console.log('\nThere is only one implementation of each');

  const chat = read('api/chat.ts');
  check('api/chat.ts no longer inserts tickets itself', () => {
    if (/\.from\('tickets'\)\s*\.insert/.test(chat)) throw new Error('a second ticket insert remains');
    if (!chat.includes('createTicketWith')) throw new Error('it does not use the shared core');
  });
  check('api/chat.ts no longer upserts preferences itself', () => {
    if (/\.from\('user_preferences'\)\s*\.upsert/.test(chat)) throw new Error('a second preference upsert remains');
    if (!chat.includes('mergePreferences')) throw new Error('it does not use the shared core');
  });
  check('the browser module delegates rather than duplicating', () => {
    const browser = read('src/lib/db/tickets.ts');
    if (!browser.includes('createTicketWith')) throw new Error('tickets.ts does not delegate');
    if (/\.from\(TABLE\)\s*\.insert\(\{\s*id,/.test(browser)) throw new Error('tickets.ts still has its own insert');
  });
  check('the core is import-safe for Vercel (no @/ specifiers)', () => {
    for (const path of ['src/lib/db/tickets-core.ts', 'src/lib/db/user-preferences-core.ts', 'src/lib/procurement/ticket-sla.ts']) {
      if (/from '@\//.test(read(path))) throw new Error(`${path} still uses the @/ alias`);
    }
  });
} finally {
  await cleanup();
}

if (failures > 0) {
  console.error(`\nshared-db-core: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nShared data-core checks passed.');
