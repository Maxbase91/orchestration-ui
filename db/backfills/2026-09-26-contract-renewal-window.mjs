#!/usr/bin/env node
// The renewal article (KB-006) says what the platform now does: Renewals &
// Expiries lists the contracts in their renewal window — the Decisioning
// threshold `contractExpiryBufferDays`, which every screen reads the contract
// status against — not "contracts ending within 90 days", a number written into
// four screens and applied by none of the rules.
//
// Rewrites the stored article only while it is still the old seeded text: an
// article an administrator has edited is reported and left as they have it.
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:contract-renewal-window   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { knowledgeBase } from '../../src/data/knowledge-base.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('contract renewal window'));

const OLD_BODY = "A contract renewal is a demand like any other:\n1. Contracts → Renewals & Expiries lists contracts ending within 90 days.\n2. Choose Start renewal on the contract (or its row in Renewals & Expiries). It opens New Request with the renewal written.\n3. The contract check recognises the covering contract as expiring when it ends within {{policy:contractExpiryBufferDays}}, and the determination sets the contract type to renew and the sourcing type to renewal.\n4. From there the request follows its buying channel like any other demand.\nIf you are not renewing, plan the hand-over at least 60 days before expiry (policy).";
const entry = knowledgeBase.find((e) => e.id === 'KB-006');
if (!entry) throw new Error('KB-006 is not in the seed');

let changed = 0;
const [row] = await sql`SELECT body, tags FROM knowledge_base WHERE id = 'KB-006'`;
if (!row) {
  console.log('? KB-006 is not stored — nothing to rewrite (the seed backfill adds it)');
} else if (row.body === entry.body) {
  console.log('= KB-006 already describes the renewal window');
} else if (row.body !== OLD_BODY) {
  console.log('! KB-006 has been edited by an administrator — left as it is; check it names {{policy:contractExpiryBufferDays}}');
} else {
  console.log('~ KB-006 Contract Renewal: the renewal window, not 90 days');
  changed += 1;
  if (!DRY) await sql`UPDATE knowledge_base SET body = ${entry.body}, tags = ${entry.tags}, updated_at = now() WHERE id = 'KB-006' AND body = ${OLD_BODY}`;
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
