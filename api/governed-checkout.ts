// Atomic internal checkout boundary. All authoritative governance reads and
// request → PR → line → conditional PO writes happen behind this endpoint.
import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNeonClient, isMissingRelation, queryRows, type DbRow } from './_neon.js';
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
import { loadContractMatchScopes } from '../src/server/api/contract-match.js';
import { matchContractScopes } from '../src/lib/procurement/contract-matching.js';
import { getDbAdmin } from './_db-admin.js';
import { approvalRows, deriveApprovalsFor, resolveChainId } from '../src/lib/db/approvals-core.js';

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

/**
 * Merge a stored policy row over the shipped defaults, key by key.
 *
 * This used to reject the whole row if any single key was absent and fall back
 * to DEFAULT_POLICY_CONFIG entirely. That turned adding one field to
 * PolicyConfig into a silent reversion of every admin-configured threshold: the
 * stored row predates the new key, the guard fires, and live checkout starts
 * deciding on shipped defaults with nothing logged. Taking each key on its own
 * merits keeps the configured values and defaults only what is genuinely
 * missing — which is what the spread below always did on its own.
 *
 * A key whose stored type does not match the default's is also defaulted, so a
 * hand-edited row cannot feed a string threshold into a numeric comparison.
 */
function configFromRow(row: DbRow | undefined): PolicyConfig {
  const value = row?.config;
  if (!isRecord(value)) return DEFAULT_POLICY_CONFIG;
  const candidate = value as Record<string, unknown>;
  const merged = { ...DEFAULT_POLICY_CONFIG } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(DEFAULT_POLICY_CONFIG)) {
    const stored = candidate[key];
    if (stored === undefined || stored === null) continue;
    if (Array.isArray(fallback) !== Array.isArray(stored)) continue;
    if (typeof stored !== typeof fallback) continue;
    merged[key] = stored;
  }
  return merged as unknown as PolicyConfig;
}

async function loadPolicy(sql: ReturnType<typeof getNeonClient>): Promise<PolicyConfig> {
  try {
    const rows = await queryRows(sql, 'SELECT config FROM procurement_policy_configs WHERE singleton_key = $1', ['default']);
    return configFromRow(rows[0]);
  } catch (error) {
    // The policy table is additive. A deployment that has not run the migration
    // still uses shipped defaults rather than making checkout unusable. Anything
    // else — a permissions or connection failure — must surface, not quietly
    // hand this checkout a different rulebook than the admin configured.
    if (isMissingRelation(error)) return DEFAULT_POLICY_CONFIG;
    throw error;
  }
}

async function aggregate(sql: ReturnType<typeof getNeonClient>, requisitionRow: DbRow): Promise<Aggregate> {
  const requestId = String(requisitionRow.request_id);
  const [requestRows, lineRows, poRows] = await Promise.all([
    queryRows(sql, 'SELECT * FROM requests WHERE id = $1', [requestId]),
    queryRows(sql, 'SELECT * FROM request_lines WHERE requisition_id = $1 ORDER BY id', [String(requisitionRow.id)]),
    queryRows(sql, 'SELECT * FROM purchase_orders WHERE requisition_id = $1 ORDER BY created_at DESC', [String(requisitionRow.id)]),
  ]);
  const request = requestRows[0];
  const purchaseOrders = poRows;
  const lines = lineRows.map(mapDbToRequestLine);
  if (!request || lines.length === 0 || (requisitionRow.status === 'po-created' && purchaseOrders.length === 0)) {
    throw new CheckoutError('Existing checkout aggregate is incomplete and requires recovery.', 'incomplete_checkout', 409);
  }
  return {
    requestId,
    request: mapDbToRequest(request),
    requisition: mapDbToPurchaseRequisition(requisitionRow),
    lines,
    ...(purchaseOrders[0] ? { purchaseOrder: mapDbToPurchaseOrder(purchaseOrders[0]) } : {}),
  };
}

class CheckoutError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) { super(message); }
}

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) throw new CheckoutError(`${name} is required.`, 'validation_error', 400);
  return value;
}

/**
 * The workflow template and start node a governed checkout enters.
 *
 * A checkout used to create a request, requisition, lines and PO and then
 * stop: no workflow instance, no stage history, no template. Every catalogue
 * and call-off request in the store has `workflow_instances = 0`, which is why
 * the Workflow tab rendered a wall of grey placeholders, the Approvals tab was
 * empty, and the request could not progress — there was no lifecycle to
 * progress. The records are now written in the same transaction as the rest.
 *
 * Node ids come from the seeded templates: WF-002 "Catalogue Purchase" runs
 * n1 start → n2 auto-validate → n3 value check → n4 manager approval →
 * n5 auto-PO → n6 PO created → n7 receipt, and WF-001 "Standard Procurement"
 * carries the full lifecycle a call-off can land anywhere in.
 */
function lifecycleEntry(route: string, status: GovernedCheckoutDecision['status']): {
  templateId: string; nodeId: string; stage: ProcurementRequest['status'];
} {
  if (route === 'catalogue') {
    // A catalogue order has no sourcing, contracting or risk stage to enter;
    // anything that is not auto-approved waits at manager approval.
    if (status === 'approved') return { templateId: 'WF-002', nodeId: 'n6', stage: 'po' };
    return { templateId: 'WF-002', nodeId: 'n4', stage: 'approval' };
  }
  switch (status) {
    case 'approved': return { templateId: 'WF-001', nodeId: 'n8', stage: 'po' };
    case 'risk-review': return { templateId: 'WF-001', nodeId: 'n14', stage: 'risk' };
    case 'contract-amendment-required': return { templateId: 'WF-001', nodeId: 'n7', stage: 'contracting' };
    default: return { templateId: 'WF-001', nodeId: 'n5', stage: 'approval' };
  }
}

function requestDb(request: Partial<ProcurementRequest>, fields: { id: string; requisitionId: string; decision: GovernedCheckoutDecision; now: string; templateId: string; stage: ProcurementRequest['status'] }): { columns: string[]; values: unknown[] } {
  // The first actionable stage is part of the persisted request state. Keeping
  // every checkout in `intake` made a completed catalogue request appear
  // stuck even when the policy had already created its internal PO.
  const lifecycleStatus = fields.stage;
  const data: Record<string, unknown> = {
    id: fields.id,
    title: request.title ?? 'Procurement request',
    description: request.description ?? request.businessJustification ?? request.title ?? '',
    category: request.category ?? 'catalogue', status: lifecycleStatus, priority: request.priority ?? 'medium',
    value: fields.decision.totalValue, currency: fields.decision.currency,
    requestor_id: request.requestorId, owner_id: request.ownerId ?? request.requestorId,
    supplier_id: fields.decision.resolved.supplierId, supplier_name: null,
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
    workflow_template_id: fields.templateId,
    fulfilment_status: fields.decision.status, created_at: fields.now, updated_at: fields.now,
  };
  return { columns: Object.keys(data), values: Object.values(data) };
}

/**
 * The line rows, carrying what a downstream order needs.
 *
 * supplier_part_id, unit_of_measure_code and line_number are snapshotted from
 * the catalogue item rather than joined at hand-off time: re-pricing or
 * re-coding an item must not rewrite an order already placed. Without them a
 * catalogue order could supply description, quantity, price and currency and
 * nothing else, which is not enough to produce a valid cXML OrderRequest —
 * SupplierPartID, UnitOfMeasure and the line ordinal are all required.
 */
function lineSql(
  lines: RequestLine[],
  requestId: string,
  requisitionId: string,
  itemsById: Map<string, { supplierPartId?: string | null; unitOfMeasureCode?: string | null; commodityCode?: string | null }>,
): { sql: string; values: unknown[] } {
  const columns = ['id', 'request_id', 'requisition_id', 'description', 'quantity', 'unit', 'unit_price', 'supplier_id', 'contract_id', 'catalogue_item_id', 'risk_assessment_id', 'commodity_code', 'delivery_date', 'supplier_part_id', 'unit_of_measure_code', 'line_number'];
  const values: unknown[] = [];
  const groups = lines.map((line, index) => {
    const item = line.catalogueItemId ? itemsById.get(line.catalogueItemId) : undefined;
    const row = [line.id, requestId, requisitionId, line.description, line.quantity, line.unit, line.unitPrice, line.supplierId, line.contractId, line.catalogueItemId ?? null, line.riskAssessmentId ?? null, line.commodityCode ?? item?.commodityCode ?? null, line.deliveryDate ?? null, item?.supplierPartId ?? null, item?.unitOfMeasureCode ?? null, index + 1];
    return `(${row.map((value) => { values.push(value); return `$${values.length}`; }).join(', ')})`;
  });
  return { sql: `INSERT INTO request_lines (${columns.join(', ')}) VALUES ${groups.join(', ')} RETURNING *`, values };
}

async function findExisting(sql: ReturnType<typeof getNeonClient>, key: string | undefined, requestId: string): Promise<DbRow | undefined> {
  if (key) {
    const rows = await queryRows(sql, 'SELECT * FROM purchase_requisitions WHERE idempotency_key = $1', [key]);
    if (rows[0]) return rows[0];
  }
  const rows = await queryRows(sql, 'SELECT * FROM purchase_requisitions WHERE request_id = $1', [requestId]);
  return rows[0];
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
      res.status(200).json(await aggregate(sql, existing)); return;
    }

    const supplierId = assertString(checkout.supplier?.id, 'supplierId');
    const contractId = assertString(checkout.contract?.id, 'contractId');
    const [supplierRows, contractRows, profileRows, catalogueRows, riskRows, costCentreRows, locationRows, policy] = await Promise.all([
      queryRows(sql, 'SELECT * FROM suppliers WHERE id = $1', [supplierId]),
      queryRows(sql, 'SELECT * FROM contracts WHERE id = $1', [contractId]),
      queryRows(sql, 'SELECT * FROM procurement_profiles WHERE user_id = $1', [assertString(checkout.profile?.userId, 'profile.userId')]),
      queryRows(sql, 'SELECT * FROM catalogue_items WHERE id = ANY($1::text[])', [lines.map((line) => line.catalogueItemId).filter((id): id is string => typeof id === 'string')]),
      queryRows(sql, 'SELECT * FROM risk_assessments WHERE contract_id = $1 OR supplier_id = $2', [contractId, supplierId]),
      // The reference data the cost-centre and delivery-location checks are made
      // against, read HERE rather than taken from the request body. The
      // delivery-location check used to run against the profile the browser
      // sent when no stored profile existed, so it approved whatever it was
      // given; a check that cannot fail is not a check.
      queryRows(sql, 'SELECT id FROM cost_centres WHERE active = true'),
      queryRows(sql, 'SELECT id FROM delivery_locations WHERE active = true'),
      loadPolicy(sql),
    ]);
    const supplier = supplierRows[0] ? mapDbToSupplier(supplierRows[0]) : null;
    const contract = contractRows[0] ? mapDbToContract(contractRows[0]) : null;
    if (!supplier || !contract) throw new CheckoutError('The selected supplier or contract could not be found.', 'governance_data_missing', 422);
    if (contract.supplierId !== supplier.id) throw new CheckoutError('Supplier and contract do not match.', 'governance_data_mismatch', 422);
    const profile = profileRows[0] ? mapDbToProcurementProfile(profileRows[0]) : checkout.profile as ProcurementProfile;
    const catalogueById = new Map(catalogueRows.map((row) => [String(row.id), mapDbToCatalogueItem(row)]));
    const assessments = riskRows.map(mapDbToRiskAssessment);
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
    const scopeInput = {
      text: [checkout.purpose, ...authoritativeLines.map((line) => line.description)].filter(Boolean).join(' '),
      category: request.category ?? undefined,
      supplierId,
      estimatedValue: authoritativeLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
      needByDate: checkout.needByDate,
      serviceStartDate: checkout.serviceStartDate,
      serviceEndDate: checkout.serviceEndDate,
    };
    // Only the READ is allowed to fail softly, and only for a missing table.
    // The gate below used to sit inside this try: any error the catch swallowed
    // skipped the check entirely and wrote a requisition whose scope evidence
    // was silently null — a call-off approved because the check crashed, which
    // is the one outcome a mandatory gate must never have.
    let scopes: Awaited<ReturnType<typeof loadContractMatchScopes>>;
    let scopeDataAvailable = true;
    try {
      scopes = (await loadContractMatchScopes(sql)).filter((scope) => scope.contractId === contractId);
    } catch (error) {
      if (!isMissingRelation(error)) throw error;
      scopeDataAvailable = false;
      scopes = [];
    }

    const match = matchContractScopes(scopeInput, scopes);
    const selected = scopeDataAvailable
      ? match.candidates.find((candidate) => candidate.contractId === contractId)
      : undefined;

    if (checkout.route === 'contract-call-off') {
      // A call-off is a claim that an existing contract already covers this
      // demand. Without scope data that claim cannot be checked, so it cannot
      // be accepted — the requester is sent down the full-request route rather
      // than being waved through on an unverified assertion.
      if (!scopeDataAvailable) {
        throw new CheckoutError('Contract coverage cannot be verified right now, so this call-off cannot be accepted. Continue as a new request.', 'contract_scope_unavailable', 503);
      }
      if (!selected || match.route !== 'contract') {
        throw new CheckoutError('The selected contract does not confidently cover this demand. Add more scope detail or continue as a new request.', 'contract_match_required', 409);
      }
    }

    if (selected) {
      scopeEvidence = {
        scopeVersionId: selected.scopeVersionId,
        score: selected.score,
        reasons: selected.reasons,
        inputFingerprint: matchFingerprint(scopeInput.text),
        algorithmVersion: 'contract-match-v1',
      };
    } else if (!scopeDataAvailable) {
      // Record that the check did not run. Leaving the evidence null reads
      // identically to "ran and found nothing", and a blank where a check
      // belongs is worse than no record at all.
      scopeEvidence = {
        scopeVersionId: null,
        score: 0,
        reasons: ['Contract scope data was unavailable; coverage was not evaluated.'],
        inputFingerprint: matchFingerprint(scopeInput.text),
        algorithmVersion: 'not-evaluated',
      };
    }

    if (checkout.contractMatch && scopeEvidence && scopeDataAvailable
      && (checkout.contractMatch.scopeVersionId !== scopeEvidence.scopeVersionId
        || Math.abs(checkout.contractMatch.score - scopeEvidence.score) > 0.001)) {
      throw new CheckoutError('The contract match changed while you were reviewing the request.', 'governance_mismatch', 409);
    }
    const authoritative: GovernedCheckoutInput = {
      ...checkout, lines: authoritativeLines, supplier, contract,
      ...(riskAssessment ? { riskAssessment } : {}), profile,
      ...(scopeEvidence ? { contractMatch: scopeEvidence } : {}),
      activeCostCentreIds: costCentreRows.map((row) => String(row.id)),
      activeDeliveryLocationIds: locationRows.map((row) => String(row.id)),
      now: new Date(),
    };
    const decision = evaluateGovernedCheckout(authoritative, policy);
    if (!sameDecision(payload?.decision, decision)) throw new CheckoutError('The governance decision changed; review the checkout and submit again.', 'governance_mismatch', 409);
    if (!decision.ok) throw new CheckoutError(decision.errors.join(' '), 'governance_rejected', 422);
    const now = new Date().toISOString();
    const entry = lifecycleEntry(checkout.route, decision.status);

    // Who has to agree, derived from the records rather than a role→persona
    // map. A checkout that needs approval used to write no entries at all, so
    // the request sat in `approval` with an empty Approvals tab and nobody able
    // to move it. Derived before the transaction opens because it reads the
    // directory, the category's managers and the contract owner.
    const approvals = decision.approvalRequired
      ? await deriveApprovalsFor(
          getDbAdmin(),
          {
            requestId,
            route: checkout.route,
            category: request.category ?? null,
            contractId: contract.id,
            costCentre: decision.resolved.costCentre ?? null,
          },
          await resolveChainId(getDbAdmin(), request.approvalChain ?? null, decision.totalValue),
        )
      : [];
    const reqData = requestDb(request, { id: requestId, requisitionId, decision, now, templateId: entry.templateId, stage: entry.stage });
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
      // Neon receives JSONB parameters as JSON text; passing the JavaScript
      // array directly is interpreted as a Postgres array literal and fails
      // with "invalid input syntax for type json" during call-off checkout.
      contract_match_reasons: JSON.stringify(decision.resolved.contractMatchReasons ?? []),
      contract_match_algorithm_version: decision.resolved.contractMatchAlgorithmVersion ?? null,
      contract_match_input_fingerprint: decision.resolved.contractMatchInputFingerprint ?? null,
    };
    const reqColumns = Object.keys(requisitionData);
    const reqValues = Object.values(requisitionData);
    const reqPlaceholders = reqValues.map((_, index) => `$${index + 1}`).join(', ');
    const linesForInsert = lines.map((line, index) => ({ ...line, requestId, requisitionId, ...(authoritativeLines[index].item ? { description: authoritativeLines[index].description, unit: authoritativeLines[index].unit, unitPrice: authoritativeLines[index].unitPrice, supplierId: authoritativeLines[index].supplierId, contractId: authoritativeLines[index].contractId ?? contract.id, catalogueItemId: authoritativeLines[index].item?.id, riskAssessmentId: riskAssessment?.id, commodityCode: authoritativeLines[index].commodityCode } : {}) }));
    // The catalogue rows already read above carry the procurement identity.
    const identityByItem = new Map(catalogueRows.map((row) => [String(row.id), {
      supplierPartId: row.supplier_part_id as string | null,
      unitOfMeasureCode: row.unit_of_measure_code as string | null,
      commodityCode: row.commodity_code as string | null,
    }]));
    const lineInsert = lineSql(linesForInsert, requestId, requisitionId, identityByItem);
    const requestInsert = `INSERT INTO requests (${reqData.columns.join(', ')}) VALUES (${reqData.values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`;
    const requisitionInsert = `INSERT INTO purchase_requisitions (${reqColumns.join(', ')}) VALUES (${reqPlaceholders}) RETURNING *`;
    const queries = [
      sql.query(requestInsert, reqData.values),
      sql.query(requisitionInsert, reqValues),
      sql.query(lineInsert.sql, lineInsert.values),
      // requests.requisition_id is an FK to the PR, so it is linked only
      // after both parent rows exist inside the same transaction.
      sql.query('UPDATE requests SET requisition_id = $1, updated_at = $2 WHERE id = $3', [requisitionId, now, requestId]),
      // The lifecycle records. Without these the request has a PO but nothing
      // that describes where it is or how it got there, so no screen can show
      // its progress and no action can advance it.
      //
      // Two rows, because a checkout is a journey and not a destination: intake
      // is entered and completed by the act of submitting, and the request then
      // sits in whatever stage the decision put it in. Writing only the final
      // stage would also collide with the auto-PO row below on the table's
      // (request_id, stage, entered_at) natural key.
      sql.query(
        'INSERT INTO stage_history (request_id, stage, entered_at, completed_at, owner_id, action, notes) VALUES ($1, $2, $3, $3, $4, $5, $6)',
        [requestId, 'intake', now, request.ownerId ?? request.requestorId ?? null, 'submitted',
         checkout.route === 'catalogue' ? 'Catalogue order placed through governed checkout.' : 'Contract call-off raised through governed checkout.'],
      ),
      sql.query(
        'INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [requestId, entry.stage, now, request.ownerId ?? request.requestorId ?? null, 'advanced',
         decision.approvalRequired ? 'Awaiting approval before the order is raised.' : 'Met the auto-approval policy.'],
      ),
      sql.query(
        `INSERT INTO workflow_instances (id, request_id, template_id, current_node_ids, status, variables, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $7)`,
        [`WI-${requestId}`, requestId, entry.templateId, JSON.stringify([entry.nodeId]), 'running',
         JSON.stringify({ route: checkout.route, submittedBy: request.requestorId ?? null }), now],
      ),
    ];

    for (const row of approvalRows(requestId, approvals, now)) {
      const columns = Object.keys(row);
      queries.push(sql.query(
        `INSERT INTO approval_entries (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
        Object.values(row),
      ));
    }

    if (decision.status === 'approved') {
      const po = { id: String(payload?.poId ?? `PO-${requestId}`), supplier_id: supplier.id, supplier_name: supplier.name,
        // Who is handling this order. There was no owner concept at all, so the
        // screens had nothing to show and read as unassigned; budget_owner is
        // free text and answers a different question.
        owner_id: request.ownerId ?? request.requestorId ?? null,
        owner_name: request.beneficiaryName ?? null, value: decision.totalValue, status: 'submitted', created_at: now, delivery_date: checkout.needByDate ?? '', contract_id: contract.id, request_id: requestId, requisition_id: requisitionId, risk_assessment_id: decision.resolved.riskAssessmentId ?? null, cost_centre: decision.resolved.costCentre ?? null, budget_owner: decision.resolved.budgetOwner ?? null, account_type: decision.resolved.accountType ?? null, ship_to_location_id: decision.resolved.shipToLocationId ?? null, beneficiary_id: decision.resolved.beneficiaryId ?? null, line_items: JSON.stringify(linesForInsert.map((line) => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, received: 0 }))) };
      const poColumns = Object.keys(po); const poValues = Object.values(po);
      queries.push(sql.query(`INSERT INTO purchase_orders (${poColumns.join(', ')}) VALUES (${poValues.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`, poValues));
      queries.push(sql.query('UPDATE requests SET po_id = $1, fulfilment_status = $2, updated_at = $3 WHERE id = $4', [po.id, 'po-created', now, requestId]));
      queries.push(sql.query('UPDATE purchase_requisitions SET status = $1, updated_at = $2 WHERE id = $3', ['po-created', now, requisitionId]));
      // The request is already in `po` from the row above — this records which
      // order was raised there, rather than opening a second row for the same
      // stage at the same instant.
      queries.push(sql.query(
        'UPDATE stage_history SET notes = $1 WHERE request_id = $2 AND stage = $3 AND completed_at IS NULL',
        [`Purchase order ${po.id} raised automatically — the checkout met the auto-approval policy.`, requestId, 'po'],
      ));
    }
    await sql.transaction(queries);
    const saved = await queryRows(sql, 'SELECT * FROM purchase_requisitions WHERE id = $1', [requisitionId]);
    res.status(200).json(await aggregate(sql, saved[0])); return;
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
