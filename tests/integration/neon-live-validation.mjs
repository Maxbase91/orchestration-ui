#!/usr/bin/env node
/**
 * Read-only Neon post-migration checks. This validates schema presence,
 * relationship integrity, and catalogue governance without changing rows.
 */
import { readFileSync } from 'node:fs';
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
    // CI may provide environment variables directly.
  }
  return env;
}

const env = loadEnv();
const connectionString = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connectionString) {
  console.log('Neon live validation skipped: NEON_DATABASE_URL/DATABASE_URL is not configured.');
  process.exit(0);
}

const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(10000) } });
const expectedTables = [
  'users', 'suppliers', 'contracts', 'risk_assessments', 'catalogue_items',
  'user_preferences', 'workflow_templates', 'routing_rules', 'ai_agents', 'kpi_data',
  'form_templates', 'service_description_templates', 'procurement_profiles',
  'procurement_categories', 'sla_targets', 'approval_chains', 'requests', 'stage_history',
  'service_descriptions', 'ai_conversations', 'assistant_conversations', 'comments', 'comment_reads',
  'compliance_reports', 'system_integrations', 'form_submissions', 'approval_entries',
  'notifications', 'workflow_step_details', 'workflow_instances',
  'purchase_requisitions', 'request_lines', 'purchase_orders', 'invoices',
  'goods_receipts', 'sourcing_events', 'sourcing_responses', 'tickets',
  'ticket_responses', 'ticket_links', 'audit_entries', 'knowledge_base', 'chat_feedback',
];

const failures = [];
const check = (label, passed, detail) => {
  if (passed) console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? ` (${detail})` : ''}`);
  else {
    failures.push(label);
    console.error(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` (${detail})` : ''}`);
  }
};

const tableRows = await sql.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
  [expectedTables],
);
const presentTables = new Set(tableRows.map((row) => row.table_name));
check('all repository tables exist in Neon', presentTables.size === expectedTables.length,
  `${presentTables.size}/${expectedTables.length}`);
if (presentTables.size !== expectedTables.length) {
  const missing = expectedTables.filter((table) => !presentTables.has(table));
  console.error(`    Missing: ${missing.join(', ')}`);
}

const functionRows = await sql.query(
  `SELECT p.proname FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
  [['next_ticket_id', 'next_sourcing_event_id']],
);
const presentFunctions = new Set(functionRows.map((row) => row.proname));
check('documented ID functions exist', presentFunctions.size === 2, `${presentFunctions.size}/2`);

const orphanRequests = await sql.query(
  `SELECT count(*)::int AS count FROM requests r
   LEFT JOIN users u ON u.id = r.requestor_id
   WHERE r.requestor_id IS NOT NULL AND u.id IS NULL`,
);
check('requestor references are intact', Number(orphanRequests[0]?.count ?? 0) === 0,
  `${orphanRequests[0]?.count ?? 0} orphan(s)`);

const orphanPurchaseOrders = await sql.query(
  `SELECT count(*)::int AS count FROM purchase_orders po
   LEFT JOIN requests r ON r.id = po.request_id
   WHERE po.request_id IS NOT NULL AND r.id IS NULL`,
);
check('purchase-order request links are intact', Number(orphanPurchaseOrders[0]?.count ?? 0) === 0,
  `${orphanPurchaseOrders[0]?.count ?? 0} orphan(s)`);

const orphanContracts = await sql.query(
  `SELECT count(*)::int AS count FROM contracts c
   LEFT JOIN suppliers s ON s.id = c.supplier_id
   WHERE c.supplier_id IS NOT NULL AND s.id IS NULL`,
);
check('contract supplier links are intact', Number(orphanContracts[0]?.count ?? 0) === 0,
  `${orphanContracts[0]?.count ?? 0} orphan(s)`);

const governance = await sql.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE ci.supplier_id IS NULL OR s.id IS NULL) ::int AS missing_supplier,
          count(*) FILTER (WHERE ci.contract_id IS NULL OR c.id IS NULL) ::int AS missing_contract,
          count(*) FILTER (WHERE ci.risk_assessment_id IS NULL OR ra.id IS NULL) ::int AS missing_risk,
          count(*) FILTER (WHERE c.id IS NOT NULL AND c.supplier_id IS DISTINCT FROM ci.supplier_id) ::int AS supplier_mismatch,
          count(*) FILTER (WHERE c.id IS NOT NULL AND (NULLIF(c.start_date, '')::date > CURRENT_DATE OR NULLIF(c.end_date, '')::date < CURRENT_DATE)) ::int AS expired_contract,
          count(*) FILTER (WHERE c.id IS NOT NULL AND c.status NOT IN ('active', 'expiring')) ::int AS non_active_contract,
          count(*) FILTER (WHERE ra.id IS NOT NULL AND ra.contract_id IS DISTINCT FROM ci.contract_id) ::int AS risk_contract_mismatch,
          count(*) FILTER (WHERE ra.id IS NOT NULL AND ra.valid_until IS NOT NULL AND ra.valid_until < CURRENT_DATE) ::int AS expired_risk
   FROM catalogue_items ci
   LEFT JOIN suppliers s ON s.id = ci.supplier_id
   LEFT JOIN contracts c ON c.id = ci.contract_id
   LEFT JOIN risk_assessments ra ON ra.id = ci.risk_assessment_id`,
);
const governanceRow = governance[0] ?? {};
check('catalogue governance links resolve',
  Number(governanceRow.missing_supplier ?? 0) === 0 && Number(governanceRow.missing_contract ?? 0) === 0 && Number(governanceRow.missing_risk ?? 0) === 0,
  `${governanceRow.total ?? 0} item(s), ${governanceRow.missing_supplier ?? 0} missing supplier, ${governanceRow.missing_contract ?? 0} missing contract, ${governanceRow.missing_risk ?? 0} missing risk`);
check('catalogue supplier and contract links agree', Number(governanceRow.supplier_mismatch ?? 0) === 0,
  `${governanceRow.supplier_mismatch ?? 0} mismatch(es)`);
check('catalogue contracts are current', Number(governanceRow.expired_contract ?? 0) === 0,
  `${governanceRow.expired_contract ?? 0} expired contract link(s)`);
check('catalogue items use active/expiring contracts', Number(governanceRow.non_active_contract ?? 0) === 0,
  `${governanceRow.non_active_contract ?? 0} non-active contract link(s)`);
check('catalogue risk links match contracts', Number(governanceRow.risk_contract_mismatch ?? 0) === 0,
  `${governanceRow.risk_contract_mismatch ?? 0} mismatch(es)`);
check('catalogue items have current risk assessments', Number(governanceRow.expired_risk ?? 0) === 0,
  `${governanceRow.expired_risk ?? 0} expired risk link(s)`);

if (failures.length > 0) {
  console.error(`Neon live validation failed: ${failures.length} check(s).`);
  process.exitCode = 1;
} else {
  console.log('Neon live validation passed.');
}
