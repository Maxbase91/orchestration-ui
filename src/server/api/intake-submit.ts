// Atomic full-intake submission boundary. The browser can draft and preview a
// request, but only this dispatcher-routed handler decides the initial stage
// and commits the request's related records together.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from '../../../api/_neon.js';

type JsonRecord = Record<string, unknown>;
type IntakePayload = {
  request?: JsonRecord;
  serviceDescription?: JsonRecord;
  compliance?: JsonRecord;
  workflowTemplateId?: string;
  buyingChannel?: string;
  idempotencyKey?: string;
};

class IntakeError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;
  constructor(code: string, status: number, message: string, fields?: Record<string, string>) { super(message); this.code = code; this.status = status; this.fields = fields; }
}

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IntakeError('validation_error', 400, 'Request data is required.');
  return value as JsonRecord;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new IntakeError('validation_error', 400, `${field} is required.`, { [field]: 'Required' });
  return value.trim();
}

function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new IntakeError('invalid_date', 422, `${field} must be a valid date in YYYY-MM-DD format.`, { [field]: 'Use a specific date' });
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new IntakeError('invalid_date', 422, `${field} must be a real calendar date.`, { [field]: 'Use a real calendar date' });
  return value;
}

function json(value: unknown): string { return JSON.stringify(value ?? null); }

function stageFor(request: JsonRecord, approvalThreshold: number): { status: string; stage: string } {
  const value = Number(request.value ?? 0);
  const channel = String(request.buyingChannel ?? '').toLowerCase();
  if (request.riskAssessmentRequired === true) return { status: 'risk', stage: 'risk' };
  if (channel.includes('sourcing') || channel.includes('procurement-led')) return { status: 'sourcing', stage: 'sourcing' };
  if (request.approvalChain || value >= approvalThreshold) return { status: 'approval', stage: 'approval' };
  return { status: 'validation', stage: 'validation' };
}

function cleanRow(row: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
  try {
    const payload = record(req.body) as IntakePayload;
    const request = record(payload.request);
    const id = requiredString(request.id, 'requestId');
    const requestorId = requiredString(request.requestorId, 'requestorId');
    const title = requiredString(request.title, 'title');
    const category = requiredString(request.category, 'category');
    const buyingChannel = requiredString(payload.buyingChannel ?? request.buyingChannel, 'buyingChannel').toLowerCase();
    const allowedChannels = new Set(['catalogue', 'framework-call-off', 'p-card', 'direct-po', 'procurement-led', 'sourcing', 'contracting']);
    if (!allowedChannels.has(buyingChannel)) throw new IntakeError('validation_error', 422, 'Select a valid procurement route.', { buyingChannel: 'Choose a valid route' });
    const value = Number(request.value ?? 0);
    if (!Number.isFinite(value) || value < 0) throw new IntakeError('validation_error', 422, 'Estimated value must be zero or greater.', { value: 'Enter a valid amount' });
    const deliveryDate = optionalIsoDate(request.deliveryDate, 'deliveryDate');
    if (!deliveryDate) throw new IntakeError('missing_required_field', 422, 'A specific need-by date is required before submission.', { deliveryDate: 'Enter a date such as 2026-12-31' });
    const costCentre = requiredString(request.costCentre, 'costCentre');
    const beneficiaryId = requiredString(request.beneficiaryId ?? requestorId, 'beneficiaryId');
    const sow = payload.serviceDescription ? record(payload.serviceDescription) : null;
    const compliance = payload.compliance ? record(payload.compliance) : null;
    const now = new Date().toISOString();
    const templateId = payload.workflowTemplateId || String(request.workflowTemplateId || 'WF-001');
    const sql = getNeonClient();
    let approvalThreshold = 10_000;
    try {
      const policyRows = await sql.query('SELECT config FROM procurement_policy_configs WHERE singleton_key = $1', ['default']) as Array<JsonRecord>;
      const configured = Number((policyRows[0]?.config as JsonRecord | undefined)?.approvalFullThreshold);
      if (Number.isFinite(configured) && configured > 0) approvalThreshold = configured;
    } catch (error) {
      // The additive policy table may not exist on an older branch; shipped
      // defaults keep intake available while the migration is applied.
      if (!/procurement_policy_configs|does not exist|relation/i.test(error instanceof Error ? error.message : '')) throw error;
    }
    const stage = stageFor({ ...request, value, buyingChannel }, approvalThreshold);

    // The client keeps one request id for a submission attempt. Reusing that
    // id makes retries safe without adding a second idempotency column to the
    // established request table.
    const existing = await sql.query('SELECT id, status FROM requests WHERE id = $1 LIMIT 1', [id]) as Array<JsonRecord>;
    if (existing[0]) { res.status(200).json({ requestId: String(existing[0].id), status: String(existing[0].status), replay: true }); return; }

    const requestRow = cleanRow({
      id, title, description: request.description ?? sow?.narrative ?? title, category, status: stage.status,
      priority: request.priority ?? 'medium', value, currency: request.currency ?? 'EUR', requestor_id: requestorId,
      owner_id: request.ownerId ?? requestorId, supplier_id: request.supplierId ?? null, supplier_name: request.supplierName ?? null,
      contract_id: request.contractId ?? null, buying_channel: buyingChannel,
      sourcing_type: request.sourcingType ?? null, sourcing_type_reason: request.sourcingTypeReason ?? null,
      approval_chain: request.approvalChain ?? null, inherent_risk_tier: request.inherentRiskTier ?? null,
      materiality_tier: request.materialityTier ?? null, risk_assessment_required: request.riskAssessmentRequired ?? false,
      screening_outcome: request.screeningOutcome ?? null, referral_disposition: request.referralDisposition ?? null,
      commodity_code: request.commodityCode ?? null, commodity_code_label: request.commodityCodeLabel ?? null,
      commodity_candidates: json(request.commodityCandidates ?? []), commodity_classification_confirmed: request.commodityClassificationConfirmed ?? false,
      attachments: json(request.attachments ?? []), cost_centre: costCentre, budget_owner: request.budgetOwner ?? null,
      business_justification: null, delivery_date: deliveryDate, is_urgent: request.isUrgent ?? false, days_in_stage: 0,
      is_overdue: false, refer_back_count: 0, workflow_template_id: templateId, requester_country: request.requesterCountry ?? null,
      requester_country_code: request.requesterCountryCode ?? null, beneficiary_id: beneficiaryId,
      beneficiary_name: request.beneficiaryName ?? null, beneficiary_country: request.beneficiaryCountry ?? null,
      beneficiary_country_code: request.beneficiaryCountryCode ?? null, created_at: now, updated_at: now,
    });
    const queries = [
      sql.query(`INSERT INTO requests (${Object.keys(requestRow).join(', ')}) VALUES (${Object.keys(requestRow).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(requestRow)),
    ];
    if (sow) {
      const sowRow = cleanRow({ request_id: id, objective: sow.objective ?? '', scope: sow.scope ?? '', exclusions: sow.exclusions ?? '', deliverables: sow.deliverables ?? '', timeline: sow.timeline ?? '', resources: sow.resources ?? '', acceptance_criteria: sow.acceptanceCriteria ?? '', pricing_model: sow.pricingModel ?? '', location: sow.location ?? '', dependencies: sow.dependencies ?? '', narrative: sow.narrative ?? '', quality_score: sow.qualityScore ?? null, quality_checks: json(sow.qualityChecks ?? []), signals: json(sow.signals ?? []), required_sections: Array.isArray(sow.requiredSections) ? sow.requiredSections : [], capture_flags: json(sow.captureFlags ?? {}), created_at: now });
      queries.push(sql.query(`INSERT INTO service_descriptions (${Object.keys(sowRow).join(', ')}) VALUES (${Object.keys(sowRow).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(sowRow)));
    }
    if (compliance) {
      const complianceRow = cleanRow({ request_id: id, determined_at: compliance.determinedAt ?? now, buying_channel: json(compliance.buyingChannel ?? {}), sra_check: json(compliance.sraCheck ?? {}), policy_checks: json(compliance.policyChecks ?? []), duplicate_check: json(compliance.duplicateCheck ?? {}), risk_flags: Array.isArray(compliance.riskFlags) ? compliance.riskFlags : [], matching_risk_assessment_ids: Array.isArray(compliance.matchingRiskAssessmentIds) ? compliance.matchingRiskAssessmentIds : [] });
      queries.push(sql.query(`INSERT INTO intake_compliance_records (${Object.keys(complianceRow).join(', ')}) VALUES (${Object.keys(complianceRow).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(complianceRow)));
    }
    const stageRow = { request_id: id, stage: stage.stage, entered_at: now, owner_id: request.ownerId ?? requestorId, action: 'submitted', notes: 'Initial actionable stage selected by the server.' };
    queries.push(sql.query('INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action, notes) VALUES ($1, $2, $3, $4, $5, $6)', Object.values(stageRow)));
    const workflowRow = { id: `WI-${id}`, request_id: id, template_id: templateId, current_node_ids: json([stage.stage === 'risk' ? 'n14' : stage.stage === 'approval' ? 'n5' : stage.stage === 'sourcing' ? 'n6' : 'n3']), status: 'running', variables: json({ submittedBy: requestorId }), created_at: now, updated_at: now };
    queries.push(sql.query(`INSERT INTO workflow_instances (${Object.keys(workflowRow).join(', ')}) VALUES (${Object.keys(workflowRow).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(workflowRow)));
    if (stage.stage === 'approval') {
      // Keep the approval queue populated in the same transaction as the
      // request. The persona is simulation-only until authentication lands.
      queries.push(sql.query(
        'INSERT INTO approval_entries (id, request_id, approver_id, approver_name, approver_role, status, requested_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [`APR-${id}-0`, id, 'u1', 'Anna Müller', 'Procurement Manager', 'pending', now],
      ));
    }
    await sql.transaction(queries);
    res.status(201).json({ requestId: id, status: stage.status, stage: stage.stage });
    return;
  } catch (error) {
    if (error instanceof IntakeError) { res.status(error.status).json({ error: error.message, code: error.code, ...(error.fields ? { fields: error.fields } : {}) }); return; }
    const message = error instanceof Error ? error.message : 'Intake submission failed.';
    if (/duplicate key|unique constraint/i.test(message)) { res.status(409).json({ error: 'This request has already been submitted.', code: 'duplicate_request' }); return; }
    console.error('[intake-submit]', message);
    res.status(500).json({ error: 'Could not submit request. Please try again.', code: 'intake_submit_failed' });
  }
}
