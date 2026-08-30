#!/usr/bin/env node
/**
 * Idempotent, application-owned data copy from Supabase to Neon.
 * Apply the repository schema to Neon first; this script copies rows only and
 * intentionally does not drop, truncate, or delete anything in either system.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
      const separator = line.indexOf('=');
      if (separator <= 0 || line.trimStart().startsWith('#')) continue;
      const key = line.slice(0, separator).trim();
      if (!(key in env)) env[key] = line.slice(separator + 1).trim().replace(/^"|"$/g, '');
    }
  } catch {
    // CI and Vercel supply environment variables directly.
  }
  return env;
}

const env = loadEnv();
const sourceUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const sourceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const targetUrl = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!sourceUrl || !sourceKey) throw new Error('Supabase URL and service-role key are required.');
if (!targetUrl) throw new Error('NEON_DATABASE_URL or DATABASE_URL is required. Apply schema.sql to Neon before copying data.');

const source = createClient(sourceUrl, sourceKey, { auth: { persistSession: false } });
// Migration batches can cross Neon compute wake-ups; application requests stay
// at the 10-second boundary, while this operator-only copy allows 30 seconds.
const target = neon(targetUrl, { fetchOptions: { signal: AbortSignal.timeout(30000) } });

// Parent records are copied before rows with foreign keys. The ordering also
// makes a failed run restartable without disabling referential integrity.
const TABLES = [
  'users', 'suppliers', 'contracts', 'risk_assessments', 'catalogue_items',
  'user_preferences', 'workflow_templates', 'routing_rules', 'ai_agents', 'kpi_data',
  'form_templates', 'service_description_templates', 'procurement_profiles',
  'procurement_categories', 'sla_targets', 'approval_chains', 'requests', 'stage_history',
  'service_descriptions', 'ai_conversations', 'comments', 'comment_reads',
  'compliance_reports', 'system_integrations', 'form_submissions', 'approval_entries',
  'notifications', 'workflow_step_details', 'workflow_instances',
  'purchase_requisitions', 'request_lines', 'purchase_orders', 'invoices',
  'goods_receipts', 'sourcing_events', 'sourcing_responses', 'tickets',
  'ticket_responses', 'ticket_links', 'audit_entries', 'knowledge_base', 'chat_feedback',
];
const OPTIONAL_SOURCE_TABLES = new Set(['procurement_profiles', 'purchase_requisitions', 'request_lines']);

const BATCH_SIZE = 100;
const jsonColumnsCache = new Map();
const quote = (identifier) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) throw new Error(`Unsafe identifier: ${identifier}`);
  return `"${identifier}"`;
};

async function targetQuery(query, params = []) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await target.query(query, params);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
}

async function readAll(table) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await source.from(table).select('*').range(offset, offset + 999);
    if (error) {
      // These additive governed-checkout tables may not exist in an older
      // Supabase deployment. The target schema still creates them empty.
      if (OPTIONAL_SOURCE_TABLES.has(table) && /does not exist|schema cache|404/i.test(error.message)) return null;
      throw new Error(`${table} read failed: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function targetCount(table) {
  const rows = await targetQuery(`SELECT count(*)::int AS count FROM ${quote(table)}`);
  return Number(rows[0]?.count ?? 0);
}

async function jsonColumns(table) {
  const cached = jsonColumnsCache.get(table);
  if (cached) return cached;
  const rows = await targetQuery(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND data_type IN ('json', 'jsonb')`,
    [table],
  );
  const columns = new Set(rows.map((row) => row.column_name));
  jsonColumnsCache.set(table, columns);
  return columns;
}

async function copyBatch(table, rows) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  if (columns.length === 0) return;
  const jsonColumnsForTable = await jsonColumns(table);
  const params = [];
  const values = rows.map((row) => `(${columns.map((column) => {
    const value = row[column] ?? null;
    params.push(jsonColumnsForTable.has(column) && value !== null && typeof value !== 'string'
      ? JSON.stringify(value)
      : value);
    return `$${params.length}`;
  }).join(', ')})`).join(', ');
  // DO NOTHING is deliberate: reruns are safe and never overwrite a target
  // row that may have been edited after the initial migration.
  await targetQuery(
    `INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES ${values} ON CONFLICT DO NOTHING`,
    params,
  );
}

const report = [];
for (const table of TABLES) {
  const rows = await readAll(table);
  if (rows === null) {
    console.warn(`⚠ ${table}: source table is absent; leaving the Neon table empty`);
    report.push({ table, source: 0, target: await targetCount(table), status: 'skipped-source' });
    continue;
  }
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await copyBatch(table, rows.slice(index, index + BATCH_SIZE));
  }
  const count = await targetCount(table);
  const status = count === rows.length ? 'ok' : 'mismatch';
  report.push({ table, source: rows.length, target: count, status });
  console.log(`${status === 'ok' ? '✓' : '✗'} ${table}: source=${rows.length} target=${count}`);
}

const mismatches = report.filter((entry) => entry.status === 'mismatch');
const skippedSource = report.filter((entry) => entry.status === 'skipped-source');
console.log(`\nCopied ${TABLES.length} tables. ${mismatches.length} count mismatches; ${skippedSource.length} source tables absent.`);
if (skippedSource.length > 0) {
  console.log(`Source-absent tables (target left empty): ${skippedSource.map((entry) => entry.table).join(', ')}`);
}
// An older Supabase deployment may predate additive governed-checkout tables.
// Those are an explicit, reviewable migration condition—not a row-count error.
if (mismatches.length > 0) process.exitCode = 2;
