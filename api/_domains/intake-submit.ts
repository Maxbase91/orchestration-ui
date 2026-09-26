// Atomic full-intake submission boundary. The browser can draft and preview a
// request, but only this dispatcher-routed handler decides it: it makes the
// intake determination again from stored data, refuses the submit when the
// answer differs from what the requester reviewed (409 determination_changed,
// nothing written), and otherwise records its own determination, compliance
// record and initial stage with the request's related records, together.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient, queryRows } from '../_neon.js';
import { getDbAdmin } from '../_db-admin.js';
import { approvalRows, deriveApprovalsFor, resolveChainId } from '../../src/lib/db/approvals-core.js';
import {
  BUYING_CHANNELS, firstActionableStage, channelStageMapFromTemplates, templateForChannel,
  type ChannelStageMap,
} from '../../src/lib/workflow/channel-stages.js';
import { nodeIdForStatus } from '../../src/lib/workflow/node-config.js';
import { slaDeadlineFor } from '../../src/lib/workflow/business-days.js';
import { submissionGaps, describeGaps } from '../../src/lib/procurement/submission-requirements.js';
import { isPreferredSupplierOverride } from '../../src/lib/procurement/supplier-preference.js';
import { loadPolicyConfigWith } from '../_policy.js';
import { determineOnServer, type SubmittedDemand } from '../_determination.js';
import { recordedDetermination } from '../../src/lib/procurement/intake-determination.js';
import { buildIntakeComplianceRecord } from '../../src/lib/procurement/intake-compliance-record.js';
import { decidedSummary, determinationChanges, reviewedSummary } from '../../src/lib/procurement/determination-changes.js';

type JsonRecord = Record<string, unknown>;
type IntakePayload = {
  request?: JsonRecord;
  serviceDescription?: JsonRecord;
  compliance?: JsonRecord;
  buyingChannel?: string;
  /** The requester's answers to the two risk questions, as the determination read them. */
  riskAnswers?: unknown;
  idempotencyKey?: string;
};

class IntakeError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;
  /** For determination_changed: what differs, one sentence each. */
  readonly changes?: string[];
  constructor(code: string, status: number, message: string, fields?: Record<string, string>, changes?: string[]) {
    super(message); this.code = code; this.status = status; this.fields = fields; this.changes = changes;
  }
}

/** Only the two answers, and only as booleans — an absent key means "not asked". */
function riskAnswersFrom(value: unknown): SubmittedDemand['riskAnswers'] {
  const sent = value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
  return {
    ...(typeof sent.privilegedAccess === 'boolean' ? { privilegedAccess: sent.privilegedAccess } : {}),
    ...(typeof sent.criticalService === 'boolean' ? { criticalService: sent.criticalService } : {}),
  };
}

/**
 * A string exactly as the page sent it. Not trimmed: the browser decided on
 * the text as typed, and a second decision on a tidied copy could disagree
 * with it over a space.
 */
const sentText = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

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

/**
 * The stage a completed intake enters, from the request's own channel.
 *
 * This was the constant `validation` for every channel. That began as an honest
 * fix — the version before it branched on value and threshold and left the
 * writes those branches implied unreachable, so a constant at least said
 * something true. It stopped being true when `validation` became
 * procurement-led-only: a business-led request was written into a
 * stage its own channel skips, and the stepper drew it as skipped while the
 * request sat there.
 *
 * `firstActionableStage` reads the same channel→stages map the stepper does, so
 * the two cannot disagree again, and it is a lookup rather than a decision — no
 * branch here can void a downstream write the way the original did.
 */
function initialStage(
  channelStages: ChannelStageMap,
  buyingChannel: string,
  riskAssessmentRequired: boolean,
) {
  const status = firstActionableStage(channelStages, buyingChannel, { riskAssessmentRequired });
  return { status, stage: status } as const;
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
    const category = requiredString(request.category, 'category');
    // The channel the requester reviewed. The one recorded is the server's own
    // (below); this is checked for shape and compared.
    const reviewedChannel = requiredString(payload.buyingChannel ?? request.buyingChannel, 'buyingChannel').toLowerCase();
    // From the channel map, not a second hand-written list. The copy that used
    // to be here omitted `business-led` while including `sourcing` and
    // `contracting`, which nothing produces — so the one channel the fallback
    // reaches for a mid-value demand was the one channel submit refused.
    if (!BUYING_CHANNELS.includes(reviewedChannel as typeof BUYING_CHANNELS[number])) {
      throw new IntakeError('validation_error', 422, 'Select a valid procurement route.', { buyingChannel: 'Choose a valid route' });
    }
    const value = Number(request.value ?? 0);
    if (!Number.isFinite(value) || value < 0) throw new IntakeError('validation_error', 422, 'Estimated value must be zero or greater.', { value: 'Enter a valid amount' });
    const deliveryDate = optionalIsoDate(request.deliveryDate, 'deliveryDate');
    // The same list the intake conversation asks from, so the requester is
    // asked for these before this refusal can ever be reached.
    const gaps = submissionGaps({
      title: typeof request.title === 'string' ? request.title : null,
      costCentre: typeof request.costCentre === 'string' ? request.costCentre : null,
      deliveryDate,
    });
    if (gaps.length > 0) {
      throw new IntakeError('missing_required_field', 422, `Before submitting, add ${describeGaps(gaps)}.`,
        Object.fromEntries(gaps.map((gap) => [gap.field, `Add ${gap.label}`])));
    }
    const title = (request.title as string).trim();
    const costCentre = (request.costCentre as string).trim();
    const beneficiaryId = requiredString(request.beneficiaryId ?? requestorId, 'beneficiaryId');
    const sow = payload.serviceDescription ? record(payload.serviceDescription) : null;
    const now = new Date().toISOString();
    const sql = getNeonClient();

    // A supplier outside the category's preferred list, recomputed from the
    // store — the browser's view of the list is advisory. The requester has to
    // say why; the reason is stored only when there was an override, so its
    // presence is the record that one was made.
    const supplierId = typeof request.supplierId === 'string' ? request.supplierId : null;
    const pslRows = await queryRows(sql, 'SELECT supplier_id FROM category_preferred_suppliers WHERE category_id = $1', [category]);
    const supplierOverride = isPreferredSupplierOverride(supplierId, pslRows.map((row) => String(row.supplier_id)));
    const overrideReason = typeof request.supplierOverrideReason === 'string' ? request.supplierOverrideReason.trim() : '';
    const overrideGaps = submissionGaps({ title, costCentre, deliveryDate, supplierOverride, supplierOverrideReason: overrideReason });
    if (overrideGaps.length > 0) {
      throw new IntakeError('missing_required_field', 422, `Before submitting, add ${describeGaps(overrideGaps)}.`,
        Object.fromEntries(overrideGaps.map((gap) => [gap.field, `Add ${gap.label}`])));
    }
    const policy = await loadPolicyConfigWith(sql);

    // The stage's SLA, from the template node the request is about to enter.
    //
    // `sla_deadline` was set only by transitionStage(), so a request got one on
    // its first stage *change* and never at creation — 130 of 136 requests in
    // the live store had none, which meant no countdown, and nothing that could
    // ever be overdue. The template owns stage SLAs, so the deadline is read
    // from the same node the workflow instance starts on.
    // Every template, not just the chosen one: the channel's stage path is
    // derived from whichever template claims that channel, which is not
    // necessarily the template this request runs on. Four rows instead of one.
    const templateRows = await queryRows(
      sql, 'SELECT id, channels, nodes, edges FROM workflow_templates', [],
    );
    const templates = templateRows as unknown as Parameters<typeof channelStageMapFromTemplates>[0];
    const channelStages = channelStageMapFromTemplates(templates);

    // The client keeps one request id for a submission attempt. Reusing that
    // id makes retries safe without adding a second idempotency column to the
    // established request table.
    const existing = await sql.query(
      'SELECT id, status, buying_channel, value, approval_chain, risk_assessment_required, workflow_template_id, requestor_id, owner_id FROM requests WHERE id = $1 LIMIT 1',
      [id],
    ) as Array<JsonRecord>;
    if (existing[0]) {
      // Older clients could persist the request row before stage history and
      // workflow creation. Repair only that unambiguous orphan on a safe retry;
      // never overwrite a request that already has lifecycle evidence.
      const lifecycle = await sql.query(
        `SELECT
           (SELECT COUNT(*)::int FROM stage_history WHERE request_id = $1) AS history_count,
           (SELECT COUNT(*)::int FROM workflow_instances WHERE request_id = $1) AS workflow_count`,
        [id],
      ) as Array<JsonRecord>;
      const historyCount = Number(lifecycle[0]?.history_count ?? 0);
      const workflowCount = Number(lifecycle[0]?.workflow_count ?? 0);
      if (String(existing[0].status) === 'intake' && historyCount === 0 && workflowCount === 0) {
        // From the stored row, not this payload: the request was decided when it
        // was written, and a retry carries no authority to decide it again.
        const storedChannel = String(existing[0].buying_channel ?? reviewedChannel);
        const repairedStage = initialStage(channelStages, storedChannel, existing[0].risk_assessment_required === true);
        const repairNow = new Date().toISOString();
        const repairTemplateId = (existing[0].workflow_template_id as string | null) ?? (templateForChannel(templates, storedChannel) || null);
        const repairQueries = [
          sql.query('UPDATE requests SET status = $1, updated_at = $2 WHERE id = $3', [repairedStage.status, repairNow, id]),
          sql.query('INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action, notes) VALUES ($1, $2, $3, $4, $5, $6)', [id, repairedStage.stage, repairNow, existing[0].owner_id ?? existing[0].requestor_id, 'repaired', 'Initial lifecycle evidence restored for a previously incomplete submission.']),
        ];
        // `workflow_instances.template_id` is NOT NULL, so an unclaimed channel
        // gets stage history and no instance rather than a failed repair. Same
        // rule as the fresh-submission path below: no instance beats one that
        // points nowhere.
        if (repairTemplateId) {
          repairQueries.push(sql.query('INSERT INTO workflow_instances (id, request_id, template_id, current_node_ids, status, variables, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [`WI-${id}`, id, repairTemplateId, json([repairedStage.stage]), 'running', json({ repaired: true }), repairNow, repairNow]));
        }
        await sql.transaction(repairQueries);
        res.status(200).json({ requestId: id, status: repairedStage.status, stage: repairedStage.stage, repaired: true });
        return;
      }
      // `stage` is part of the contract src/lib/procurement/submit-intake.ts
      // validates: without it a legitimate retry threw 'invalid_response', the
      // wizard showed an error toast and never advanced to confirmation — for a
      // submission that had in fact succeeded. The request's current status IS
      // its stage here; the repair branch above already returns both.
      res.status(200).json({
        requestId: String(existing[0].id),
        status: String(existing[0].status),
        stage: String(existing[0].status),
        replay: true,
      });
      return;
    }

    // Decide the demand again, from stored data, with the thresholds in force.
    // The browser's determination is what the requester reviewed, so it is
    // compared, never stored: a stale Channel page, or a payload edited on the
    // way, must not become the record. A difference refuses the submit before
    // anything is written, and says what changed.
    const today = now.slice(0, 10);
    const { determination, approvalChains } = await determineOnServer(getDbAdmin(), {
      category,
      estimatedValue: value,
      supplierId: supplierId ?? '',
      contractId: sentText(request.contractId) || undefined,
      commodityCode: sentText(request.commodityCode),
      isUrgent: request.isUrgent === true,
      requestTitle: title,
      serviceDescription: sow ? {
        objective: sentText(sow.objective), scope: sentText(sow.scope), deliverables: sentText(sow.deliverables),
        resources: sentText(sow.resources), narrative: sentText(sow.narrative),
      } : null,
      riskAnswers: riskAnswersFrom(payload.riskAnswers),
      preferredSupplierIds: pslRows.map((row) => String(row.supplier_id)),
    }, policy, today);
    const serverCompliance = buildIntakeComplianceRecord(determination, { determinedAt: now });
    const chainName = (chainId: string | null) =>
      (chainId ? approvalChains.find((chain) => chain.id === chainId)?.name ?? chainId : 'none');
    const changes = determinationChanges(
      reviewedSummary({ ...request, buyingChannel: reviewedChannel }, payload.compliance),
      decidedSummary(determination, serverCompliance),
      chainName,
    );
    if (changes.length > 0) {
      throw new IntakeError('determination_changed', 409,
        'This request was decided again when you submitted it, and the answer has changed. Review the Channel page and submit again.',
        undefined, changes);
    }

    // The server's own values from here on — equal to the reviewed ones, or the
    // submit would have been refused above.
    const recorded = recordedDetermination(determination);
    const buyingChannel = recorded.buyingChannel;
    // The template that claims the request's channel — never the browser's.
    // The browser sent a template derived from the CATEGORY, which is the
    // standard procurement template for nearly every category, and it won: a
    // business-led request would have run the procurement-led lifecycle,
    // sourcing and all. Server-authoritative, like the channel itself. Null only
    // when no template claims the channel, which `unclaimedChannels` reports;
    // the column is nullable and a wrong id is worse than none.
    const templateId = templateForChannel(templates, buyingChannel) || null;
    const templateNodes = Array.isArray(templateRows.find((r) => r.id === templateId)?.nodes)
      ? (templateRows.find((r) => r.id === templateId)!.nodes) as Array<{ id: string; type?: string; label?: string; slaDays?: number }>
      : [];
    const stage = initialStage(channelStages, buyingChannel, recorded.riskAssessmentRequired);
    const startNodeId = nodeIdForStatus(templateNodes, stage.status);

    const requestRow = cleanRow({
      id, title, description: request.description ?? sow?.narrative ?? title, category, status: stage.status,
      priority: request.priority ?? 'medium', value, currency: request.currency ?? 'EUR', requestor_id: requestorId,
      owner_id: request.ownerId ?? requestorId, supplier_id: request.supplierId ?? null, supplier_name: request.supplierName ?? null,
      supplier_override_reason: supplierOverride ? overrideReason : null,
      contract_id: request.contractId ?? null, buying_channel: buyingChannel,
      // The server's determination, not the browser's copy of it.
      sourcing_type: recorded.sourcingType, sourcing_type_reason: recorded.sourcingTypeReason,
      approval_chain: recorded.approvalChain ?? null, inherent_risk_tier: recorded.inherentRiskTier,
      materiality_tier: recorded.materialityTier, risk_assessment_required: recorded.riskAssessmentRequired,
      screening_outcome: recorded.screeningOutcome, referral_disposition: recorded.referralDisposition,
      commodity_code: request.commodityCode ?? null, commodity_code_label: request.commodityCodeLabel ?? null,
      commodity_candidates: json(request.commodityCandidates ?? []), commodity_classification_confirmed: request.commodityClassificationConfirmed ?? false,
      attachments: json(request.attachments ?? []), cost_centre: costCentre, budget_owner: request.budgetOwner ?? null,
      business_justification: null, delivery_date: deliveryDate, is_urgent: request.isUrgent ?? false, days_in_stage: 0,
      is_overdue: false, refer_back_count: 0, workflow_template_id: templateId, requester_country: request.requesterCountry ?? null,
      sla_deadline: slaDeadlineFor(new Date(now), templateNodes.find((n) => n.id === startNodeId)?.slaDays),
      requester_country_code: request.requesterCountryCode ?? null, beneficiary_id: beneficiaryId,
      beneficiary_name: request.beneficiaryName ?? null, beneficiary_country: request.beneficiaryCountry ?? null,
      beneficiary_country_code: request.beneficiaryCountryCode ?? null, created_at: now, updated_at: now,
    });
    // Neon deployments can be one additive migration behind while a release
    // is rolling out. Restrict the insert to the known request columns that
    // exist in the target schema so a missing optional compatibility column
    // (for example commodity_candidates) cannot abort an otherwise valid
    // intake submission. Required core columns are still validated above.
    const columnRows = await sql.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'requests'`,
    ) as Array<{ column_name?: string }>;
    const availableColumns = new Set(columnRows.map((row) => row.column_name).filter((value): value is string => Boolean(value)));
    const persistedRequestRow = Object.fromEntries(
      Object.entries(requestRow).filter(([column]) => availableColumns.has(column)),
    );
    const queries = [
      sql.query(`INSERT INTO requests (${Object.keys(persistedRequestRow).join(', ')}) VALUES (${Object.keys(persistedRequestRow).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(persistedRequestRow)),
    ];
    if (sow) {
      const sowRow = cleanRow({ request_id: id, objective: sow.objective ?? '', scope: sow.scope ?? '', exclusions: sow.exclusions ?? '', deliverables: sow.deliverables ?? '', timeline: sow.timeline ?? '', resources: sow.resources ?? '', acceptance_criteria: sow.acceptanceCriteria ?? '', pricing_model: sow.pricingModel ?? '', location: sow.location ?? '', dependencies: sow.dependencies ?? '', narrative: sow.narrative ?? '', quality_score: sow.qualityScore ?? null, quality_checks: json(sow.qualityChecks ?? []), signals: json(sow.signals ?? []), required_sections: Array.isArray(sow.requiredSections) ? sow.requiredSections : [], capture_flags: json(sow.captureFlags ?? {}), created_at: now });
      queries.push(sql.query(`INSERT INTO service_descriptions (${Object.keys(sowRow).join(', ')}) VALUES (${Object.keys(sowRow).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(sowRow)));
    }
    // The compliance record is built from the server's determination — the
    // evidence of what was checked is what the server checked.
    const complianceRow = cleanRow({ request_id: id, determined_at: serverCompliance.determinedAt, buying_channel: json(serverCompliance.buyingChannel), sra_check: json(serverCompliance.sraCheck), policy_checks: json(serverCompliance.policyChecks), risk_flags: serverCompliance.riskFlags, matching_risk_assessment_ids: serverCompliance.matchingRiskAssessmentIds ?? [] });
    queries.push(sql.query(`INSERT INTO intake_compliance_records (${Object.keys(complianceRow).join(', ')}) VALUES (${Object.keys(complianceRow).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(complianceRow)));
    // Every intake enters validation, and validation is an approval gate: the
    // category's manager confirms the demand is permissible and correctly
    // classified before anything downstream runs. Derived from the records, so
    // the person named is one the directory actually holds responsible.
    const approvals = await deriveApprovalsFor(
      getDbAdmin(),
      {
        requestId: id, category, costCentre, contractId: (request.contractId as string) ?? null,
        supplierOverride: supplierOverride && policy.preferredSupplierOverrideNeedsApproval,
      },
      await resolveChainId(getDbAdmin(), recorded.approvalChain ?? null, value),
    );
    for (const row of approvalRows(id, approvals, now)) {
      const columns = Object.keys(row);
      queries.push(sql.query(
        `INSERT INTO approval_entries (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
        Object.values(row),
      ));
    }

    const stageRow = { request_id: id, stage: stage.stage, entered_at: now, owner_id: request.ownerId ?? requestorId, action: 'submitted', notes: 'Initial actionable stage selected by the server.' };
    queries.push(sql.query('INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action, notes) VALUES ($1, $2, $3, $4, $5, $6)', Object.values(stageRow)));
    // The node the instance starts on, read from the template that was actually
    // chosen. This was the literal 'n3' regardless of template: Validation in
    // WF-001, but a *decision* node in WF-002, so a request routed to WF-002 was
    // parked somewhere the engine cannot resume from — and the Workflow Designer
    // could be reshaped without any of it reaching the server.
    //
    // A template with no node for this stage writes no instance rather than one
    // pointing at a node that does not exist: the engine's fallback can open a
    // correct instance later, and a wrong pointer is harder to detect than a
    // missing one.
    if (!startNodeId) {
      console.warn(`[intake-submit] ${templateId} has no '${stage.status}' node; no workflow instance written for ${id}.`);
    }
    const workflowRow = { id: `WI-${id}`, request_id: id, template_id: templateId, current_node_ids: json([startNodeId]), status: 'running', variables: json({ submittedBy: requestorId }), created_at: now, updated_at: now };
    if (startNodeId) {
      queries.push(sql.query(`INSERT INTO workflow_instances (${Object.keys(workflowRow).join(', ')}) VALUES (${Object.keys(workflowRow).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(workflowRow)));
    }
    await sql.transaction(queries);
    res.status(201).json({ requestId: id, status: stage.status, stage: stage.stage });
    return;
  } catch (error) {
    if (error instanceof IntakeError) { res.status(error.status).json({ error: error.message, code: error.code, ...(error.fields ? { fields: error.fields } : {}), ...(error.changes ? { changes: error.changes } : {}) }); return; }
    const message = error instanceof Error ? error.message : 'Intake submission failed.';
    if (/duplicate key|unique constraint/i.test(message)) { res.status(409).json({ error: 'This request has already been submitted.', code: 'duplicate_request' }); return; }
    console.error('[intake-submit]', message);
    res.status(500).json({ error: 'Could not submit request. Please try again.', code: 'intake_submit_failed' });
  }
}
