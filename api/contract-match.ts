// Server-authoritative contract matching. It loads effective-dated scope from
// Neon, applies deterministic eligibility/scoring, and optionally reranks only
// eligible candidates with the existing Groq → Gemini provider chain.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from './_neon.js';
import { callLLM } from '../src/lib/llm.js';
import { matchContractScopes, type ContractMatchInput, type ContractMatchScope } from '../src/lib/procurement/contract-matching.js';
import type { ContractMatchCandidate, ContractScopeDeliverable, ContractScopeExclusion } from '../src/data/types.js';

type Row = Record<string, unknown>;

function isRecord(value: unknown): value is Row { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function arrayValue(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function dateText(value: unknown): string { return value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Contract matching failed.'; }

function validateInput(body: unknown): ContractMatchInput {
  if (!isRecord(body)) throw new Error('A contract match request is required.');
  const value = (key: string) => body[key];
  if (typeof value('text') !== 'string' || !value('text').trim()) throw new Error('text is required.');
  if (value('text').length > 5000) throw new Error('text is too long.');
  const optionalText = ['category', 'supplierId', 'needByDate', 'serviceStartDate', 'serviceEndDate', 'geography', 'businessUnit'];
  for (const key of optionalText) if (value(key) !== undefined && typeof value(key) !== 'string') throw new Error(`${key} must be a string.`);
  for (const key of ['needByDate', 'serviceStartDate', 'serviceEndDate']) if (typeof value(key) === 'string' && value(key) && !/^\d{4}-\d{2}-\d{2}$/.test(value(key))) throw new Error(`${key} must use YYYY-MM-DD.`);
  if (value('estimatedValue') !== undefined && (typeof value('estimatedValue') !== 'number' || !Number.isFinite(value('estimatedValue')) || value('estimatedValue') < 0)) throw new Error('estimatedValue must be a non-negative number.');
  const clarificationAnswers = value('clarificationAnswers');
  if (clarificationAnswers !== undefined && (!isRecord(clarificationAnswers) || Object.keys(clarificationAnswers).length > 3 || Object.values(clarificationAnswers).some((item) => typeof item !== 'string' || item.length > 1000))) throw new Error('clarificationAnswers must contain at most three short text values.');
  return {
    text: value('text'), category: text(value('category')) || undefined, supplierId: text(value('supplierId')) || undefined,
    estimatedValue: typeof value('estimatedValue') === 'number' ? value('estimatedValue') : undefined,
    needByDate: text(value('needByDate')) || undefined, serviceStartDate: text(value('serviceStartDate')) || undefined,
    serviceEndDate: text(value('serviceEndDate')) || undefined, geography: text(value('geography')) || undefined,
    businessUnit: text(value('businessUnit')) || undefined, clarificationAnswers: clarificationAnswers as Record<string, string> | undefined,
  };
}

export async function loadContractMatchScopes(sql: ReturnType<typeof getNeonClient>): Promise<ContractMatchScope[]> {
  const rows = await sql.query(`
    SELECT sv.*, c.title AS contract_title, c.supplier_id, c.supplier_name, c.value AS contract_value,
           c.utilisation_percentage, c.status AS contract_status, sf.label AS service_family
    FROM contract_scope_versions sv
    JOIN contracts c ON c.id = sv.contract_id
    LEFT JOIN procurement_service_families sf ON sf.id = sv.service_family_id
    WHERE sv.status = 'active'
  `) as Row[];
  const ids = rows.map((row) => String(row.id));
  const [deliverableRows, exclusionRows] = ids.length === 0
    ? [[], []] as Row[][]
    : await Promise.all([
      sql.query('SELECT * FROM contract_scope_deliverables WHERE scope_version_id = ANY($1::text[]) ORDER BY id', [ids]) as Promise<Row[]>,
      sql.query('SELECT * FROM contract_scope_exclusions WHERE scope_version_id = ANY($1::text[]) ORDER BY id', [ids]) as Promise<Row[]>,
    ]);
  const deliverables = new Map<string, ContractScopeDeliverable[]>();
  for (const row of deliverableRows) {
    const item: ContractScopeDeliverable = {
      id: String(row.id), scopeVersionId: String(row.scope_version_id), name: text(row.name),
      aliases: arrayValue(row.aliases), description: text(row.description) || undefined, required: row.required !== false,
    };
    deliverables.set(item.scopeVersionId, [...(deliverables.get(item.scopeVersionId) ?? []), item]);
  }
  const exclusions = new Map<string, ContractScopeExclusion[]>();
  for (const row of exclusionRows) {
    const item: ContractScopeExclusion = { id: String(row.id), scopeVersionId: String(row.scope_version_id), term: text(row.term), reason: text(row.reason) || undefined };
    exclusions.set(item.scopeVersionId, [...(exclusions.get(item.scopeVersionId) ?? []), item]);
  }
  return rows.map((row) => ({
    id: String(row.id), contractId: String(row.contract_id), effectiveFrom: dateText(row.effective_from), effectiveTo: dateText(row.effective_to) || undefined,
    status: row.status as ContractMatchScope['status'], scopeNarrative: text(row.scope_narrative), serviceFamily: text(row.service_family) || undefined,
    eligibleCategories: arrayValue(row.eligible_categories), geographies: arrayValue(row.geographies), businessUnits: arrayValue(row.business_units),
    callOffRequirements: arrayValue(row.call_off_requirements), completeness: row.completeness as ContractMatchScope['completeness'], provenance: row.provenance as ContractMatchScope['provenance'],
    contractTitle: text(row.contract_title), supplierId: text(row.supplier_id), supplierName: text(row.supplier_name), contractValue: Number(row.contract_value ?? 0),
    utilisationPercentage: Number(row.utilisation_percentage ?? 0), contractStatus: text(row.contract_status), deliverables: deliverables.get(String(row.id)) ?? [], exclusions: exclusions.get(String(row.id)) ?? [],
  }));
}

async function rerank(input: ContractMatchInput, candidates: ContractMatchCandidate[]): Promise<ContractMatchCandidate[]> {
  if (candidates.length < 2 || (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY)) return candidates;
  try {
    const content = await callLLM({
      messages: [
        { role: 'system', content: 'You rerank eligible procurement contract candidates. Return JSON only: {"order":["contract-id"],"reasons":{"contract-id":"brief reason"}}. Never add candidates or choose an ineligible candidate.' },
        { role: 'user', content: JSON.stringify({ demand: input, candidates: candidates.map((candidate) => ({ id: candidate.contractId, score: candidate.score, reasons: candidate.reasons })) }) },
      ], temperature: 0, maxTokens: 700,
    });
    const parsed = JSON.parse(content) as { order?: unknown; reasons?: unknown };
    if (!Array.isArray(parsed.order)) return candidates;
    const byId = new Map(candidates.map((candidate) => [candidate.contractId, candidate]));
    const reordered = (parsed.order.filter((id): id is string => typeof id === 'string').map((id) => byId.get(id)).filter((candidate): candidate is ContractMatchCandidate => Boolean(candidate)));
    for (const candidate of candidates) if (!reordered.includes(candidate)) reordered.push(candidate);
    return reordered.map((candidate) => {
      const reason = isRecord(parsed.reasons) ? text(parsed.reasons[candidate.contractId]) : '';
      return reason ? { ...candidate, reasons: [...candidate.reasons, `AI reranking: ${reason}`] } : candidate;
    });
  } catch {
    // Provider outages must not hide deterministic candidates or block intake.
    return candidates;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
  try {
    const input = validateInput(req.body);
    const sql = getNeonClient();
    let scopes: ContractMatchScope[];
    try { scopes = await loadContractMatchScopes(sql); } catch (error) {
      if (/contract_scope_versions|does not exist|relation/i.test(errorMessage(error))) { res.status(200).json({ sufficient: true, route: 'full-request', missingFields: ['contract coverage data'], questions: [], candidates: [] }); return; }
      throw error;
    }
    const result = matchContractScopes(input, scopes);
    result.candidates = await rerank(input, result.candidates);
    if (result.route === 'contract' && result.candidates[0]?.confidence === 'low') result.route = 'clarify';
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error), code: 'validation_error' });
  }
}
