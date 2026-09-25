#!/usr/bin/env node
// Retire the Direct PO and P-card channels.
//
// Neither was reachable honestly from the intake: Direct PO only through one
// routing rule (RR-009, removed by backfill:door1-routing), P-card through no
// rule at all — thresholds and a template with nothing behind them.
//
//   1. The three requests on direct-po move to the channel they actually are
//      under the Door 1 rules: two goods demands under the business-led
//      ceiling → business-led (WF-006); the one covered by contract CON-012 →
//      contract call-off (WF-008). Their stored compliance record follows. None
//      has a workflow instance, and each one's stage exists on its new path.
//   2. WF-005 and WF-007 are deleted once no request or instance names them.
//   3. The P-card keys are removed from the stored policy row.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:retire-direct-po-pcard   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('retire direct-po and p-card'));
let changed = 0;

const MOVES = {
  'REQ-2024-0025': { channel: 'business-led', template: 'WF-006', label: 'Business-Led',
    reasoning: 'Value (€28,000) is under the business-led ceiling and no contract covers it.' },
  'REQ-2025-0117': { channel: 'business-led', template: 'WF-006', label: 'Business-Led',
    reasoning: 'Value (€48,000) is under the business-led ceiling and no contract covers it.' },
  'REQ-2024-0018': { channel: 'framework-call-off', template: 'WF-008', label: 'Framework Call-Off',
    reasoning: 'An active contract (CON-012) covers records management, so this is called off it.' },
};
for (const [id, m] of Object.entries(MOVES)) {
  const [row] = await sql`SELECT buying_channel, workflow_template_id FROM requests WHERE id = ${id}`;
  if (!row) { console.log(`! ${id} not found`); continue; }
  if (row.buying_channel === m.channel && row.workflow_template_id === m.template) { console.log(`= ${id} already ${m.channel}`); continue; }
  console.log(`~ ${id}: ${row.buying_channel}/${row.workflow_template_id} → ${m.channel}/${m.template}`);
  changed += 1;
  if (DRY) continue;
  await sql`UPDATE requests SET buying_channel = ${m.channel}, workflow_template_id = ${m.template} WHERE id = ${id}`;
  await sql`UPDATE intake_compliance_records
               SET buying_channel = ${JSON.stringify({ channel: m.channel, label: m.label, reasoning: m.reasoning })}::jsonb
             WHERE request_id = ${id} AND buying_channel->>'channel' = 'direct-po'`;
}

const stray = await sql`SELECT id, buying_channel FROM requests WHERE buying_channel IN ('direct-po', 'p-card')`;
if (stray.length && !DRY) throw new Error(`Requests still on a retired channel: ${stray.map((r) => r.id).join(', ')}`);

for (const wf of ['WF-005', 'WF-007']) {
  const [t] = await sql`SELECT id FROM workflow_templates WHERE id = ${wf}`;
  if (!t) { console.log(`= ${wf} already gone`); continue; }
  const [{ n }] = await sql`SELECT (SELECT count(*) FROM requests WHERE workflow_template_id = ${wf}) + (SELECT count(*) FROM workflow_instances WHERE template_id = ${wf}) AS n`;
  if (Number(n) > 0 && !DRY) throw new Error(`${wf} is still referenced by ${n} row(s)`);
  console.log(`- ${wf}`);
  changed += 1;
  if (!DRY) await sql`DELETE FROM workflow_templates WHERE id = ${wf}`;
}

const P_CARD_KEYS = ['pCardEnabled', 'pCardMaxValue', 'pCardEligibleCategories', 'pCardExcludedCategories'];
const [policy] = await sql`SELECT config FROM procurement_policy_configs WHERE singleton_key = 'default'`;
const present = P_CARD_KEYS.filter((k) => policy?.config && k in policy.config);
if (present.length === 0) console.log('= policy row has no P-card keys');
else {
  console.log(`- policy keys ${present.join(', ')}`);
  changed += 1;
  if (!DRY) await sql`UPDATE procurement_policy_configs SET config = config - ${present}::text[] WHERE singleton_key = 'default'`;
}
console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} item(s)`);
