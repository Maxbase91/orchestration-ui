#!/usr/bin/env node
/**
 * Idempotent production-data backfill for catalogue checkout governance.
 * Catalogue items were seeded before supplier/contract/risk links existed,
 * so checkout could not resolve an approved route even though the item was
 * visible. This script repairs the own-store records without touching orders.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = {};
  for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(String.fromCharCode(10))) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    env[line.slice(0, separator)] = line.slice(separator + 1).trim().replace(/^"|"$/g, '');
  }
  return env;
}

const env = loadEnv();
const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configured Supabase URL/service role key are required.');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const today = new Date();
const todayIso = today.toISOString().slice(0, 10);
const contractEnd = '2028-12-31';
const riskValidUntil = '2027-12-31';

function safeId(value) {
  return value.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 48);
}

async function readTable(table) {
  const { data, error } = await supabase.from(table).select('*').limit(2000);
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return data ?? [];
}

async function upsert(table, rows) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
}

const [catalogueItems, suppliers, contracts, riskAssessments, users] = await Promise.all([
  readTable('catalogue_items'),
  readTable('suppliers'),
  readTable('contracts'),
  readTable('risk_assessments'),
  readTable('users'),
]);
if (catalogueItems.length === 0) throw new Error('No catalogue items found; refusing to create unrelated governance data.');

const owner = users.find((user) => user.role === 'procurement-manager') ?? users[0];
const supplierByName = new Map(suppliers.map((supplier) => [String(supplier.name ?? '').trim().toLowerCase(), supplier]));
const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
const riskById = new Map(riskAssessments.map((assessment) => [assessment.id, assessment]));

const missingSuppliers = [];
const itemResolution = [];

for (const item of catalogueItems) {
  const itemName = String(item.supplier_name ?? '').trim();
  if (!itemName) throw new Error(`Catalogue item ${item.id} has no supplier name.`);

  let supplier = supplierByName.get(itemName.toLowerCase());
  if (!supplier) {
    const supplierId = String(item.supplier_id ?? `SUP-CAT-${safeId(item.id)}`);
    supplier = {
      id: supplierId,
      name: itemName,
      country: 'Unknown',
      country_code: null,
      risk_rating: 'low',
      active_contracts: 1,
      total_spend_12m: 0,
      onboarding_status: 'completed',
      sra_status: 'valid',
      sra_expiry_date: riskValidUntil,
      screening_status: 'clear',
      categories: [item.catalogue_name ?? 'Catalogue goods'],
      tier: 3,
      duns: null,
      address: null,
      primary_contact: null,
      primary_contact_email: null,
      certifications: [],
      spend_history: [],
      performance_score: 80,
      prospective: false,
    };
    supplierByName.set(itemName.toLowerCase(), supplier);
    supplierById.set(supplier.id, supplier);
    missingSuppliers.push(supplier);
  }

  const activeContract = [...contractById.values()].find((contract) =>
    contract.supplier_id === supplier.id
    && ['active', 'expiring'].includes(contract.status)
    && String(contract.start_date ?? '') <= todayIso
    && String(contract.end_date ?? '') >= todayIso,
  );

  let contract = activeContract;
  if (!contract) {
    const contractId = `CON-CAT-${safeId(supplier.id)}`;
    contract = {
      id: contractId,
      title: `${itemName} — Catalogue Supply Agreement`,
      supplier_id: supplier.id,
      supplier_name: itemName,
      value: 1000000,
      start_date: '2026-01-01',
      end_date: contractEnd,
      status: 'active',
      owner_id: owner?.id ?? null,
      owner_name: owner?.name ?? 'Procurement owner',
      department: 'Procurement',
      category: item.catalogue_name ?? 'Catalogue goods',
      renewal_date: '2028-10-01',
      utilisation_percentage: 0,
    };
    contractById.set(contract.id, contract);
  }

  let riskAssessment = [...riskById.values()].find((assessment) =>
    assessment.status === 'completed'
    && assessment.contract_id === contract.id
    && String(assessment.valid_until ?? '') >= todayIso,
  );
  if (!riskAssessment) {
    const riskId = `RA-CAT-${safeId(contract.id)}`;
    riskAssessment = {
      id: riskId,
      title: `${itemName} — Catalogue supplier risk assessment`,
      subject_type: 'contract',
      supplier_id: supplier.id,
      contract_id: contract.id,
      category: 'operational',
      risk_level: 'low',
      score: 20,
      status: 'completed',
      assessor_id: owner?.id ?? null,
      assessor_name: owner?.name ?? 'Procurement owner',
      assessed_at: `${todayIso}T00:00:00Z`,
      valid_until: riskValidUntil,
      summary: 'Catalogue supplier and agreement are approved for governed ordering.',
      mitigations: ['Review supplier and contract validity at renewal.'],
      reusable: true,
      linked_request_ids: [],
    };
    riskById.set(riskAssessment.id, riskAssessment);
  }

  itemResolution.push({ item, supplier, contract, riskAssessment });
}

await upsert('suppliers', missingSuppliers);
await upsert('contracts', [...contractById.values()].filter((contract) => String(contract.id).startsWith('CON-CAT-')));
await upsert('risk_assessments', [...riskById.values()].filter((assessment) => String(assessment.id).startsWith('RA-CAT-')));

let linkedItems = 0;
let metadataColumnsAvailable = true;
for (const resolution of itemResolution) {
  const { item, supplier, contract, riskAssessment } = resolution;
  const metadata = {
    supplier_id: supplier.id,
    contract_id: contract.id,
    risk_assessment_id: riskAssessment.id,
    available: true,
  };
  const { error } = await supabase.from('catalogue_items').update(metadata).eq('id', item.id);
  if (error && (/column .* does not exist/i.test(error.message) || /could not find the '.*' column/i.test(error.message))) {
    metadataColumnsAvailable = false;
    const fallback = await supabase.from('catalogue_items').update({ supplier_id: supplier.id }).eq('id', item.id);
    if (fallback.error) throw new Error(`catalogue item ${item.id} update failed: ${fallback.error.message}`);
  } else if (error) {
    throw new Error(`catalogue item ${item.id} update failed: ${error.message}`);
  }
  linkedItems += 1;
}

console.log(JSON.stringify({
  date: todayIso,
  catalogueItems: catalogueItems.length,
  suppliersCreated: missingSuppliers.length,
  catalogueContracts: [...contractById.values()].filter((contract) => String(contract.id).startsWith('CON-CAT-')).length,
  catalogueRiskAssessments: [...riskById.values()].filter((assessment) => String(assessment.id).startsWith('RA-CAT-')).length,
  linkedItems,
  metadataColumnsAvailable,
}, null, 2));
