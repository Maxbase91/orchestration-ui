#!/usr/bin/env node
// Put each form at the stage where it can actually be answered, and retire the
// two that should not be asked at all.
//
// Forms were matched to a request by stage alone (`forStage()` filtered on
// `status === 'active' && triggerStages.includes(stage)` and nothing else), so
// every request in `validation` rendered the Risk Assessment Triage and the
// Full Risk Questionnaire — 22 fields — whatever it was buying. A EUR 500k
// consulting engagement and a EUR 50 stapler order got the same two
// questionnaires, and completing them changed nothing: the stage gate never
// consults `form_submissions`. `form_submissions` is empty for every request in
// the store, which is what a form nobody believes in looks like.
//
// Per-form reasoning:
//
//   FORM-001 Risk Assessment Triage    → disabled. Every question is already
//     answered elsewhere: supplier registration and SRA validity are columns on
//     `suppliers`, estimated spend is `requests.value`, and data sensitivity is
//     captured by the intake conversation (src/lib/procurement/demand-signals.ts).
//     The intake triage already produces the verdict this form re-derives.
//
//   FORM-002 Full Risk Questionnaire   → `risk`. It is supplier due diligence,
//     and at `validation` on a procurement-led request there is no supplier yet
//     — the form was literally unanswerable where it was being shown.
//
//   FORM-006 IT Security Assessment    → `risk`. Same reason; keeps its
//     category=software condition.
//
//   FORM-003 Vendor Onboarding         → `onboarding`. Its trigger stage was
//     `supplier-onboarding`, which is not a RequestStatus, so it has never
//     fired once. The onboarding stage has been running without the form that
//     was written for it.
//
//   FORM-007 Goods Receipt Confirmation → disabled. It duplicates the real
//     mechanism: `GoodsReceiptForm` + `createGoodsReceipt` write `goods_receipts`
//     and advance the request, while this one writes an inert `form_submissions`
//     row and advances nothing. Two ways to record a receipt, one of them a
//     dead end.
//
//   FORM-004 Contract Intake (contracting) and FORM-005 Budget Approval
//     (approval) are already at sensible stages and are left alone.
//
//   FORM-008 Change Request stays `draft` — it triggers on seven stages, which
//     is the pattern this backfill exists to undo.
//
// Leaves `validation` with no forms at all, which is the point: it is the
// category manager's routing check, not a data-capture step.
//
//   npm run backfill:form-stages   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('form stage placement'));

/** id → the change to make, with the reason recorded above. */
const MOVES = [
  { id: 'FORM-001', status: 'disabled', stages: ['validation'], why: 'superseded by intake triage and the supplier record' },
  { id: 'FORM-002', status: 'active', stages: ['risk'], why: 'supplier due diligence — needs a supplier' },
  { id: 'FORM-006', status: 'active', stages: ['risk'], why: 'security assessment is risk work' },
  { id: 'FORM-003', status: 'active', stages: ['onboarding'], why: 'was on a stage id that does not exist' },
  { id: 'FORM-007', status: 'disabled', stages: ['receipt'], why: 'duplicates goods_receipts, which actually advances the request' },
];

let changed = 0;
for (const move of MOVES) {
  const [before] = await sql`SELECT id, name, status, trigger_stages FROM form_templates WHERE id = ${move.id}`;
  if (!before) {
    console.log(`  ${move.id}: not present, skipped`);
    continue;
  }
  const fromStages = JSON.stringify(before.trigger_stages);
  const toStages = JSON.stringify(move.stages);
  if (before.status === move.status && fromStages === toStages) {
    console.log(`  ${move.id}: already ${move.status} on ${toStages}`);
    continue;
  }
  console.log(`  ${move.id} ${before.name}`);
  console.log(`      ${before.status} ${fromStages}  →  ${move.status} ${toStages}`);
  console.log(`      ${move.why}`);
  if (!DRY) {
    // trigger_stages is TEXT[], not jsonb — the driver binds a JS array to it
    // directly. A ::jsonb cast here fails with "column is of type text[]".
    await sql`UPDATE form_templates
              SET status = ${move.status}, trigger_stages = ${move.stages}
              WHERE id = ${move.id}`;
  }
  changed += 1;
}

if (DRY) {
  console.log(`\nDry run — ${changed} template(s) would change.`);
  process.exit(0);
}

// Verify the outcome rather than trusting the writes.
const remaining = await sql`
  SELECT id, name FROM form_templates
  WHERE status = 'active' AND 'validation' = ANY(trigger_stages)
`;
if (remaining.length > 0) {
  console.error(`\nFAILED: ${remaining.length} active form(s) still trigger on validation: `
    + remaining.map((r) => r.id).join(', '));
  process.exit(1);
}

const active = await sql`
  SELECT id, name, trigger_stages FROM form_templates WHERE status = 'active' ORDER BY id
`;
console.log(`\n${changed} template(s) changed. Active forms and their stages:`);
for (const row of active) console.log(`  ${row.id}  ${JSON.stringify(row.trigger_stages).padEnd(18)} ${row.name}`);
console.log('\nNo active form triggers on validation.');
