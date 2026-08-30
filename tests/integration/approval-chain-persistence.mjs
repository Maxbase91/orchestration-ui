#!/usr/bin/env node
// Verifies that a full request can persist the actual approval-chain primary
// key selected for its value band, then deletes the isolated test request.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error('Missing Supabase service-role test configuration.');

const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

function parseThresholdBand(threshold) {
  const values = (threshold.match(/[\d,]+(?:\.\d+)?/g) ?? [])
    .map((value) => Number(value.replace(/,/g, '')))
    .filter(Number.isFinite);
  if (values.length === 0) return { min: 0, max: Infinity };
  if (/</.test(threshold) && values.length === 1) return { min: 0, max: values[0] };
  if (/>/.test(threshold) && values.length === 1) return { min: values[0], max: Infinity };
  if (values.length >= 2) return { min: values[0], max: values[1] };
  return { min: values[0], max: Infinity };
}

const value = 60_000;
const source = readFileSync(new URL('../../src/features/requests/new-request/step-compliance.tsx', import.meta.url), 'utf8');
const dbProxy = readFileSync(new URL('../../api/db.ts', import.meta.url), 'utf8');
check('Neon update proxy binds SET values before filters', dbProxy.includes('const updateWhere = whereClause(request, whereParams, bodyParams.length)'));
check('Neon update proxy emits typed-safe SQL NULL literals', dbProxy.includes("if (value === null) return 'NULL';"));
check(
  'wizard persists a configured approval-chain id rather than the routing label',
  source.includes('approvalChain: configuredChain?.id ?? valueBandedChain?.id'),
);

const { data: chains, error: chainsError } = await sb.from('approval_chains').select('id,threshold');
if (chainsError) throw new Error(chainsError.message);
const chain = (chains ?? []).find((candidate) => {
  const { min, max } = parseThresholdBand(candidate.threshold);
  return value >= min && value < max;
});
check('a configured chain covers the test value', Boolean(chain), `value=${value}`);

const { data: user, error: userError } = await sb.from('users').select('id').limit(1).maybeSingle();
if (userError || !user) throw new Error(userError?.message ?? 'No user row available.');

const id = `E2E-CHAIN-${Date.now()}`;
try {
  if (chain) {
    const { error } = await sb.from('requests').insert({
      id,
      title: 'E2E approval-chain persistence check',
      description: 'Temporary integration-test record; removed by this test.',
      category: 'services',
      status: 'intake',
      priority: 'medium',
      value,
      currency: 'EUR',
      requestor_id: user.id,
      owner_id: user.id,
      approval_chain: chain.id,
      is_urgent: false,
      days_in_stage: 0,
      is_overdue: false,
      refer_back_count: 0,
    });
    check('request insert accepts the selected approval-chain foreign key', !error, error?.message ?? '');

    const { data: saved } = await sb.from('requests').select('approval_chain').eq('id', id).maybeSingle();
    check('selected approval-chain id round-trips from the request', saved?.approval_chain === chain.id, `saved=${saved?.approval_chain} expected=${chain.id}`);
  }
} finally {
  const { error } = await sb.from('requests').delete().eq('id', id);
  check('temporary request is removed', !error, error?.message ?? '');
}

if (failures) process.exit(1);
console.log('All approval-chain persistence checks passed.');
