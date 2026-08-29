#!/usr/bin/env node
// One-time data migration: fills the six front-door determination columns
// (inherent_risk_tier, materiality_tier, risk_assessment_required,
// screening_outcome, referral_disposition, sourcing_type) on `requests` rows
// that predate them, so the request-detail Compliance tab has something to
// show. Uses the SAME decisioning logic the live wizard runs
// (deriveComplianceBackfill), not invented values.
//
// Surgical: only ever UPDATEs these six columns, only for rows where
// inherent_risk_tier IS NULL, and never touches any other column on any row
// — status, ownership, approvals and everything else a request has picked up
// since it was seeded is left exactly as-is. Idempotent: safe to re-run,
// already-backfilled rows are skipped.
//
// Not registered as `test:*` — this WRITES to the database. Run explicitly:
//   npm run backfill:compliance

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { deriveComplianceBackfill } from '../../src/lib/procurement/compliance-backfill.ts';
import { suppliers } from '../../src/data/suppliers.ts';

for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error('Missing Supabase service-role configuration in .env.local.');

const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const suppliersById = new Map(suppliers.map((s) => [s.id, s]));

const { data: rows, error: selectError } = await sb
  .from('requests')
  .select('id, value, category, buying_channel, supplier_id')
  .is('inherent_risk_tier', null);
if (selectError) throw new Error(`Select failed: ${selectError.message}`);

console.log(`${rows.length} request(s) missing a compliance determination.`);

let updated = 0;
let failed = 0;
for (const row of rows) {
  const supplier = row.supplier_id ? suppliersById.get(row.supplier_id) : undefined;
  const backfill = deriveComplianceBackfill(
    {
      value: row.value,
      category: row.category,
      buyingChannel: row.buying_channel,
      supplierId: row.supplier_id ?? undefined,
    },
    supplier ? { riskRating: supplier.riskRating, screeningStatus: supplier.screeningStatus } : undefined,
  );

  const { error: updateError } = await sb
    .from('requests')
    .update({
      inherent_risk_tier: backfill.inherentRiskTier,
      materiality_tier: backfill.materialityTier,
      risk_assessment_required: backfill.riskAssessmentRequired,
      screening_outcome: backfill.screeningOutcome,
      referral_disposition: backfill.referralDisposition,
      sourcing_type: backfill.sourcingType,
    })
    .eq('id', row.id);

  if (updateError) {
    failed += 1;
    console.error(`  \x1b[31m✗\x1b[0m ${row.id} — ${updateError.message}`);
  } else {
    updated += 1;
  }
}

console.log(`\nUpdated ${updated} row(s), ${failed} failure(s).`);
if (failed > 0) process.exit(1);
