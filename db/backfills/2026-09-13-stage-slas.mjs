#!/usr/bin/env node
// Give every stage node an SLA, so every request can have a deadline.
//
// Only WF-001 carried `slaDays`. WF-002, WF-003 and WF-004 had none on any of
// their 18 stage nodes, and `referred-back` is an *error* node (WF-001's n13)
// that no stage lookup would ever reach. That is why ten open requests had no
// deadline: not a bug in the deadline mechanism, an unconfigured template.
//
// Values were proposed against WF-001's equivalents and approved:
//   Intake 1 · Validation 3 · Approval 5 · Sourcing 20 · Contracting 10
//   PO 2 · Receipt 5 · Invoice 5 · Payment 3 · Risk 7 · Onboarding 5
//
// Referred-back gets 3 days measuring the *requester's* time to respond — the
// request is with them, not with procurement, and one that sits there for weeks
// is exactly what nobody notices today.
//
// Idempotent: a node that already has an slaDays is left alone, so an admin who
// has since tuned one in the Workflow Designer does not get overwritten.
//
//   npm run backfill:stage-slas   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('stage SLAs'));

// Keyed by template, then by node label exactly as the designer shows it.
const SLA_DAYS = {
  'WF-001': { 'Referred Back': 3 },
  'WF-002': {
    'Auto-Validate': 1,        // automated
    'Manager Approval': 3,     // faster than WF-001's 5 — catalogue is low value
    'Auto-PO': 1,              // automated
    'PO Created': 2,           // matches WF-001 PO Creation
    'Receipt': 5,              // matches WF-001
  },
  'WF-003': {
    'Initial Review': 2,
    'Due Diligence': 5,
    'Sanctions Screening': 2,
    'Financial Check': 3,
    'SRA Assessment': 7,       // matches WF-001 Risk Assessment
    'Compliance Approval': 3,
    'System Setup': 2,
  },
  'WF-004': {
    'Performance Review': 5,
    'Market Benchmark': 10,
    'Negotiation': 15,
    'Sourcing (RFP)': 20,      // matches WF-001 Sourcing
    'Approval': 5,             // matches WF-001
    'Contract Execution': 10,  // matches WF-001 Contracting
  },
};

const templates = await sql`SELECT id, name, nodes FROM workflow_templates ORDER BY id`;
let changed = 0;
const unmatched = [];

for (const template of templates) {
  const wanted = SLA_DAYS[template.id];
  if (!wanted) continue;
  const nodes = Array.isArray(template.nodes) ? template.nodes : [];
  let touched = false;

  for (const node of nodes) {
    const days = wanted[node.label];
    if (days == null) continue;
    if (node.slaDays != null) continue;   // an admin may have tuned it since
    node.slaDays = days;
    touched = true;
    changed += 1;
    console.log(`  ${template.id} ${String(node.label).padEnd(22)} → ${days} working days`);
  }

  // Report anything named in the table that the template does not have, rather
  // than failing silently on a renamed node.
  for (const label of Object.keys(wanted)) {
    if (!nodes.some((n) => n.label === label)) unmatched.push(`${template.id}: no node labelled "${label}"`);
  }

  if (touched && !DRY) {
    await sql`UPDATE workflow_templates SET nodes = ${JSON.stringify(nodes)}::jsonb WHERE id = ${template.id}`;
  }
}

if (unmatched.length > 0) {
  console.log('\nNamed in the table but not found in the template:');
  for (const line of unmatched) console.log(`  ${line}`);
}

if (DRY) {
  console.log(`\nDry run — ${changed} node(s) would change.`);
  process.exit(0);
}

// Verify: no stage node anywhere is left without an SLA.
const after = await sql`SELECT id, nodes FROM workflow_templates`;
const missing = [];
for (const t of after) {
  for (const n of (Array.isArray(t.nodes) ? t.nodes : [])) {
    if (n.type === 'stage' && n.slaDays == null) missing.push(`${t.id}/${n.label}`);
  }
}
if (missing.length > 0) {
  console.error(`\nFAILED: ${missing.length} stage node(s) still have no SLA: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`\n${changed} node(s) given an SLA. Every stage node in every template now has one.`);
