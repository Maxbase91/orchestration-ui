// Atomic internal checkout boundary. All authoritative governance reads and
// request → PR → line → conditional PO writes happen behind this endpoint.
import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient } from './_neon.js';
import {
  evaluateGovernedCheckout,
  type GovernedCheckoutInput,
  type GovernedCheckoutLine,
  type GovernedCheckoutDecision,
} from '../src/lib/procurement/governed-checkout.js';
import { DEFAULT_POLICY_CONFIG, type PolicyConfig } from '../src/lib/procurement/policy-config.js';
import {
  mapDbToCatalogueItem,
  mapDbToContract,
  mapDbToProcurementProfile,
  mapDbToPurchaseOrder,
  mapDbToPurchaseRequisition,
  mapDbToRequest,
  mapDbToRequestLine,
  mapDbToRiskAssessment,
  mapDbToSupplier,
} from '../src/lib/db/mappers.js';
import type { ProcurementProfile, PurchaseOrder, PurchaseRequisition, ProcurementRequest, RequestLine, RiskAssessment } from '../src/data/types.js';
import { loadContractMatchScopes } from './contract-match.js';
import { matchContractScopes } from '../src/lib/procurement/contract-matching.js';

type DbRow = Record<string, unknown>;
type CheckoutPayload = {
  request?: Partial<ProcurementRequest>;
  requestId?: unknown;
  requisitionId?: unknown;
  poId?: unknown;
  checkout?: GovernedCheckoutInput;
  lines?: RequestLine[];
  decision?: GovernedCheckoutDecision;
};

interface Aggregate {
  requestId: string;
  request: ProcurementRequest;
  requisition: PurchaseRequisition;
  lines: RequestLine[];
  purchaseOrder?: PurchaseOrder;
}

function isRecord(value: unknown): value is DbRow { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Governed checkout failed.'; }

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (isRecord(value)) return Object.keys(value).sort().reduce<Record<string, unknown>>((out, key) => { out[key] = stable(value[key]); return out; }, {});
  return value;
}

function fingerprint(payload: CheckoutPayload): string {
  const checkout = payload.checkout;
  const normalized = {
    requestId: payload.requestId,
    requisitionId: payload.requisitionId,
    request: payload.request,
    route: checkout?.route,
    lines: payload.lines,
    intent: checkout ? {
      currency: checkout.currency, needByDate: checkout.needByDate,
      serviceStartDate: checkout.serviceStartDate, serviceEndDate: checkout.serviceEndDate,
      purpose: checkout.purpose, costCentre: checkout.costCentre, budgetOwner: checkout.budgetOwner,
      accountType: checkout.accountType, shipToLocationId: checkout.shipToLocationId,
      beneficiaryId: checkout.beneficiaryId, idempotencyKey: checkout.idempotencyKey,
      supplierId: checkout.supplier?.id, contractId: checkout.contract?.id,
      riskAssessmentId: checkout.riskAssessment?.id,
      contractMatch: checkout.contractMatch,
    } : null,
  };
  return createHash('sha256').update(JSON.stringify(stable(normalized))).digest('hex');
}

function configFromRow(row: DbRow | undefined): PolicyConfig {
  const value = row?.config;
  if (!isRecord(value)) return DEFAULT_POLICY_CONFIG;
  const candidate = value as Partial<PolicyConfig>;
  const keys = Object.keys(DEFAULT_POLICY_CONFIG) as (keyof PolicyConfig)[];
  if (keys.some((key) => candidate[key] === undefined)) return DEFAULT_POLICY_CONFIG;
  return { ...DEFAULT_POLICY_CONFIG, ...candidate } as PolicyConfig;
}

async function loadPolicy(sql: ReturnType<typeof getNeonClient>): Promise<PolicyConfig> {
  try {
    const rows = await sql.query('SELECT config FROM procurement_policy_configs WHERE singleton_key = $1', ['default']);
    return configFromRow(rows[0] as DbRow | undefined);
  } catch (error) {
    // The policy table is additive. A deployment that has not run the migration
    // still uses shipped defaults rather than making checkout unusable.
    if (/procurement_policy_configs|does not exist|relation/i.test(errorMessage(error))) return DEFAULT_POLICY_CONFIG;
    throw error;
  }
}

async function aggregate(sql: ReturnType<typeof getNeonClient>, requisitionRow: DbRow): Promise<Aggregate> {
  const requestId = String(requisitionRow.request_id);
  const [requestRows, lineRows, poRows] = await Promise.all([
    sql.query('SELECT * FROM requests WHERE id = $1', [requestId]),
    sql.query('SELECT * FROM request_lines WHERE requisition_id = $1 ORDER BY id', [String(requisitionRow.id)]),
    sql.query('SELECT * FROM purchase_orders WHERE requisition_id = $1 ORDER BY created_at DESC', [String(requisitionRow.id)]),
  ]);
  const request = requestRows[0] as DbRow | undefined;
  const lines = (lineRows as DbRow[]).map(mapDbToRequestLine);
  if (!request || lines.length === 0 || (requisitionRow.status === 'po-created' && poRows.length === 0)) {
    throw new CheckoutError('Existing checkout aggregate is incomplete and requires recovery.', 'incomplete_checkout', 409);
  }
  return {
    requestId,
    request: mapDbToRequest(request),
    requisition: mapDbToPurchaseRequisition(requisitionRow),
    lines,
    ...(poRows[0] ? { purchaseOrder: mapDbToPurchaseOrder(poRows[0] as DbRow) } : {}),
  };
}

class CheckoutError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) { super(message); }
}

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) throw new CheckoutError(`${name} is required.`, 'validation_error', 400);
  return value;
}

function requestDb(request: Partial<ProcurementRequest>, fields: { id: string; requisitionId: string; decision: GovernedCheckoutDecision; now: string }): { columns: string[]; values: unknown[] } {
  const data: Record<string, unknown> = {
    id: fields.id,
    title: request.title ?? 'Procurement request',
    description: request.description ?? request.businessJustification ?? request.title ?? '',
    category: request.category ?? 'catalogue', status: 'intake', priority: request.priority ?? 'medium',
    value: fields.decision.totalValue, currency: fields.decision.currency,
    requestor_id: request.requestorId, owner_id: request.ownerId ?? request.requestorId,
    supplier_id: fields.decision.resolved.supplierId, supplier_name: request.supplierName,
    contract_id: fields.decision.resolved.contractId,
    risk_assessment_id: fields.decision.resolved.riskAssessmentId,
    buying_channel: request.buyingChannel ?? 'catalogue', commodity_code: request.commodityCode ?? fields.decision.resolved.commodityCodes[0] ?? '',
    commodity_code_label: request.commodityCodeLabel ?? fields.decision.resolved.commodityCodes[0] ?? '',
    cost_centre: fields.decision.resolved.costCentre ?? request.costCentre ?? '', budget_owner: fields.decision.resolved.budgetOwner ?? request.budgetOwner ?? '',
    business_justification: request.businessJustification ?? request.description ?? '',
    delivery_date: request.deliveryDate ?? null, is_urgent: request.isUrgent ?? false,
    days_in_stage: 0, is_overdue: false, refer_back_count: 0,
    requester_country: request.requesterCountry ?? null, requester_country_code: request.requesterCountryCode ?? null,
    beneficiary_id: fields.decision.resolved.beneficiaryId ?? request.beneficiaryId ?? null,
    beneficiary_name: request.beneficiaryName ?? null, beneficiary_country: request.beneficiaryCountry ?? null,
    beneficiary_country_code: request.beneficiaryCountryCode ?? null,
    fulfilment_status: fields.decision.status, created_at: fields.now, updated_at: fields.now,
  };
  return { columns: Object.keys(data), values: Object.values(data) };
}

function lineSql(lines: RequestLine[], requestId: string, requisitionId: string): { sql: string; values: unknown[] } {
  const columns = ['id', 'request_id', 'requisition_id', 'description', 'quantity', 'unit', 'unit_price', 'supplier_id', 'contract_id', 'catalogue_item_id', 'risk_assessment_id', 'commodity_code', 'delivery_date'];
  const values: unknown[] = [];
  const groups = lines.map((line) => {
    const row = [line.id, requestId, requisitionId, line.description, line.quantity, line.unit, line.unitPrice, line.supplierId, line.contractId, line.catalogueItemId ?? null, line.riskAssessmentId ?? null, line.commodityCode ?? null, line.deliveryDate ?? null];
    return `(${row.map((value) => { values.push(value); return `$${values.length}`; }).join(', ')})`;
  });
  return { sql: `INSERT INTO request_lines (${columns.join(', ')}) VALUES ${groups.join(', ')} RETURNING *`, values };
}

async function findExisting(sql: ReturnType<typeof getNeonClient>, key: string | undefined, requestId: string): Promise<DbRow | undefined> {
  if (key) {
    const rows = await sql.query('SELECT * FROM purchase_requisitions WHERE idempotency_key = $1', [key]);
    if (rows[0]) return rows[0] as DbRow;
  }
  const rows = await sql.query('SELECT * FROM purchase_requisitions WHERE request_id = $1', [requestId]);
  return rows[0] as DbRow | undefined;
}

function sameDecision(client: GovernedCheckoutDecision | undefined, server: GovernedCheckoutDecision): boolean {
  if (!client) return true;
  return client.ok === server.ok && client.status === server.status && client.totalValue === server.totalValue
    && client.approvalRequired === server.approvalRequired && client.riskReviewRequired === server.riskReviewRequired
    && client.contractAmendmentRequired === server.contractAmendmentRequired
    && client.resolved.supplierId === server.resolved.supplierId && client.resolved.contractId === server.resolved.contractId;
}

function matchFingerprint(text: string): string {
  return createHash('sha256').update(text.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
  let sql!: ReturnType<typeof getNeonClient>;
  try {
    sql = getNeonClient();
    const payload = req.body as CheckoutPayload | undefined;
    const requestId = assertString(payload?.requestId, 'requestId');
    const requisitionId = assertString(payload?.requisitionId, 'requisitionId');
    const checkout = payload?.checkout;
    const lines = payload?.lines;
    if (!checkout || !Array.isArray(lines) || lines.length === 0 || lines.length > 50) throw new CheckoutError('Checkout lines are required.', 'validation_error', 400);
    if (checkout.route !== 'catalogue' && checkout.route !== 'contract-call-off') throw new CheckoutError('Unsupported checkout route.', 'validation_error', 400);
    const idempotencyKey = checkout.idempotencyKey ? assertString(checkout.idempotencyKey, 'idempotencyKey') : undefined;
    const request = payload?.request ?? {};
    const requestFingerprint = fingerprint(payload ?? {});
    const existing = await findExisting(sql, idempotencyKey, requestId);
    if (existing) {
      if (existing.idempotency_fingerprint && existing.idempotency_fingerprint !== requestFingerprint) throw new CheckoutError('This idempotency key was already used for different checkout data.', 'idempotency_conflict', 409);
      return res.status(200).json(await aggregate(sql, existing));
    }

    const supplierId = assertString(checkout.supplier?.id, 'supplierId');
    const contractId = assertString(checkout.contract?.id, 'contractId');
    const [supplierRows, contractRows, profileRows, catalogueRows, riskRows, policy] = await Promise.all([
      sql.query('SELECT * FROM suppliers WHERE id = $1', [supplierId]),
      sql.query('SELECT * FROM contracts WHERE id = $1', [contractId]),
      sql.query('SELECT * FROM procurement_profiles WHERE user_id = $1', [assertString(checkout.profile?.userId, 'profile.userId')]),
      sql.query('SELECT * FROM catalogue_items WHERE id = ANY($1::text[])', [lines.map((line) => line.catalogueItemId).filter((id): id is string => typeof id === 'string')]),
      sql.query('SELECT * FROM risk_assessments WHERE contract_id = $1 OR supplier_id = $2', [contractId, supplierId]),
      loadPolicy(sql),
    ]);
    const supplier = supplierRows[0] ? mapDbToSupplier(supplierRows[0] as DbRow) : null;
    const contract = contractRows[0] ? mapDbToContract(contractRows[0] as DbRow) : null;
    if (!supplier || !contract) throw new CheckoutError('The selected supplier or contract could not be found.', 'governance_data_missing', 422);
    if (contract.supplierId !== supplier.id) throw new CheckoutError('Supplier and contract do not match.', 'governance_data_mismatch', 422);
    const profile = profileRows[0] ? mapDbToProcurementProfile(profileRows[0] as DbRow) : checkout.profile as ProcurementProfile;
    const catalogueById = new Map((catalogueRows as DbRow[]).map((row) => [String(row.id), mapDbToCatalogueItem(row)]));
    const assessments = (riskRows as DbRow[]).map(mapDbToRiskAssessment);
    const authoritativeLines: GovernedCheckoutLine[] = lines.map((line) => {
      const item = line.catalogueItemId ? catalogueById.get(line.catalogueItemId) : undefined;
      if (line.catalogueItemId && !item) throw new CheckoutError(`Catalogue item ${line.catalogueItemId} was not found.`, 'governance_data_missing', 422);
      if (item && item.available === false) throw new CheckoutError(`${item.name} is unavailable.`, 'catalogue_item_unavailable', 422);
      return {
        item, description: item?.name ?? line.description, quantity: line.quantity,
        unit: item?.unit ?? line.unit, unitPrice: item?.unitPrice ?? line.unitPrice,
        supplierId: item?.supplierId ?? line.supplierId, contractId: item?.contractId ?? line.contractId ?? contract.id,
        riskAssessmentId: item?.riskAssessmentId ?? line.riskAssessmentId, commodityCode: item?.commodityCode ?? line.commodityCode,
      };
    });
    const riskId = checkout.riskAssessment?.id ?? authoritativeLines.find((line) => line.riskAssessmentId)?.riskAssessmentId;
    const riskAssessment: RiskAssessment | undefined = riskId ? assessments.find((candidate) => candidate.id === riskId) : undefined;
    // A call-off must be supported by the current effective scope, not merely
    // by the category carried in the browser payload. Catalogue lines inherit
    // their linked contract scope and still persist the evidence for audit.
    let scopeEvidence: GovernedCheckoutInput['contractMatch'] | undefined;
    try {
      const scopeInput = {
        text: [checkout.purpose, ...authoritativeLines.map((line) => line.description)].filter(Boolean).join(' '),
        category: request.category ?? undefined,
        supplierId,
        estimatedValue: authoritativeLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
        needByDate: checkout.needByDate,
        serviceStartDate: checkout.serviceStartDate,
        serviceEndDate: checkout.serviceEndDate,
      };
      const scopes = (await loadContractMatchScopes(sql)).filter((scope) => scope.contractId === contractId);
      const match = matchContractScopes(scopeInput, scopes);
      const selected = match.candidates.find((candidate) => candidate.contractId === contractId);
      if (checkout.route === 'contract-call-off' && (!selected || match.route !== 'contract')) {
        throw new CheckoutError('The selected contract does not confidently cover this demand. Add more scope detail or continue as a new request.', 'contract_match_required', 409);
      }
      if (selected) {
        scopeEvidence = {
          scopeVersionId: selected.scopeVersionId,
          score: selected.score,
          reasons: selected.reasons,
          inputFingerprint: matchFingerprint(scopeInput.text),
          algorithmVersion: 'contract-match-v1',
        };
      }
      if (checkout.contractMatch && scopeEvidence && (checkout.contractMatch.scopeVersionId !== scopeEvidence.scopeVersionId || Math.abs(checkout.contractMatch.score - scopeEvidence.score) > 0.001)) {
        throw new CheckoutError('The contract match changed while you were reviewing the request.', 'governance_mismatch', 409);
      }
    } catch (error) {
      if (error instanceof CheckoutError) throw error;
      if (!/contract_scope_versions|does not exist|relation/i.test(errorMessage(error))) throw error;
      // Older environments can still process existing catalogue checkouts;
      // they remain auditable through the linked contract but have no scope evidence.
    }
    const authoritative: GovernedCheckoutInput = {
      ...checkout, lines: authoritativeLines, supplier, contract,
      ...(riskAssessment ? { riskAssessment } : {}), profile,
      ...(scopeEvidence ? { contractMatch: scopeEvidence } : {}),
      now: new Date(),
    };
    const decision = evaluateGovernedCheckout(authoritative, policy);
    if (!sameDecision(payload?.decision, decision)) throw new CheckoutError('The governance decision changed; review the checkout and submit again.', 'governance_mismatch', 409);
    if (!decision.ok) throw new CheckoutError(decision.errors.join(' '), 'governance_rejected', 422);
    const now = new Date().toISOString();
    const reqData = requestDb(request, { id: requestId, requisitionId, decision, now });
    const requisitionData: Record<string, unknown> = {
      id: requisitionId, request_id: requestId, route: checkout.route, status: decision.status,
      supplier_id: decision.resolved.supplierId, contract_id: decision.resolved.contractId,
      risk_assessment_id: decision.resolved.riskAssessmentId ?? null, total_value: decision.totalValue,
      currency: decision.currency, need_by_date: checkout.needByDate ?? null, service_start_date: checkout.serviceStartDate ?? null,
      service_end_date: checkout.serviceEndDate ?? null, purpose: checkout.purpose.trim(), cost_centre: decision.resolved.costCentre ?? null,
      budget_owner: decision.resolved.budgetOwner ?? null, account_type: decision.resolved.accountType ?? null,
      ship_to_location_id: decision.resolved.shipToLocationId ?? null, beneficiary_id: decision.resolved.beneficiaryId ?? null,
      approval_required: decision.approvalRequired, risk_review_required: decision.riskReviewRequired,
      contract_amendment_required: decision.contractAmendmentRequired, idempotency_key: idempotencyKey ?? null,
      idempotency_fingerprint: requestFingerprint, created_at: now, updated_at: now,
      contract_scope_version_id: decision.resolved.contractScopeVersionId ?? null,
      contract_match_score: decision.resolved.contractMatchScore ?? null,
      contract_match_reasons: decision.resolved.contractMatchReasons ?? [],
      contract_match_algorithm_version: decision.resolved.contractMatchAlgorithmVersion ?? null,
      contract_match_input_fingerprint: decision.resolved.contractMatchInputFingerprint ?? null,
    };
    const reqColumns = Object.keys(requisitionData);
    const reqValues = Object.values(requisitionData);
    const reqPlaceholders = reqValues.map((_, index) => `$${index + 1}`).join(', ');
    const linesForInsert = lines.map((line, index) => ({ ...line, requestId, requisitionId, ...(authoritativeLines[index].item ? { description: authoritativeLines[index].description, unit: authoritativeLines[index].unit, unitPrice: authoritativeLines[index].unitPrice, supplierId: authoritativeLines[index].supplierId, contractId: authoritativeLines[index].contractId ?? contract.id, catalogueItemId: authoritativeLines[index].item?.id, riskAssessmentId: riskAssessment?.id, commodityCode: authoritativeLines[index].commodityCode } : {}) }));
    const lineInsert = lineSql(linesForInsert, requestId, requisitionId);
    const requestInsert = `INSERT INTO requests (${reqData.columns.join(', ')}) VALUES (${reqData.values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`;
    const requisitionInsert = `INSERT INTO purchase_requisitions (${reqColumns.join(', ')}) VALUES (${reqPlaceholders}) RETURNING *`;
    const queries = [
      sql.query(requestInsert, reqData.values),
      sql.query(requisitionInsert, reqValues),
      sql.query(lineInsert.sql, lineInsert.values),
      // requests.requisition_id is an FK to the PR, so it is linked only
      // after both parent rows exist inside the same transaction.
      sql.query('UPDATE requests SET requisition_id = $1, updated_at = $2 WHERE id = $3', [requisitionId, now, requestId]),
    ];
    if (decision.status === 'approved') {
      const po = { id: String(payload?.poId ?? `PO-${requestId}`), supplier_id: supplier.id, supplier_name: supplier.name, value: decision.totalValue, status: 'submitted', created_at: now, delivery_date: checkout.needByDate ?? '', contract_id: contract.id, request_id: requestId, requisition_id: requisitionId, risk_assessment_id: decision.resolved.riskAssessmentId ?? null, cost_centre: decision.resolved.costCentre ?? null, budget_owner: decision.resolved.budgetOwner ?? null, account_type: decision.resolved.accountType ?? null, ship_to_location_id: decision.resolved.shipToLocationId ?? null, beneficiary_id: decision.resolved.beneficiaryId ?? null, line_items: JSON.stringify(linesForInsert.map((line) => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, received: 0 }))) };
      const poColumns = Object.keys(po); const poValues = Object.values(po);
      queries.push(sql.query(`INSERT INTO purchase_orders (${poColumns.join(', ')}) VALUES (${poValues.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`, poValues));
      queries.push(sql.query('UPDATE requests SET po_id = $1, fulfilment_status = $2, updated_at = $3 WHERE id = $4', [po.id, 'po-created', now, requestId]));
      queries.push(sql.query('UPDATE purchase_requisitions SET status = $1, updated_at = $2 WHERE id = $3', ['po-created', now, requisitionId]));
    }
    await sql.transaction(queries);
    const saved = await sql.query('SELECT * FROM purchase_requisitions WHERE id = $1', [requisitionId]);
    return res.status(200).json(await aggregate(sql, saved[0] as DbRow));
  } catch (error) {
    if (error instanceof CheckoutError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
    const message = errorMessage(error);
    if (/duplicate key|unique constraint/i.test(message)) {
      try {
        const payload = req.body as CheckoutPayload;
        if (!sql) throw new Error('Neon database configuration is unavailable.');
        const existing = await findExisting(sql, payload.checkout?.idempotencyKey, String(payload.requestId));
        if (existing && existing.idempotency_fingerprint === fingerprint(payload)) { res.status(200).json(await aggregate(sql, existing)); return; }
        if (existing) { res.status(409).json({ error: 'This idempotency key was already used for different checkout data.', code: 'idempotency_conflict' }); return; }
      } catch (replayError) { console.error('[governed-checkout-replay]', errorMessage(replayError)); }
    }
    console.error('[governed-checkout]', message);
    res.status(500).json({ error: 'Governed checkout could not be completed.', code: 'checkout_failed' });
  }
}
