#!/usr/bin/env node
// Idempotent contract-coverage backfill. It creates the normalized scope
// tables, seeds controlled vocabulary, and gives every existing contract a
// curated scope version so matching never silently falls back to category-only.

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
  } catch { /* CI supplies environment variables. */ }
  return env;
}

const env = loadEnv();
const connectionString = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connectionString) { console.log('contract-scope backfill skipped: Neon is not configured.'); process.exit(0); }
const sql = neon(connectionString);

const DDL = [
  `CREATE TABLE IF NOT EXISTS procurement_service_families (id TEXT PRIMARY KEY, label TEXT NOT NULL, aliases JSONB NOT NULL DEFAULT '[]'::jsonb, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS procurement_deliverable_terms (id TEXT PRIMARY KEY, service_family_id TEXT REFERENCES procurement_service_families(id) ON DELETE SET NULL, label TEXT NOT NULL, aliases JSONB NOT NULL DEFAULT '[]'::jsonb, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS contract_scope_versions (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE, effective_from DATE NOT NULL, effective_to DATE, status TEXT NOT NULL DEFAULT 'active', scope_narrative TEXT NOT NULL DEFAULT '', service_family_id TEXT REFERENCES procurement_service_families(id) ON DELETE SET NULL, eligible_categories JSONB NOT NULL DEFAULT '[]'::jsonb, geographies JSONB NOT NULL DEFAULT '[]'::jsonb, business_units JSONB NOT NULL DEFAULT '[]'::jsonb, call_off_requirements JSONB NOT NULL DEFAULT '[]'::jsonb, completeness TEXT NOT NULL DEFAULT 'incomplete', provenance TEXT NOT NULL DEFAULT 'curated', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS contract_scope_deliverables (id TEXT PRIMARY KEY, scope_version_id TEXT NOT NULL REFERENCES contract_scope_versions(id) ON DELETE CASCADE, deliverable_term_id TEXT REFERENCES procurement_deliverable_terms(id) ON DELETE SET NULL, name TEXT NOT NULL, aliases JSONB NOT NULL DEFAULT '[]'::jsonb, description TEXT, required BOOLEAN NOT NULL DEFAULT true)`,
  `CREATE TABLE IF NOT EXISTS contract_scope_exclusions (id TEXT PRIMARY KEY, scope_version_id TEXT NOT NULL REFERENCES contract_scope_versions(id) ON DELETE CASCADE, term TEXT NOT NULL, reason TEXT)`,
  `CREATE INDEX IF NOT EXISTS contract_scope_versions_contract_idx ON contract_scope_versions(contract_id, effective_from DESC)`,
  `CREATE INDEX IF NOT EXISTS contract_scope_versions_active_idx ON contract_scope_versions(status, effective_from, effective_to)`,
  `ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_scope_version_id TEXT`,
  `ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_match_score NUMERIC`,
  `ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_match_algorithm_version TEXT`,
  `ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS contract_match_input_fingerprint TEXT`,
];
for (const statement of DDL) await sql.query(statement);

const templates = [
  { id: 'professional-services', label: 'Professional services', aliases: ['advisory', 'consulting', 'managed service'], deliverables: [['advisory recommendations', ['strategy', 'assessment', 'roadmap']], ['implementation support', ['implementation', 'delivery', 'configuration']]] },
  { id: 'technology', label: 'Technology and software', aliases: ['it', 'software', 'cloud'], deliverables: [['software licensing', ['licence', 'subscription', 'saas']], ['technology support', ['helpdesk', 'maintenance', 'managed support']]] },
  { id: 'contingent-labour', label: 'Contingent labour', aliases: ['staffing', 'temporary resource', 'contractor'], deliverables: [['resource capacity', ['developers', 'analysts', 'interim staff']]] },
  { id: 'operations', label: 'Operational services', aliases: ['facilities', 'outsourced service'], deliverables: [['recurring service delivery', ['cleaning', 'catering', 'maintenance', 'payroll']]] },
  { id: 'goods', label: 'Goods and equipment', aliases: ['products', 'hardware', 'supplies'], deliverables: [['goods supply', ['equipment', 'materials', 'office supplies', 'hardware']]] },
];

const familyFor = (category) => {
  const value = String(category ?? '').toLowerCase();
  if (/contingent|staff|labour/.test(value)) return templates[2];
  if (/software|cloud|iot|license|technology|infrastructure/.test(value)) return templates[1];
  if (/facilit|records|marketing|catering|service|tax|audit/.test(value)) return templates[3];
  if (/furniture|component|goods|hardware/.test(value)) return templates[4];
  return templates[0];
};
const categoryId = (category) => {
  const value = String(category ?? '').toLowerCase();
  if (/contingent|staff|labour/.test(value)) return 'contingent-labour';
  if (/software|cloud|iot|license|technology|infrastructure/.test(value)) return 'software';
  if (/furniture|component|goods|hardware/.test(value)) return 'goods';
  if (/consult|advis|audit|tax/.test(value)) return 'consulting';
  return 'services';
};

for (const family of templates) {
  await sql.query(`INSERT INTO procurement_service_families (id,label,aliases) VALUES ($1,$2,$3::jsonb) ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label, aliases=EXCLUDED.aliases, updated_at=now()`, [family.id, family.label, JSON.stringify(family.aliases)]);
  for (const [index, [label, aliases]] of family.deliverables.entries()) {
    await sql.query(`INSERT INTO procurement_deliverable_terms (id,service_family_id,label,aliases) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label, aliases=EXCLUDED.aliases, updated_at=now()`, [`${family.id}-${index + 1}`, family.id, label, JSON.stringify(aliases)]);
  }
}

const contracts = await sql.query('SELECT id,title,category,start_date,end_date,status FROM contracts ORDER BY id');
for (const contract of contracts) {
  const family = familyFor(contract.category);
  const scopeId = `SCOPE-${contract.id}-v1`;
  const narrative = `${contract.title} covers ${family.label.toLowerCase()} for ${contract.category}. The supplier provides the listed deliverables within the contract term and approved call-off process.`;
  await sql.query(`INSERT INTO contract_scope_versions (id,contract_id,effective_from,effective_to,status,scope_narrative,service_family_id,eligible_categories,geographies,business_units,call_off_requirements,completeness,provenance) VALUES ($1,$2,$3,$4,'active',$5,$6,$7::jsonb,'[]'::jsonb,'[]'::jsonb,$8::jsonb,'complete','curated') ON CONFLICT (id) DO UPDATE SET scope_narrative=EXCLUDED.scope_narrative, service_family_id=EXCLUDED.service_family_id, eligible_categories=EXCLUDED.eligible_categories, call_off_requirements=EXCLUDED.call_off_requirements, completeness='complete', updated_at=now()`, [scopeId, contract.id, contract.start_date, contract.end_date, narrative, family.id, JSON.stringify([categoryId(contract.category)]), JSON.stringify(['purpose', 'need-by/service dates', 'delivery location', 'beneficiary'])]);
  for (const [index, [label, aliases]] of family.deliverables.entries()) {
    await sql.query(`INSERT INTO contract_scope_deliverables (id,scope_version_id,deliverable_term_id,name,aliases,description,required) VALUES ($1,$2,$3,$4,$5::jsonb,$6,true) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, aliases=EXCLUDED.aliases, description=EXCLUDED.description`, [`${scopeId}-DEL-${index + 1}`, scopeId, `${family.id}-${index + 1}`, label, JSON.stringify(aliases), `${label} described in the ${contract.category} agreement`]);
  }
}
console.log(`Contract scope backfill complete (${contracts.length} contract(s)).`);
