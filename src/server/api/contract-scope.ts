// Contract coverage administration endpoint. It exposes only the normalized
// scope aggregate needed by the contract detail screen; checkout still owns
// all transactional request/PR/PO writes.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from '../../../api/_neon.js';

type Row = Record<string, unknown>;
const isRecord = (value: unknown): value is Row => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const strings = (value: unknown): string[] => Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const errorText = (error: unknown): string => error instanceof Error ? error.message : 'Contract coverage is unavailable.';
function mapVersion(row: Row): Row {
  return {
    id: String(row.id), contractId: String(row.contract_id), effectiveFrom: String(row.effective_from).slice(0, 10),
    ...(row.effective_to ? { effectiveTo: String(row.effective_to).slice(0, 10) } : {}), status: row.status,
    scopeNarrative: text(row.scope_narrative), serviceFamily: text(row.service_family ?? row.service_family_id),
    eligibleCategories: strings(row.eligible_categories), geographies: strings(row.geographies), businessUnits: strings(row.business_units),
    callOffRequirements: strings(row.call_off_requirements), completeness: row.completeness, provenance: row.provenance,
  };
}
function mapDeliverable(row: Row): Row { return { id: String(row.id), scopeVersionId: String(row.scope_version_id), name: text(row.name), aliases: strings(row.aliases), description: text(row.description) || undefined, required: row.required !== false }; }
function mapExclusion(row: Row): Row { return { id: String(row.id), scopeVersionId: String(row.scope_version_id), term: text(row.term), reason: text(row.reason) || undefined }; }

function validate(body: unknown): { contractId: string; scope: Row; deliverables: Row[]; exclusions: Row[] } {
  if (!isRecord(body) || !text(body.contractId) || !isRecord(body.scope)) throw new Error('contractId and scope are required.');
  const scope = body.scope;
  if (!text(scope.effectiveFrom) || !text(scope.scopeNarrative) || !text(scope.serviceFamily)) throw new Error('Effective date, service family, and scope narrative are required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(scope.effectiveFrom)) || (text(scope.effectiveTo) && !/^\d{4}-\d{2}-\d{2}$/.test(text(scope.effectiveTo)))) throw new Error('Scope dates must use YYYY-MM-DD.');
  if (text(scope.effectiveTo) && text(scope.effectiveTo) < text(scope.effectiveFrom)) throw new Error('Scope end date cannot precede its start date.');
  if (scope.status !== undefined && !['draft', 'active', 'superseded'].includes(text(scope.status))) throw new Error('Invalid scope status.');
  for (const field of ['eligibleCategories', 'geographies', 'businessUnits', 'callOffRequirements']) if (!Array.isArray(scope[field]) || !strings(scope[field]).every(Boolean)) throw new Error(`${field} must be a list of text values.`);
  const deliverables = Array.isArray(body.deliverables) ? body.deliverables.filter(isRecord) : [];
  if (deliverables.length === 0 || deliverables.some((item) => !text(item.name))) throw new Error('At least one deliverable is required.');
  const exclusions = Array.isArray(body.exclusions) ? body.exclusions.filter(isRecord) : [];
  if (exclusions.some((item) => !text(item.term))) throw new Error('Exclusion terms must be text values.');
  return { contractId: text(body.contractId), scope, deliverables, exclusions };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const sql = getNeonClient();
    const contractId = typeof req.query.id === 'string' ? req.query.id : '';
    if (req.method === 'GET') {
      if (!contractId) { res.status(400).json({ error: 'id is required.', code: 'validation_error' }); return; }
      const versions = await sql.query('SELECT * FROM contract_scope_versions WHERE contract_id = $1 ORDER BY effective_from DESC', [contractId]) as Row[];
      const version = versions[0];
      if (!version) { res.status(200).json({ scope: null, versions: [] }); return; }
      const [deliverables, exclusions] = await Promise.all([
        sql.query('SELECT * FROM contract_scope_deliverables WHERE scope_version_id = $1 ORDER BY id', [version.id]),
        sql.query('SELECT * FROM contract_scope_exclusions WHERE scope_version_id = $1 ORDER BY id', [version.id]),
      ]);
      res.status(200).json({ scope: mapVersion(version), deliverables: (deliverables as Row[]).map(mapDeliverable), exclusions: (exclusions as Row[]).map(mapExclusion), versions: versions.map(mapVersion) });
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
    const input = validate(req.body);
    const versionId = text(input.scope.id) || `SCOPE-${input.contractId}-${Date.now()}`;
    const now = new Date().toISOString();
    const versionValues = [versionId, input.contractId, text(input.scope.effectiveFrom), text(input.scope.effectiveTo) || null, text(input.scope.status) || 'active', text(input.scope.scopeNarrative), text(input.scope.serviceFamily), JSON.stringify(strings(input.scope.eligibleCategories)), JSON.stringify(strings(input.scope.geographies)), JSON.stringify(strings(input.scope.businessUnits)), JSON.stringify(strings(input.scope.callOffRequirements)), 'complete', text(input.scope.provenance) || 'owner-entered', now, now];
    const queries = [
      sql.query(`INSERT INTO contract_scope_versions (id, contract_id, effective_from, effective_to, status, scope_narrative, service_family_id, eligible_categories, geographies, business_units, call_off_requirements, completeness, provenance, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,(SELECT id FROM procurement_service_families WHERE id=$7 OR lower(label)=lower($7) LIMIT 1),$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET effective_from=EXCLUDED.effective_from,effective_to=EXCLUDED.effective_to,status=EXCLUDED.status,scope_narrative=EXCLUDED.scope_narrative,service_family_id=EXCLUDED.service_family_id,eligible_categories=EXCLUDED.eligible_categories,geographies=EXCLUDED.geographies,business_units=EXCLUDED.business_units,call_off_requirements=EXCLUDED.call_off_requirements,completeness=EXCLUDED.completeness,provenance=EXCLUDED.provenance,updated_at=EXCLUDED.updated_at`, versionValues),
      sql.query('DELETE FROM contract_scope_deliverables WHERE scope_version_id = $1', [versionId]),
      sql.query('DELETE FROM contract_scope_exclusions WHERE scope_version_id = $1', [versionId]),
    ];
    for (const [index, item] of input.deliverables.entries()) queries.push(sql.query('INSERT INTO contract_scope_deliverables (id, scope_version_id, name, aliases, description, required) VALUES ($1,$2,$3,$4::jsonb,$5,$6)', [`${versionId}-D${index + 1}`, versionId, text(item.name), JSON.stringify(strings(item.aliases)), text(item.description) || null, item.required !== false]));
    for (const [index, item] of input.exclusions.entries()) queries.push(sql.query('INSERT INTO contract_scope_exclusions (id, scope_version_id, term, reason) VALUES ($1,$2,$3,$4)', [`${versionId}-X${index + 1}`, versionId, text(item.term), text(item.reason) || null]));
    await sql.transaction(queries);
    res.status(200).json({ id: versionId, savedAt: now });
  } catch (error) {
    res.status(400).json({ error: errorText(error), code: 'contract_scope_error' });
  }
}
