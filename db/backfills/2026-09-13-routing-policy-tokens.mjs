#!/usr/bin/env node
// Point routing rules at governed thresholds and real approval chains.
//
// Two migrations, both of which make a rule say what it does.
//
// 1. Value thresholds become `policy:<key>` tokens, so /admin/thresholds moves
//    them. Only where the number AND the meaning match: RR-002's €5,000 equals
//    pCardMaxValue numerically but "low-value catalogue" is not the card cap,
//    and RR-005's €50,000 equals riskMediumValue but a channel boundary is not
//    an inherent-risk band. Coincidence is not identity — those stay literal.
//
// 2. `action.approvalChain` becomes an approval_chains id, or '' meaning "let
//    the value band decide". It held a role-path string for as long as the
//    field existed while intake looked it up as an id, so it never matched and
//    the band always decided. Ten rules move to the band default, which is what
//    they have effectively been doing.
//
//    RR-008 and RR-012 are the exception. Both were written to escalate
//    compliance-sensitive demand — "compliance review before category manager
//    approval", "extended approval chain" — and no compliance chain existed to
//    escalate to; the four configured chains are all value bands. So this also
//    CREATES that chain, unbanded, reachable only by a rule naming it. That
//    depends on the fix landing alongside: a chain with no parseable band used
//    to match every value and shadow every banded chain behind it.
//
//   npm run backfill:routing-tokens   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('routing policy tokens'));

/** conditionIndex-keyed replacement, matched on the literal so a re-run is a no-op. */
const TOKENS = {
  'RR-001': { from: '100000', to: 'policy:budgetApprovalThreshold' },
  'RR-006': { from: '1000000', to: 'policy:materialityValueThreshold' },
  'RR-007': { from: '25000', to: 'policy:competitiveSourcingThreshold' },
};

const COMPLIANCE_CHAIN = {
  id: 'chain-compliance',
  name: 'Compliance Escalation',
  description: 'Supplier-manager and compliance review before category-manager approval. Selected by a routing rule, never by value.',
  // Deliberately no numeric band: this chain must never be picked by value,
  // only by a rule naming it. parseThresholdBand returns null for this string.
  threshold: 'By routing rule only',
  steps: [
    { id: 'cs1', role: 'Supplier Manager' },
    { id: 'cs2', role: 'Legal' },
    { id: 'cs3', role: 'Category Manager' },
  ],
  referenced_by: ['RR-008', 'RR-012'],
};

const RULE_CHAINS = { 'RR-008': COMPLIANCE_CHAIN.id, 'RR-012': COMPLIANCE_CHAIN.id };

let changed = 0;

// ── The compliance chain ────────────────────────────────────────────────────
const existing = await sql`SELECT id FROM approval_chains WHERE id = ${COMPLIANCE_CHAIN.id}`;
if (existing.length === 0) {
  console.log(`+ approval_chains ${COMPLIANCE_CHAIN.id} "${COMPLIANCE_CHAIN.name}" (${COMPLIANCE_CHAIN.steps.length} steps, no value band)`);
  if (!DRY) {
    await sql`
      INSERT INTO approval_chains (id, name, description, threshold, steps, referenced_by)
      VALUES (${COMPLIANCE_CHAIN.id}, ${COMPLIANCE_CHAIN.name}, ${COMPLIANCE_CHAIN.description},
              ${COMPLIANCE_CHAIN.threshold}, ${JSON.stringify(COMPLIANCE_CHAIN.steps)}::jsonb,
              ${JSON.stringify(COMPLIANCE_CHAIN.referenced_by)}::jsonb)`;
  }
  changed += 1;
} else {
  console.log(`= approval_chains ${COMPLIANCE_CHAIN.id} already exists`);
}

// ── The rules ───────────────────────────────────────────────────────────────
const rules = await sql`SELECT id, conditions, action FROM routing_rules ORDER BY id`;
for (const rule of rules) {
  const conditions = rule.conditions ?? [];
  const action = rule.action ?? {};
  let touched = false;

  const token = TOKENS[rule.id];
  const nextConditions = conditions.map((c) => {
    if (!token || c.field !== 'value' || c.value !== token.from) return c;
    touched = true;
    console.log(`  ${rule.id}: value ${c.operator} ${token.from} → ${token.to}`);
    return { ...c, value: token.to };
  });

  const wantChain = RULE_CHAINS[rule.id] ?? '';
  // A role-path string is anything that is not an id we know; '' is the
  // band default. Only rewrite when it actually differs, so re-runs are quiet.
  if ((action.approvalChain ?? '') !== wantChain) {
    console.log(`  ${rule.id}: approvalChain "${action.approvalChain ?? ''}" → "${wantChain}"${wantChain ? '' : ' (value band decides)'}`);
    touched = true;
  }

  if (!touched) continue;
  changed += 1;
  if (DRY) continue;
  await sql`
    UPDATE routing_rules
       SET conditions = ${JSON.stringify(nextConditions)}::jsonb,
           action = ${JSON.stringify({ ...action, approvalChain: wantChain })}::jsonb
     WHERE id = ${rule.id}`;
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} row(s)`);
