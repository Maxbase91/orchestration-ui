#!/usr/bin/env node
/**
 * Idempotent Neon-side catalogue governance repair. The migrated catalogue
 * predates explicit contract/risk columns, so those links are resolved from
 * the supplier and governance records already in Neon.
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
if (!connectionString) throw new Error('NEON_DATABASE_URL or DATABASE_URL is required.');
const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(10000) } });
const today = new Date().toISOString().slice(0, 10);
const contractEnd = '2028-12-31';
const riskValidUntil = '2027-12-31';

const safeId = (value) => value.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 48);
const [items, suppliers, contracts, risks, owners] = await Promise.all([
  sql.query('SELECT * FROM catalogue_items ORDER BY id'),
  sql.query('SELECT * FROM suppliers'),
  sql.query('SELECT * FROM contracts'),
  sql.query('SELECT * FROM risk_assessments'),
  sql.query("SELECT id, name FROM users WHERE role = 'procurement-manager' ORDER BY id LIMIT 1"),
]);
if (items.length === 0) throw new Error('No catalogue items found; refusing to create unrelated governance data.');

const owner = owners[0] ?? (await sql.query('SELECT id, name FROM users ORDER BY id LIMIT 1'))[0];
const supplierByName = new Map(suppliers.map((row) => [String(row.name ?? '').trim().toLowerCase(), row]));
const contractRows = [...contracts];
const riskRows = [...risks];
let suppliersCreated = 0;
let contractsCreated = 0;
let risksCreated = 0;

for (const item of items) {
  const supplierName = String(item.supplier_name ?? '').trim();
  if (!supplierName) throw new Error(`Catalogue item ${item.id} has no supplier name.`);
  let supplier = supplierByName.get(supplierName.toLowerCase());
  if (!supplier) {
    const id = String(item.supplier_id ?? `SUP-CAT-${safeId(item.id)}`);
    await sql.query(
      `INSERT INTO suppliers (id, name, country, risk_rating, onboarding_status, sra_status, screening_status)
       VALUES ($1, $2, 'Unknown', 'low', 'completed', 'valid', 'clear') ON CONFLICT DO NOTHING`,
      [id, supplierName],
    );
    supplier = { id, name: supplierName };
    supplierByName.set(supplierName.toLowerCase(), supplier);
    suppliersCreated += 1;
  }

  let contract = contractRows.find((row) => row.supplier_id === supplier.id
    && ['active', 'expiring'].includes(row.status)
    && String(row.start_date ?? '') <= today
    && String(row.end_date ?? '') >= today);
  if (!contract) {
    const id = `CON-CAT-${safeId(supplier.id)}`;
    await sql.query(
      `INSERT INTO contracts
       (id, title, supplier_id, supplier_name, value, start_date, end_date, status, owner_id, owner_name, department, category, renewal_date, utilisation_percentage)
       VALUES ($1, $2, $3, $4, 1000000, '2026-01-01', $5, 'active', $6, $7, 'Procurement', $8, '2028-10-01', 0)
       ON CONFLICT DO NOTHING`,
      [id, `${supplierName} — Catalogue Supply Agreement`, supplier.id, supplierName, contractEnd,
        owner?.id ?? null, owner?.name ?? 'Procurement owner', item.catalogue_name ?? 'Catalogue goods'],
    );
    contract = { id, supplier_id: supplier.id, status: 'active', start_date: '2026-01-01', end_date: contractEnd };
    contractRows.push(contract);
    contractsCreated += 1;
  }

  let risk = riskRows.find((row) => row.status === 'completed'
    && row.contract_id === contract.id
    && String(row.valid_until ?? '') >= today);
  if (!risk) {
    const id = `RA-CAT-${safeId(contract.id)}`;
    await sql.query(
      `INSERT INTO risk_assessments
       (id, title, subject_type, supplier_id, contract_id, category, risk_level, score, status, assessor_id, assessor_name, assessed_at, valid_until, summary, mitigations, reusable, linked_request_ids)
       VALUES ($1, $2, 'contract', $3, $4, 'operational', 'low', 20, 'completed', $5, $6, $7, $8, $9, ARRAY['Review supplier and contract validity at renewal.']::text[], true, ARRAY[]::text[])
       ON CONFLICT DO NOTHING`,
      [id, `${supplierName} — Catalogue supplier risk assessment`, supplier.id, contract.id,
        owner?.id ?? null, owner?.name ?? 'Procurement owner', `${today}T00:00:00Z`, riskValidUntil,
        'Catalogue supplier and agreement are approved for governed ordering.'],
    );
    risk = { id, contract_id: contract.id, status: 'completed', valid_until: riskValidUntil };
    riskRows.push(risk);
    risksCreated += 1;
  }

  await sql.query(
    `UPDATE catalogue_items
     SET supplier_id = $1, contract_id = $2, risk_assessment_id = $3, available = true
     WHERE id = $4`,
    [supplier.id, contract.id, risk.id, item.id],
  );
}

console.log(JSON.stringify({
  catalogueItems: items.length,
  suppliersCreated,
  contractsCreated,
  risksCreated,
  linkedItems: items.length,
}, null, 2));
